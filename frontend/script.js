// Update this to your deployed Render URL later (e.g., "https://my-ai-backend.onrender.com")
// If hosting frontend & backend together, you can just use API_URL = ""
const API_URL = "https://ai1-1-ya4z.onrender.com";

async function sendCode() {
  const emailInput = document.getElementById("email");
  const email = emailInput.value;
  const sendCodeBtn = document.getElementById("sendCodeBtn");

  if (!email) return;

  // UI state change
  const originalText = sendCodeBtn.innerText;
  sendCodeBtn.innerHTML = '<span class="spinner"></span>';
  sendCodeBtn.disabled = true;

  try {
    const res = await fetch(`${API_URL}/send-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (data.success) {
      document.getElementById("emailForm").style.display = "none";
      document.getElementById("codeForm").style.display = "block";
      // Add small success message optionally
    } else {
      alert("Failed to send code: " + (data.error || "Unknown error"));
    }
  } catch (error) {
    console.error("Error sending code:", error);
    alert("Network error. Backend might not be running.");
  } finally {
    sendCodeBtn.innerHTML = originalText;
    sendCodeBtn.disabled = false;
  }
}

async function verifyCode() {
  const email = document.getElementById("email").value;
  const code = document.getElementById("code").value;
  const verifyBtn = document.getElementById("verifyBtn");

  if (!code) return;

  const originalText = verifyBtn.innerText;
  verifyBtn.innerHTML = '<span class="spinner"></span>';
  verifyBtn.disabled = true;

  try {
    const res = await fetch(`${API_URL}/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code })
    });

    const data = await res.json();

    if (data.success) {
      // Store session info if needed, then redirect
      sessionStorage.setItem("userEmail", email);
      window.location.href = "dashboard.html";
    } else {
      alert("Wrong code! Please try again.");
    }
  } catch (error) {
    console.error("Error verifying code:", error);
    alert("Network error.");
  } finally {
    verifyBtn.innerHTML = originalText;
    verifyBtn.disabled = false;
  }
}

// --- Firebase Configuration ---
// TODO: Replace with your actual Firebase config from the Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAMNheliqNAt1PsEz3FDCg3IwX0e_hRIgg",
  authDomain: "tech-621cb.firebaseapp.com",
  projectId: "tech-621cb",
  storageBucket: "tech-621cb.firebasestorage.app",
  messagingSenderId: "929581825072",
  appId: "1:929581825072:web:50b2e3a6826b12900d41f5",
  measurementId: "G-TKQZR68M1X"
};

// Initialize Firebase with safety checks
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const provider = new firebase.auth.GoogleAuthProvider();

  async function signInWithGoogle() {
    try {
      console.log("Starting Firebase Sign-In popup...");
      const result = await auth.signInWithPopup(provider);
      const user = result.user;
      
      console.log("Sign-in successful!");
      sessionStorage.setItem("userEmail", user.email);
      localStorage.setItem("thinker_user_name", user.displayName || "Thinker User");
      
      window.location.href = "dashboard.html";
    } catch (error) {
      console.error("Firebase Details:", error);
      
      // Give the user a clear error message depending on the failure
      if (error.code === 'auth/popup-blocked') {
        alert("Your browser blocked the login popup. Please click the button and check your address bar for a 'Blocked Popup' icon.");
      } else if (error.code === 'auth/unauthorized-domain') {
        alert("Unauthorized domain! You MUST add this URL to your 'Authorized Domains' in the Firebase Console Settings.");
      } else {
        alert("Login failed: " + error.message);
      }
    }
  }
} else {
  console.error("Firebase SDK not loaded.");
  function signInWithGoogle() {
    alert("The Google Sign-In system is still loading or was blocked by an extension. Please refresh the page.");
  }
}
