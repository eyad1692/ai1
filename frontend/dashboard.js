// API Configuration
const API_URL = "https://ai1-1-ya4z.onrender.com";

// State Management
let currentChatId = Date.now().toString();
let isRecording = false;
let recognition = null;
let chatHistory = JSON.parse(localStorage.getItem("thinker_history")) || [];

// DOM Elements
const chatDisplay = document.getElementById("chatDisplay");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const chatHistoryContainer = document.getElementById("chatHistory");
const userNameDisplay = document.getElementById("userName");
const userEmailDisplay = document.getElementById("userEmail");
const userAvatar = document.getElementById("userAvatar");

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    loadUserSettings();
    renderHistory();
    setupSpeechRecognition();
    
    // Set initial user info from session
    const email = sessionStorage.getItem("userEmail") || "guest@thinker.ai";
    const name = localStorage.getItem("thinker_user_name") || "Thinker User";
    
    userEmailDisplay.innerText = email;
    userNameDisplay.innerText = name;
    userAvatar.innerText = name.charAt(0).toUpperCase();
    document.getElementById("settingName").value = name;
});

// --- View Management ---
function switchView(viewId) {
    // Hide all views
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
    
    // Show target view
    const targetView = document.getElementById(viewId + "View");
    if (targetView) {
        targetView.classList.add("active");
    }
    
    // Highlight nav link
    const navLink = document.querySelector(`.nav-link[onclick*="${viewId}"]`);
    if (navLink) {
        navLink.classList.add("active");
    }
}

