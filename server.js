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

// Setup AI Provider (OpenRouter, Groq, or OpenAI)
const aiKey = process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
const aiBaseUrl = process.env.OPENROUTER_API_KEY 
  ? "https://openrouter.ai/api/v1" 
  : (process.env.GROQ_API_KEY ? "https://api.groq.com/openai/v1" : undefined);

const openai = new OpenAI({
  apiKey: aiKey || "dummy-key-for-now",
  baseURL: aiBaseUrl,
  defaultHeaders: process.env.OPENROUTER_API_KEY ? {
    "HTTP-Referer": "https://thinker-ai.netlify.app", // Optional for OpenRouter
    "X-Title": "Thinker AI"
  } : {}
});

// Setup Multer for file uploads
const upload = multer({ dest: "uploads/" });

let codes = {}; // store verification codes
let userSubscriptions = {}; // { email: planName }
let userUsage = {}; // { email: { count: number, date: string } }
let registeredUsers = {}; // { email: { name: string, email: string, joinedAt: Date } }

// Helper function to check and update daily limits
function checkLimit(email, plan) {
    if (plan === "Pro" || plan === "Team" || plan === "Enterprise") return { allowed: true };
    
    const limit = plan === "Basic" ? 500 : 100;
    const today = new Date().toISOString().split('T')[0];

    
    // Initialize or reset daily usage
    if (!userUsage[email] || userUsage[email].date !== today) {
        userUsage[email] = { count: 0, date: today };
    }
    
    if (userUsage[email].count >= limit) {
        return { allowed: false, limit };
    }
    
    userUsage[email].count += 1;
    return { allowed: true, remaining: limit - userUsage[email].count };
}

// Get appropriate model based on plan
function getModelForPlan(plan) {
    if (plan === "Pro" || plan === "Team" || plan === "Enterprise") {
        return process.env.GROQ_API_KEY ? "llama3-70b-8192" : "gpt-4o";
    } else if (plan === "Basic") {
        return process.env.GROQ_API_KEY ? "llama3-8b-8192" : "gpt-4o-mini";
    } else {
        // Free tier uses the cheapest/fastest model
        return process.env.OPENROUTER_API_KEY ? "meta-llama/llama-3-8b-instruct:free" : "gpt-4o-mini";
    }
}

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
    
    // Auto-register the user if they don't exist
    if (!registeredUsers[cleanEmail]) {
        registeredUsers[cleanEmail] = { name: cleanEmail.split('@')[0], email: cleanEmail, joinedAt: new Date() };
    }
    
    res.send({ success: true, plan: userSubscriptions[cleanEmail] || "Free" });
  } else {
    res.send({ success: false, error: "Invalid code" });
  }
});

// --- Subscription Management ---

// Get current user plan
app.post("/get-plan", (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).send({ error: "Email required" });
    const plan = userSubscriptions[email.trim()] || "Free";
    res.send({ plan });
});

// Update user plan (Simulated Checkout Success)
app.post("/update-plan", (req, res) => {
    const { email, plan } = req.body;
    if (!email || !plan) return res.status(400).send({ error: "Data missing" });
    
    console.log(`Upgrading ${email} to ${plan} plan`);
    userSubscriptions[email.trim()] = plan;
    res.send({ success: true, plan });
});

// Create Stripe Checkout Session (Mockup)
app.post("/create-checkout-session", async (req, res) => {
    const { email, plan, priceId } = req.body;
    
    // In a real app, you would use stripe.checkout.sessions.create here
    // For now, we simulate a successful redirect URL
    const sessionId = "sess_" + Math.random().toString(36).substring(7);
    const mockUrl = `https://thinkerai2.netlify.app/dashboard.html?session_id=${sessionId}&success=true&plan=${plan}`;
    
    res.send({ url: mockUrl });
});

// --- Team Management & Users ---

// Register new user (from Google Auth or Dashboard load)
app.post("/register-user", (req, res) => {
    const { email, name } = req.body;
    if (!email) return res.status(400).send({ error: "Email required" });
    
    const cleanEmail = email.trim();
    if (!registeredUsers[cleanEmail]) {
        registeredUsers[cleanEmail] = { 
            name: name || cleanEmail.split('@')[0], 
            email: cleanEmail, 
            joinedAt: new Date() 
        };
        console.log(`Registered new user: ${cleanEmail}`);
    }
    
    res.send({ success: true, user: registeredUsers[cleanEmail] });
});

// Get list of all registered users
app.get("/users", (req, res) => {
    const userList = Object.values(registeredUsers);
    
    const usersWithPlans = userList.map(u => ({
        ...u,
        plan: userSubscriptions[u.email] || "Free"
    }));
    
    res.send({ users: usersWithPlans });
});

// Add a user to a team
app.post("/add-team-member", (req, res) => {
    const { ownerEmail, targetEmail } = req.body;
    
    // Security check: Only people who actually have a Team plan can add members
    const ownerPlan = userSubscriptions[ownerEmail];
    if (ownerPlan !== "Team" && ownerPlan !== "Enterprise") {
        return res.status(403).send({ error: "Your current plan does not support adding team members. Please upgrade to Team." });
    }
    
    // Give the target user the Team plan
    userSubscriptions[targetEmail] = "Team";
    console.log(`${ownerEmail} added ${targetEmail} to their Team.`);
    
    res.send({ success: true, message: "Member added successfully!" });
});

// Chatbot integration
app.post("/chat", async (req, res) => {
  try {
    const { message, email } = req.body;
    if (!message) return res.status(400).send({ error: "Message is required" });
    
    const userEmail = email ? email.trim() : "guest";
    const plan = userSubscriptions[userEmail] || "Free";
    
    // 1. Enforce Limits
    const limitStatus = checkLimit(userEmail, plan);
    if (!limitStatus.allowed) {
        return res.send({ 
            error: true, 
            limitReached: true,
            reply: `🛑 You have reached your daily limit of ${limitStatus.limit} messages for the ${plan} Plan. Upgrade your plan to continue chatting without limits!` 
        });
    }

    // 2. Select Model dynamically
    let modelName = process.env.AI_MODEL || getModelForPlan(plan);

    const response = await openai.chat.completions.create({
      model: modelName,
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

    const email = req.body.email ? req.body.email.trim() : "guest";
    const plan = userSubscriptions[email] || "Free";

    // Enforce Limits
    const limitStatus = checkLimit(email, plan);
    if (!limitStatus.allowed) {
        return res.send({ 
            error: `You have reached your daily limit for the ${plan} Plan. Upgrade to continue.`
        });
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