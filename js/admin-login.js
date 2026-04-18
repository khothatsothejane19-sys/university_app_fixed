// admin-login.js
import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Hide loader immediately
setTimeout(() => document.getElementById("pageLoader")?.classList.add("hidden"), 300);

// Redirect if already logged in
onAuthStateChanged(auth, user => {
  if (user) location.href = "admin.html";
});

const loginBtn  = document.getElementById("loginBtn");
const eyeBtn    = document.getElementById("eyeBtn");
const passInput = document.getElementById("adminPassword");
const errorEl   = document.getElementById("loginError");

loginBtn?.addEventListener("click", handleLogin);
passInput?.addEventListener("keydown", e => { if (e.key === "Enter") handleLogin(); });
eyeBtn?.addEventListener("click", () => {
  passInput.type = passInput.type === "password" ? "text" : "password";
  eyeBtn.textContent = passInput.type === "password" ? "👁️" : "🙈";
});

async function handleLogin() {
  const email = document.getElementById("adminEmail")?.value?.trim();
  const pass  = passInput?.value;
  if (!email || !pass) { showError("Please enter your email and password."); return; }

  loginBtn.textContent = "Signing in…";
  loginBtn.disabled    = true;
  if (errorEl) errorEl.style.display = "none";

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    location.href = "admin.html";
  } catch (err) {
    loginBtn.textContent = "Sign In to Admin";
    loginBtn.disabled    = false;
    showError(err.code === "auth/invalid-credential" || err.code === "auth/wrong-password"
      ? "Invalid email or password."
      : "Login failed. Please try again.");
  }
}

function showError(msg) {
  if (!errorEl) return;
  errorEl.textContent  = msg;
  errorEl.style.display = "block";
}
