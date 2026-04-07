const express = require("express");
const router = express.Router();
const multer = require("multer");
const { OpenAI } = require("openai");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// Setup AI Provider (OpenRouter, Groq, or OpenAI)
const aiKey = process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
const aiBaseUrl = process.env.OPENROUTER_API_KEY 
  ? "https://openrouter.ai/api/v1" 
  : (process.env.GROQ_API_KEY ? "https://api.groq.com/openai/v1" : undefined);

const openai = new OpenAI({
  apiKey: aiKey || "dummy-key-for-now",
  baseURL: aiBaseUrl,
  defaultHeaders: process.env.OPENROUTER_API_KEY ? {
    "X-Title": "Thinker AI"
  } : {}
});

// Setup Multer for file / audio uploads
const upload = multer({ dest: "uploads/" });

// 1. Audio Transcription (Whisper)
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

// 3. AI Image Generation (Pollinations AI - 100% Free, No Key)
router.post("/generate-image", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).send({ error: "Prompt is required" });

  try {
    // Clean the prompt for the URL
    const cleanPrompt = encodeURIComponent(prompt.substring(0, 200));
    const imageUrl = `https://pollinations.ai/p/${cleanPrompt}?width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;
    
    // We append a seed to ensure uniqueness for each request
    res.send({ imageUrl: imageUrl });
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
