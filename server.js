const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const { OpenAI } = require("openai");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
const featuresRouter = require("./features"); // Import the modular features

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontend"))); // Serve frontend files

// Use the separate features file for Google, Mic, Image, and File generation
app.use("/", featuresRouter);

// Setup OpenAI with Groq fallback
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "dummy-key-for-now",
  baseURL: process.env.GROQ_API_KEY ? "https://api.groq.com/openai/v1" : undefined
});

// Setup Multer for file uploads
const upload = multer({ dest: "uploads/" });

let codes = {}; // store verification codes


// Send verification code
app.post("/send-code", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send({ success: false, error: "Email is required" });

  const cleanEmail = email.trim();
  const code = Math.floor(100000 + Math.random() * 900000);
  codes[cleanEmail] = code;

  console.log(`Generated code for ${cleanEmail}: ${code}`);
  
  if (process.env.EMAILJS_SERVICE_ID) {
    try {
      const emailResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: process.env.EMAILJS_SERVICE_ID,
          template_id: process.env.EMAILJS_TEMPLATE_ID,
          user_id: process.env.EMAILJS_PUBLIC_KEY,
          accessToken: process.env.EMAILJS_PRIVATE_KEY,
          template_params: {
            to_email: cleanEmail,
            passcode: code,
            time: new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString()
          }
        })
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error("EmailJS Error:", errorText);
      }
    } catch (err) {
      console.error("Error sending email via EmailJS:", err);
    }
  }

  res.send({ success: true, message: "Code sent" });
});

// Verify code
app.post("/verify-code", (req, res) => {
  const { email, code } = req.body;
  const cleanEmail = email ? email.trim() : "";

  if (codes[cleanEmail] && codes[cleanEmail].toString() === code.toString()) {
    delete codes[cleanEmail]; // Clear code after use
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

    if (openai.apiKey === "dummy-key-for-now") {
      return res.send({ reply: "I am a simulated AI. Please add an OPENAI_API_KEY to your .env to enable real AI responses!" });
    }

    const response = await openai.chat.completions.create({
      model: process.env.GROQ_API_KEY ? "llama3-8b-8192" : "gpt-4o-mini", // Use most compatible Groq model
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
    const fileText = `Simulated content for ${fileName}`;

    if (openai.apiKey === "dummy-key-for-now") {
      return res.send({ analysis: `File "${fileName}" uploaded successfully. (Analysis simulated because OpenAI API key is missing)` });
    }

    const response = await openai.chat.completions.create({
      model: process.env.GROQ_API_KEY ? "llama3-8b-8192" : "gpt-4o-mini",
      messages: [
        { role: "user", content: "Briefly summarize or analyze the following content: " + fileText }
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