// --- Chat Logic ---
function appendMessage(text, sender, type = "text") {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${sender}`;
    
    if (type === "image") {
        const img = document.createElement("img");
        img.src = text;
        img.className = "ai-generated-image";
        img.alt = "AI Generated Image";
        msgDiv.appendChild(img);
    } else if (type === "file") {
        const link = document.createElement("a");
        link.href = text;
        link.className = "file-download-btn";
        link.innerHTML = `<i class="fas fa-file-pdf"></i> Download AI Generated Document`;
        link.download = "Thinker-AI-Document.pdf";
        msgDiv.appendChild(link);
    } else {
        msgDiv.innerText = text;
    }

    chatDisplay.appendChild(msgDiv);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
    
    // Save to history after AI response or user message
    saveCurrentChat();
}

async function sendMessage() {
    const msg = messageInput.value.trim();
    if (!msg) return;

    appendMessage(msg, "user");
    messageInput.value = "";
    messageInput.style.height = "auto"; // Reset height
    
    const originalContent = sendBtn.innerHTML;
    sendBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
    sendBtn.disabled = true;

    // Create a temporary "Thinking..." bubble
    const thinkingMsg = document.createElement("div");
    thinkingMsg.className = "message ai loading";
    thinkingMsg.innerHTML = '<i class="fas fa-brain fa-pulse"></i> Thinker is processing...';
    chatDisplay.appendChild(thinkingMsg);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;

    try {
        let endpoint = `${API_URL}/chat`;
        let body = { message: msg };
        let type = "text";

        // Logic to detect image/file request
        const lowerMsg = msg.toLowerCase();
        if (lowerMsg.includes("generate image") || lowerMsg.includes("create an image")) {
            endpoint = `${API_URL}/generate-image`;
            body = { prompt: msg };
            type = "image";
        } else if (lowerMsg.includes("generate file") || lowerMsg.includes("create a file") || lowerMsg.includes("summarize to pdf")) {
            endpoint = `${API_URL}/generate-file`;
            body = { content: msg };
            type = "file";
        }

        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        // Remove thinking bubble
        chatDisplay.removeChild(thinkingMsg);

        if (type === "file") {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            appendMessage(url, "ai", "file");
            return;
        }

        const data = await res.json();

        if (type === "image" && data.imageUrl) {
            appendMessage(data.imageUrl, "ai", "image");
        } else if (data.reply) {
            appendMessage(data.reply, "ai");
        } else {
            appendMessage("I encountered an issue processing that. Please try again.", "ai");
        }
    } catch (error) {
        if (chatDisplay.contains(thinkingMsg)) chatDisplay.removeChild(thinkingMsg);
        console.error("Chat error:", error);
        appendMessage("Connection error. Is the backend running?", "ai");
    } finally {
        sendBtn.innerHTML = originalContent;
        sendBtn.disabled = false;
    }
}

// --- Chat History ---
function saveCurrentChat() {
    const messages = Array.from(chatDisplay.children).map(div => ({
        sender: div.classList.contains("user") ? "user" : "ai",
        text: div.innerText
    })).filter(m => m.text.trim() !== ""); // Filter out empty/loading messages

    if (messages.length === 0) return;

    const existingIdx = chatHistory.findIndex(h => h.id === currentChatId);
    
    // Find first user message for title, or fallback
    const firstUserMsg = messages.find(m => m.sender === "user")?.text || "New Chat";
    const title = firstUserMsg.substring(0, 30) + (firstUserMsg.length > 30 ? "..." : "");

    const chatData = {
        id: currentChatId,
        title: title,
        messages: messages,
        timestamp: new Date().getTime()
    };

    if (existingIdx > -1) {
        chatHistory[existingIdx] = chatData;
    } else {
        chatHistory.unshift(chatData);
    }

    localStorage.setItem("thinker_history", JSON.stringify(chatHistory));
    renderHistory();
}

function renderHistory() {
    chatHistoryContainer.innerHTML = "";
    chatHistory.forEach(chat => {
        const item = document.createElement("div");
        item.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
        
        // Clean up any old "undefined" titles from localStorage
        const safeTitle = (chat.title === "undefined..." || !chat.title) ? "New Chat" : chat.title;
        
        item.innerHTML = `<i class="far fa-message"></i> ${safeTitle}`;
        item.onclick = () => loadChat(chat.id);
        chatHistoryContainer.appendChild(item);
    });
}

function loadChat(id) {
    const chat = chatHistory.find(h => h.id === id);
    if (!chat) return;

    currentChatId = id;
    chatDisplay.innerHTML = "";
    chat.messages.forEach(m => {
        const msgDiv = document.createElement("div");
        msgDiv.className = `message ${m.sender}`;
        msgDiv.innerText = m.text;
        chatDisplay.appendChild(msgDiv);
    });
    
    switchView('chat');
    renderHistory();
}

function startNewChat() {
    currentChatId = Date.now().toString();
    chatDisplay.innerHTML = `
        <div class="message ai">
            Hello! I am Thinker AI. How can I assist you with your creative or technical tasks today?
        </div>
    `;
    switchView('chat');
    renderHistory();
}

function clearHistory() {
    if (confirm("Are you sure you want to clear all chat history?")) {
        chatHistory = [];
        localStorage.removeItem("thinker_history");
        startNewChat();
    }
}

// --- Voice Recognition (100% Free - Uses Browser's Engine) ---

function setupSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isRecording = true;
            document.getElementById("micBtn").classList.add("mic-active");
            
            // Show toast or temporary info
            const toast = document.createElement("div");
            toast.className = "voice-toast";
            toast.innerText = "Listening...";
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        };

        recognition.onend = () => {
            isRecording = false;
            document.getElementById("micBtn").classList.remove("mic-active");
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            messageInput.value = transcript;
            autoResize(messageInput);
            messageInput.focus();
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            isRecording = false;
            document.getElementById("micBtn").classList.remove("mic-active");
        };
    } else {
        console.warn("Speech recognition not supported in this browser.");
    }
}

function toggleMic() {
    if (!recognition) {
        alert("Speech recognition is not supported in this browser. Try Chrome or Edge.");
        return;
    }

    if (isRecording) {
        recognition.stop();
    } else {
        recognition.start();
    }
}

// --- Templates ---
const templates = {
    code: "Act as a senior software engineer. Help me refactor this code for better performance and readability:\n\n[Paste code here]",
    write: "Write a compelling 500-word blog post about [Topic] targeting [Audience]. Ensure the tone is professional yet engaging.",
    image: "Generate a highly detailed AI image prompt for [Subject]. Include lighting, style (e.g., photorealistic, cyberpunk), and camera settings.",
    email: "Draft a professional email to [Recipient] regarding [Subject]. Suggest a clear call to action and maintain a polite tone.",
    research: "Summarize the following complex document or topic into a series of clear, easy-to-understand bullet points for a non-technical audience:\n\n[Topic or Raw Text]",
    social: "Generate a week's worth of highly engaging social media posts (Twitter, LinkedIn, Instagram) for [Brand/Topic]. Aim for a mix of educational, inspiring, and promotional content.",
    interview: "I am interviewing for a [Job Title] role at [Company]. Ask me 3 challenging industry-specific questions one by one, and provide feedback on my responses to help me improve.",
    data: "I have a dataset or problem regarding [Data/SQL/Excel]. Help me write the most efficient [SQL query / Python script / Formula] to achieve [Specific Goal].",
    translate: "Translate the following text into [Language] while maintaining the original tone and cultural nuances. Also provide a brief explanation of any idiomatic expressions used:\n\n[Text to translate]",
    legal: "Act as a legal expert. Summarize this contract or legal document, highlighting potential risks, key obligations, and important dates in simple language:\n\n[Legal Text]",
    travel: "Plan a [Duration] trip to [Destination] for [Group Type]. Include a day-by-day itinerary with local gems, budget tips, and any necessary travel advisories.",
    productivity: "I have the following tasks for today: [Tasks]. Help me prioritize them using the Eisenhower Matrix and suggest a time-blocked schedule for maximum efficiency.",
    story: "Write a [Genre] short story starting with the prompt: '[Prompt]'. Focus on vivid descriptions, emotional depth, and a compelling character arc.",
    marketing: "Develop a comprehensive marketing plan for a [Product/Service] targeting [Demographic]. Include SEO keywords, social media strategy, and three creative campaign ideas."
};

function useTemplate(type) {
    messageInput.value = templates[type];
    switchView('chat');
    messageInput.focus();
    autoResize(messageInput);
}

// --- Settings Persistence ---
function saveSettings() {
    const newName = document.getElementById("settingName").value.trim();
    const theme = document.getElementById("themeSelect").value;
    
    if (newName) {
        localStorage.setItem("thinker_user_name", newName);
        userNameDisplay.innerText = newName;
        userAvatar.innerText = newName.charAt(0).toUpperCase();
    }
    
    localStorage.setItem("thinker_theme", theme);
    applyTheme(theme);
    
    alert("Settings saved successfully!");
    switchView('chat');
}

function loadUserSettings() {
    const theme = localStorage.getItem("thinker_theme") || "dark";
    document.getElementById("themeSelect").value = theme;
    applyTheme(theme);
}

function applyTheme(theme) {
    console.log("Applying theme:", theme);
    let settings = {
        'dark': {
            '--bg-color': '#05070a',
            '--text-primary': '#f8fafc',
            '--text-secondary': '#94a3b8',
            '--panel-bg': 'rgba(255, 255, 255, 0.03)',
            '--border-color': 'rgba(255, 255, 255, 0.08)',
            '--primary-color': '#6366f1',
            '--primary-glow': 'rgba(99, 102, 241, 0.5)',
            '--accent-color': '#8b5cf6'
        },
        'light': {
            '--bg-color': '#f8fafc',
            '--text-primary': '#0f172a',
            '--text-secondary': '#64748b',
            '--panel-bg': 'rgba(0, 0, 0, 0.05)',
            '--border-color': 'rgba(0, 0, 0, 0.1)',
            '--primary-color': '#4f46e5',
            '--primary-glow': 'rgba(79, 70, 229, 0.3)',
            '--accent-color': '#7c3aed'
        },
        'midnight': {
            '--bg-color': '#000000',
            '--text-primary': '#f8fafc',
            '--text-secondary': '#94a3b8',
            '--panel-bg': 'rgba(255, 255, 255, 0.03)',
            '--border-color': 'rgba(255, 255, 255, 0.08)',
            '--primary-color': '#ffffff',
            '--primary-glow': 'rgba(255, 255, 255, 0.2)',
            '--accent-color': '#64748b'
        },
        'emerald': {
            '--bg-color': '#061a14',
            '--text-primary': '#ecfdf5',
            '--text-secondary': '#6ee7b7',
            '--panel-bg': 'rgba(16, 185, 129, 0.05)',
            '--border-color': 'rgba(16, 185, 129, 0.1)',
            '--primary-color': '#10b981',
            '--primary-glow': 'rgba(16, 185, 129, 0.5)',
            '--accent-color': '#34d399'
        },
        'cyber': {
            '--bg-color': '#04101e',
            '--text-primary': '#f0f9ff',
            '--text-secondary': '#7dd3fc',
            '--panel-bg': 'rgba(14, 165, 233, 0.05)',
            '--border-color': 'rgba(14, 165, 233, 0.1)',
            '--primary-color': '#0ea5e9',
            '--primary-glow': 'rgba(14, 165, 233, 0.5)',
            '--accent-color': '#38bdf8'
        },
        'sunset': {
            '--bg-color': '#1a0b2e',
            '--text-primary': '#fdf2f8',
            '--text-secondary': '#f9a8d4',
            '--panel-bg': 'rgba(236, 72, 153, 0.05)',
            '--border-color': 'rgba(236, 72, 153, 0.1)',
            '--primary-color': '#ec4899',
            '--primary-glow': 'rgba(236, 72, 153, 0.5)',
            '--accent-color': '#8b5cf6'
        },
        'lunar': {
            '--bg-color': '#111827',
            '--text-primary': '#f9fafb',
            '--text-secondary': '#d1d5db',
            '--panel-bg': 'rgba(249, 250, 251, 0.03)',
            '--border-color': 'rgba(249, 250, 251, 0.08)',
            '--primary-color': '#f9fafb',
            '--primary-glow': 'rgba(249, 250, 251, 0.2)',
            '--accent-color': '#9ca3af'
        },
        'crimson': {
            '--bg-color': '#1a0505',
            '--text-primary': '#fef2f2',
            '--text-secondary': '#fca5a5',
            '--panel-bg': 'rgba(239, 68, 68, 0.05)',
            '--border-color': 'rgba(239, 68, 68, 0.1)',
            '--primary-color': '#ef4444',
            '--primary-glow': 'rgba(239, 68, 68, 0.5)',
            '--accent-color': '#991b1b'
        }
    };

    const config = settings[theme] || settings['dark'];
    const root = document.documentElement;
    
    try {
        Object.keys(config).forEach(prop => {
            root.style.setProperty(prop, config[prop]);
        });
        console.log("Theme applied successfully");
    } catch (e) {
        console.error("Error applying theme:", e);
    }
}

// --- UI Utilities ---
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

// Handle Enter key for messaging
messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
