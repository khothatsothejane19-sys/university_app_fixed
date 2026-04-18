// notifications.js — FCM In-App Notifications Module
// Handles: FCM token registration, Firestore notification storage,
//          notification bell UI, 7-day auto-expiry, real-time updates.

import { db } from "./firebase-config.js";
import { trackNotificationClicked } from "./analytics.js";
import {
  collection, addDoc, getDocs, deleteDoc, doc, query,
  orderBy, where, serverTimestamp, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";
import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

// ── VAPID Key — replace with your actual VAPID public key from Firebase Console
// Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
export const VAPID_KEY = "YOUR_VAPID_PUBLIC_KEY_HERE";

const firebaseConfig = {
  apiKey: "AIzaSyDtXP3V07tdONcboYjlkcke0I6nDxZyb34",
  authDomain: "uniapply-39179.firebaseapp.com",
  projectId: "uniapply-39179",
  storageBucket: "uniapply-39179.firebasestorage.app",
  messagingSenderId: "346861064515",
  appId: "1:346861064515:web:ffe59363b3c1b9380d1ff6"
};

let messagingInstance = null;

function getMessagingInstance() {
  if (messagingInstance) return messagingInstance;
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

// ── Collections ───────────────────────────────────────────────
const NOTIF_COLL   = "notifications";   // stores notifications shown to all users
const TOKENS_COLL  = "fcm_tokens";      // stores device FCM tokens

// ── Local read-tracking (localStorage) ───────────────────────
const READ_KEY = "univio_read_notifs";

function getReadIds() {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]")); }
  catch { return new Set(); }
}

function markRead(id) {
  const ids = getReadIds();
  ids.add(id);
  localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
}

// ── FCM Token Registration ────────────────────────────────────
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  try {
    const messaging = getMessagingInstance();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) {
      await saveTokenToFirestore(token);
      listenForForegroundMessages();
    }
    return token;
  } catch (err) {
    console.warn("FCM token error:", err);
    return null;
  }
}

async function saveTokenToFirestore(token) {
  try {
    const snap = await getDocs(query(
      collection(db, TOKENS_COLL),
      where("token", "==", token)
    ));
    if (snap.empty) {
      await addDoc(collection(db, TOKENS_COLL), {
        token,
        createdAt: serverTimestamp(),
        userAgent: navigator.userAgent.substring(0, 200)
      });
    }
  } catch (err) {
    console.warn("Could not save FCM token:", err);
  }
}

// ── Foreground FCM message listener ──────────────────────────
function listenForForegroundMessages() {
  try {
    const messaging = getMessagingInstance();
    onMessage(messaging, payload => {
      // When app is open: store in Firestore (admin function already does this)
      // Just show a brief in-app toast if provided
      if (payload.notification?.title) {
        showNotifToast(payload.notification.title, payload.notification.body || "");
      }
    });
  } catch (err) {
    console.warn("Foreground message listener error:", err);
  }
}

// ── Firestore notification helpers ───────────────────────────
export async function pruneExpiredNotifications() {
  const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  try {
    const snap = await getDocs(query(
      collection(db, NOTIF_COLL),
      where("createdAt", "<", sevenDaysAgo)
    ));
    const deletes = snap.docs.map(d => deleteDoc(doc(db, NOTIF_COLL, d.id)));
    await Promise.all(deletes);
  } catch (err) {
    console.warn("Prune error:", err);
  }
}

