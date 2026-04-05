const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const { OpenAI } = require("openai");
const path = require("path");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontend"))); // Serve frontend files

// Setup Groq (Free alternative using the same OpenAI library)
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "dummy-key-for-now",
  baseURL: "https://api.groq.com/openai/v1"
});

// Setup Multer for file uploads
const upload = multer({ dest: "uploads/" });

let codes = {}; // store verification codes

// Setup Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "dummy@gmail.com",
    pass: process.env.EMAIL_PASS || "dummy-pass",
  },
});

// Send verification code
app.post("/send-code", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send({ success: false, error: "Email is required" });

  const code = Math.floor(100000 + Math.random() * 900000);
  codes[email] = code;

  console.log(`Generated code for ${email}: ${code}`); // Helpful for testing without real email

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your Aether AI Verification Code",
        text: `Your login code is: ${code}`,
      });
      console.log("Email sent successfully");
    } catch (err) {
      console.error("Error sending email:", err);
      // Even if email fails (wrong creds), we proceed so the user can test using the console code
    }
  } else {
    console.log("Email not sent: EMAIL_USER and EMAIL_PASS not set in .env");
  }

  res.send({ success: true, message: "Code sent" });
});

// Verify code
app.post("/verify-code", (req, res) => {
  const { email, code } = req.body;

  if (codes[email] && codes[email].toString() === code.toString()) {
    delete codes[email]; // Clear code after use
    res.send({ success: true });
  } else {
    res.send({ success: false, error: "Invalid code" });
  }
});

// Chatbot integration
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).send({ error: "Message is required" });

    if (openai.apiKey === "dummy-key-for-now" || !process.env.OPENAI_API_KEY) {
      return res.send({ reply: "I am a simulated AI. Please add an OPENAI_API_KEY to your .env to enable real AI responses!" });
    }

    const response = await openai.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: message }],
    });

    res.send({ reply: response.choices[0].message.content });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).send({ error: "Failed to generate response" });
  }
});

// File upload and analysis
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ error: "No file uploaded" });
    }

    const fileName = req.file.originalname;
    const fileText = `Simulated content for ${fileName}`; // For a real app, read file and parse text (e.g., pdf-parse, fs.readFileSync)
    
    if (openai.apiKey === "dummy-key-for-now" || !process.env.OPENAI_API_KEY) {
      return res.send({ analysis: `File "${fileName}" uploaded successfully. (Analysis simulated because OpenAI API key is missing)` });
    }

    const response = await openai.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        { role: "user", content: "Briefly summarize or analyze the following content/file name context: " + fileText }
      ],
    });

    res.send({ analysis: response.choices[0].message.content });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send({ error: "File analysis failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
