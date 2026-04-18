// chat.js — Floating Community Chat
// Real-time Firestore chat. Messages auto-delete after 30 days.
// Injected into every public page via a <script type="module"> tag.

import { db } from "./firebase-config.js";
import {
  collection, addDoc, query, orderBy, limit,
  onSnapshot, serverTimestamp, where, deleteDoc, doc, getDocs, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Constants ─────────────────────────────────────────────────
const COLLECTION   = "community_chat";
const MAX_MESSAGES = 100;        // show last 100 in UI
const NAME_KEY     = "univio_chat_name";
const THIRTY_DAYS  = 30 * 24 * 60 * 60 * 1000;

// ── State ─────────────────────────────────────────────────────
let unsubscribe  = null;   // Firestore listener
let isOpen       = false;
let userName     = localStorage.getItem(NAME_KEY) || "";
let unreadCount  = 0;
let atBottom     = true;

// ── Build HTML ────────────────────────────────────────────────
function buildWidget() {
  const html = `
  <!-- Chat Tab Trigger (slim, bottom-left, won't overlap send button) -->
  <button id="chatFab" aria-label="Open community chat" title="Community Chat">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    <span id="chatFabLabel">Chat</span>
    <span id="chatBadge" class="chat-badge" style="display:none">0</span>
  </button>

  <!-- Chat Panel -->
  <div id="chatPanel" class="chat-panel" role="dialog" aria-label="Community Chat" aria-hidden="true">

    <!-- Header -->
    <div class="chat-header">
      <div class="chat-header-info">
        <div class="chat-header-avatar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div>
          <div class="chat-header-title">Student Community</div>
          <div class="chat-header-sub" id="chatOnlineStatus">Loading…</div>
        </div>
      </div>
      <div class="chat-header-actions">
        <button id="chatMinimize" title="Close chat" aria-label="Close chat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <!-- Name prompt (shown until user sets a name) -->
    <div id="chatNamePrompt" class="chat-name-prompt" style="display:none">
      <p>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        What should we call you?
      </p>
      <div class="chat-name-input-row">
        <input type="text" id="chatNameInput" placeholder="Your name or nickname…" maxlength="24" autocomplete="off" />
        <button id="chatNameSave">Go →</button>
      </div>
    </div>

    <!-- Messages area -->
    <div id="chatMessages" class="chat-messages" role="log" aria-live="polite">
      <div class="chat-loading">
        <div class="chat-dots"><span></span><span></span><span></span></div>
      </div>
    </div>

    <!-- Scroll to bottom pill -->
    <button id="chatScrollBtn" class="chat-scroll-pill" style="display:none">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
      New messages
    </button>

    <!-- Input bar -->
    <div class="chat-input-bar">
      <textarea
        id="chatInput"
        placeholder="Ask something, help someone…"
        maxlength="500"
        rows="1"
        aria-label="Message input"
      ></textarea>
      <button id="chatSend" aria-label="Send message">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
    <div class="chat-footer-note">Public · Messages delete after 30 days</div>
  </div>`;

  const wrapper = document.createElement("div");
  wrapper.id = "chatRoot";
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
}

// ── Toggle open/close ─────────────────────────────────────────
function openChat() {
  isOpen = true;
  unreadCount = 0;
  document.getElementById("chatBadge").style.display = "none";
  document.getElementById("chatPanel").classList.add("open");
  document.getElementById("chatPanel").setAttribute("aria-hidden", "false");
  document.getElementById("chatFab").classList.add("active");
  document.getElementById("chatFab").setAttribute("aria-label", "Close community chat");

  if (!userName) {
    document.getElementById("chatNamePrompt").style.display = "flex";
    setTimeout(() => document.getElementById("chatNameInput")?.focus(), 300);
  } else {
    startListener();
    setTimeout(scrollToBottom, 100);
  }
}

function closeChat() {
  isOpen = false;
  document.getElementById("chatPanel").classList.remove("open");
  document.getElementById("chatPanel").setAttribute("aria-hidden", "true");
  document.getElementById("chatFab").classList.remove("active");
  document.getElementById("chatFab").setAttribute("aria-label", "Open community chat");
}

// ── Name prompt ───────────────────────────────────────────────
function saveName() {
  const input = document.getElementById("chatNameInput");
  const name  = input?.value.trim();
  if (!name) return;
  userName = name;
  localStorage.setItem(NAME_KEY, userName);
  document.getElementById("chatNamePrompt").style.display = "none";
  startListener();
  setTimeout(scrollToBottom, 200);
}

// ── Firestore real-time listener ──────────────────────────────
function startListener() {
  if (unsubscribe) return; // already listening

  const cutoff = Timestamp.fromMillis(Date.now() - THIRTY_DAYS);
  const q = query(
    collection(db, COLLECTION),
    where("createdAt", ">", cutoff),
    orderBy("createdAt", "asc"),
    limit(MAX_MESSAGES)
  );

  unsubscribe = onSnapshot(q, snapshot => {
    const msgs = document.getElementById("chatMessages");
    if (!msgs) return;

    // Update online status with message count
    const count = snapshot.size;
    const statusEl = document.getElementById("chatOnlineStatus");
    if (statusEl) statusEl.textContent = `${count} message${count !== 1 ? "s" : ""} · Open to all`;

    // Track scroll position before render
    const wasAtBottom = atBottom;

    // Render all messages
    msgs.innerHTML = snapshot.docs.length === 0
      ? `<div class="chat-empty">
          <div class="chat-empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div>
          <p>No messages yet. Be the first to ask something!</p>
        </div>`
      : snapshot.docs.map(d => renderMessage(d.id, d.data())).join("");

    // Badge for unread when panel is closed
    if (!isOpen) {
      unreadCount++;
      const badge = document.getElementById("chatBadge");
      badge.textContent = unreadCount > 9 ? "9+" : unreadCount;
      badge.style.display = "flex";
    }

    if (wasAtBottom) scrollToBottom();
  }, err => {
    console.warn("Chat listener error:", err);
  });
}

// ── Render a single message ───────────────────────────────────
function renderMessage(id, data) {
  const isMe  = data.name === userName;
  const time  = data.createdAt?.toDate
    ? data.createdAt.toDate().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })
    : "";
  const date  = data.createdAt?.toDate
    ? data.createdAt.toDate().toLocaleDateString("en-ZA", { day: "numeric", month: "short" })
    : "";
  const initials = (data.name || "?").charAt(0).toUpperCase();
  const colorClass = nameToColor(data.name || "");

  // Sanitise message text
  const text = (data.message || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<div class="chat-msg ${isMe ? "chat-msg-me" : "chat-msg-them"}">
    ${!isMe ? `<div class="chat-avatar ${colorClass}">${initials}</div>` : ""}
    <div class="chat-bubble-wrap">
      ${!isMe ? `<div class="chat-name">${esc(data.name)}</div>` : ""}
      <div class="chat-bubble">${linkify(text)}</div>
      <div class="chat-time">${date} · ${time}</div>
    </div>
  </div>`;
}

// ── Send message ──────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById("chatInput");
  const text  = input?.value.trim();
  if (!text || !userName) return;

  input.value = "";
  resizeTextarea(input);

  const sendBtn = document.getElementById("chatSend");
  sendBtn.disabled = true;

  try {
    await addDoc(collection(db, COLLECTION), {
      name:      userName,
      message:   text,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + THIRTY_DAYS)
    });
    scrollToBottom();
  } catch (err) {
    console.error("Send failed:", err);
    // Re-populate input on failure
    input.value = text;
    alert("Message failed to send. Check your connection.");
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

// ── Auto-delete old messages (runs once on open) ───────────────
async function pruneOldMessages() {
  try {
    const cutoff = Timestamp.fromMillis(Date.now() - THIRTY_DAYS);
    const q    = query(collection(db, COLLECTION), where("createdAt", "<", cutoff), limit(50));
    const snap = await getDocs(q);
    snap.docs.forEach(d => deleteDoc(doc(db, COLLECTION, d.id)));
  } catch { /* silent — not critical */ }
}

// ── Scroll helpers ────────────────────────────────────────────
function scrollToBottom() {
  const msgs = document.getElementById("chatMessages");
  if (msgs) {
    msgs.scrollTop = msgs.scrollHeight;
    atBottom = true;
    document.getElementById("chatScrollBtn").style.display = "none";
  }
}

// ── Auto-resize textarea ──────────────────────────────────────
function resizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

// ── Utilities ─────────────────────────────────────────────────
function esc(str) {
  return (str || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function linkify(text) {
  return text.replace(
    /(https?:\/\/[^\s<]+)/g,
    `<a href="$1" target="_blank" rel="noopener noreferrer" style="color:var(--green-light);text-decoration:underline">$1</a>`
  );
}

const COLORS = ["cc-blue","cc-green","cc-gold","cc-red","cc-purple","cc-teal","cc-orange"];
function nameToColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

// ── Wire up events ────────────────────────────────────────────
function bindEvents() {
  // FAB toggle
  document.getElementById("chatFab").addEventListener("click", () => {
    isOpen ? closeChat() : openChat();
  });

  // Minimize
  document.getElementById("chatMinimize").addEventListener("click", closeChat);

  // Name save — button
  document.getElementById("chatNameSave").addEventListener("click", saveName);

  // Name save — Enter key
  document.getElementById("chatNameInput").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); saveName(); }
  });

  // Send — button
  document.getElementById("chatSend").addEventListener("click", sendMessage);

  // Send — Enter (Shift+Enter = newline)
  document.getElementById("chatInput").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // Auto-resize textarea
  document.getElementById("chatInput").addEventListener("input", e => {
    resizeTextarea(e.target);
  });

  // Track scroll position
  document.getElementById("chatMessages").addEventListener("scroll", () => {
    const msgs = document.getElementById("chatMessages");
    const threshold = 80;
    atBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < threshold;
    document.getElementById("chatScrollBtn").style.display = atBottom ? "none" : "flex";
  }, { passive: true });

  // Scroll pill click
  document.getElementById("chatScrollBtn").addEventListener("click", scrollToBottom);

  // Close on backdrop click (mobile)
  document.addEventListener("click", e => {
    if (!isOpen) return;
    const panel = document.getElementById("chatPanel");
    const fab   = document.getElementById("chatFab");
    if (!panel.contains(e.target) && !fab.contains(e.target)) closeChat();
  });

  // Escape key
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && isOpen) closeChat();
  });
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  buildWidget();
  bindEvents();
  pruneOldMessages(); // silently clean old messages once per session

  // Register service worker for PWA
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

// Run after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
