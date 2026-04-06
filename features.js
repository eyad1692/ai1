const express = require("express");
const router = express.Router();
const multer = require("multer");
const { OpenAI } = require("openai");
const { OAuth2Client } = require("google-auth-library");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// Setup OpenAI with Groq fallback
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "dummy-key-for-now",
  baseURL: process.env.GROQ_API_KEY ? "https://api.groq.com/openai/v1" : undefined
});

// Setup Google OAuth Client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Setup Multer for file / audio uploads
const upload = multer({ dest: "uploads/" });

// 1. Google Sign-In verification
router.post("/google-auth", async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).send({ success: false, error: "ID Token is required" });

  try {
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    res.send({ success: true, user: { email: payload.email, name: payload.name } });
  } catch (error) {
    console.error("Google Auth error:", error);
    res.status(401).send({ success: false, error: "Invalid ID Token" });
  }
});

// 2. Audio Transcription (Whisper)
router.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ error: "No audio file uploaded" });
    }

    if (openai.apiKey === "dummy-key-for-now") {
      return res.send({ transcription: "This is a simulated transcription of your voice input." });
    }

    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-1",
    });

    res.send({ transcription: response.text });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).send({ error: "Transcription failed" });
  }
});

// 3. AI Image Generation
router.post("/generate-image", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).send({ error: "Prompt is required" });

  try {
    if (openai.apiKey === "dummy-key-for-now") {
      return res.send({ imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?ixlib=rb-1.2.1&auto=format&fit=crop&w=1064&q=80" });
    }

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
    });

    res.send({ imageUrl: response.data[0].url });
  } catch (err) {
    console.error("Image generation error:", err);
    res.status(500).send({ error: "Image generation failed" });
  }
});

// 4. AI File Generation (PDF)
router.post("/generate-file", async (req, res) => {
  const { content, title = "Thinker-AI-Generated-File" } = req.body;
  if (!content) return res.status(400).send({ error: "Content is required" });

  try {
    const doc = new PDFDocument();
    const filePath = path.join(__dirname, "uploads", `${Date.now()}.pdf`);
    const stream = fs.createWriteStream(filePath);
    
    doc.pipe(stream);
    doc.fontSize(25).text("Thinker AI Document", 100, 80);
    doc.fontSize(12).text(content, 100, 150);
    doc.end();

    stream.on("finish", () => {
      res.download(filePath);
    });
  } catch (err) {
    console.error("File generation error:", err);
    res.status(500).send({ error: "File generation failed" });
  }
});

module.exports = router;