export async function fetchNotifications() {
  const snap = await getDocs(
    query(collection(db, NOTIF_COLL), orderBy("createdAt", "desc"))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Real-time listener for notification bell count ────────────
let unsubscribeNotifs = null;

export function subscribeToNotifications(onUpdate) {
  if (unsubscribeNotifs) unsubscribeNotifs();
  unsubscribeNotifs = onSnapshot(
    query(collection(db, NOTIF_COLL), orderBy("createdAt", "desc")),
    snap => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      onUpdate(notifs);
    },
    err => console.warn("Notification snapshot error:", err)
  );
  return unsubscribeNotifs;
}

// ── Bell UI rendering ─────────────────────────────────────────
export function renderNotificationBell(container) {
  container.innerHTML = `
    <div class="notif-bell-wrap" id="notifBellWrap">
      <button class="notif-bell-btn" id="notifBellBtn" title="Notifications" aria-label="Notifications">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span class="notif-badge" id="notifBadge" style="display:none">0</span>
      </button>
      <div class="notif-dropdown" id="notifDropdown">
        <div class="notif-header">
          <span class="notif-title">Notifications</span>
          <button class="notif-mark-all" id="notifMarkAll">Mark all read</button>
        </div>
        <div class="notif-list" id="notifList">
          <div class="notif-empty">No notifications yet.</div>
        </div>
        <div class="notif-footer">
          <span class="notif-expire-note">Notifications expire after 7 days</span>
        </div>
      </div>
    </div>`;

  const btn      = container.querySelector("#notifBellBtn");
  const dropdown = container.querySelector("#notifDropdown");
  const markAll  = container.querySelector("#notifMarkAll");

  btn.addEventListener("click", e => {
    e.stopPropagation();
    const isOpen = dropdown.classList.toggle("open");
    if (isOpen) {
      loadAndRenderNotifs(container);
    }
  });

  markAll.addEventListener("click", () => {
    const items = container.querySelectorAll(".notif-item[data-id]");
    items.forEach(item => {
      markRead(item.dataset.id);
      item.classList.add("read");
    });
    updateBadge(container, 0);
  });

  document.addEventListener("click", e => {
    if (!container.contains(e.target)) {
      dropdown.classList.remove("open");
    }
  });

  // Subscribe to live updates for badge count
  subscribeToNotifications(notifs => {
    const readIds  = getReadIds();
    const unread   = notifs.filter(n => !readIds.has(n.id)).length;
    updateBadge(container, unread);
  });

  // Request FCM permission when bell is first rendered
  requestNotificationPermission();
  pruneExpiredNotifications();
}

async function loadAndRenderNotifs(container) {
  const list   = container.querySelector("#notifList");
  list.innerHTML = `<div class="notif-loading"><div class="loader-ring" style="width:20px;height:20px;border-width:2px"></div></div>`;

  try {
    const notifs = await fetchNotifications();
    const readIds = getReadIds();

    if (!notifs.length) {
      list.innerHTML = `<div class="notif-empty">No notifications yet.</div>`;
      return;
    }

    list.innerHTML = notifs.map(n => {
      const isRead   = readIds.has(n.id);
      const typeIcon = n.type === "news" ? "📰" : n.type === "open" ? "🟢" : n.type === "closed" ? "🔴" : "🔔";
      const timeAgo  = formatTimeAgo(n.createdAt?.toDate ? n.createdAt.toDate() : new Date(n.createdAt));
      return `
        <div class="notif-item ${isRead ? "read" : "unread"}" data-id="${n.id}">
          <div class="notif-icon">${typeIcon}</div>
          <div class="notif-body">
            <div class="notif-item-title">${escHtml(n.title)}</div>
            <div class="notif-item-msg">${escHtml(n.message || "")}</div>
            <div class="notif-item-time">${timeAgo}</div>
          </div>
          ${!isRead ? `<div class="notif-dot"></div>` : ""}
        </div>`;
    }).join("");

    // Mark individual as read on click
    list.querySelectorAll(".notif-item").forEach(item => {
      item.addEventListener("click", () => {
        markRead(item.dataset.id);
        item.classList.remove("unread");
        item.classList.add("read");
        item.querySelector(".notif-dot")?.remove();
        // Track notification click
        const titleEl = item.querySelector(".notif-item-title");
        trackNotificationClicked(item.dataset.id, titleEl ? titleEl.textContent : "");
        // Recount
        const unread = list.querySelectorAll(".notif-item.unread").length;
        updateBadge(container, unread);
      });
    });

    // Update badge
    const unread = notifs.filter(n => !readIds.has(n.id)).length;
    updateBadge(container, unread);

  } catch (err) {
    list.innerHTML = `<div class="notif-empty">Could not load notifications.</div>`;
    console.error(err);
  }
}

function updateBadge(container, count) {
  const badge = container.querySelector("#notifBadge");
  if (!badge) return;
  if (count > 0) {
    badge.style.display = "flex";
    badge.textContent = count > 99 ? "99+" : count;
  } else {
    badge.style.display = "none";
  }
}

// ── Utility: in-app toast for foreground FCM ─────────────────
function showNotifToast(title, body) {
  const tc = document.getElementById("toastContainer");
  if (!tc) return;
  const el = document.createElement("div");
  el.className = "toast toast-info show";
  el.innerHTML = `<strong>🔔 ${escHtml(title)}</strong>${body ? `<br><span style="font-size:0.8rem">${escHtml(body)}</span>` : ""}`;
  tc.appendChild(el);
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 5000);
}

// ── Admin helpers: write notifications to Firestore ───────────
export async function createNotification({ title, message, type }) {
  // type: "open" | "closed" | "news" | "general"
  return addDoc(collection(db, NOTIF_COLL), {
    title, message, type,
    createdAt: serverTimestamp()
  });
}

// ── Format helpers ────────────────────────────────────────────
function formatTimeAgo(date) {
  if (!date) return "";
  const diff = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function escHtml(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
