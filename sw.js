// sw.js — UniApply SA Service Worker
// Provides offline support, PWA installability, and FCM push notifications.

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// ── Firebase config (must match firebase-config.js) ──────────
firebase.initializeApp({
  apiKey: "AIzaSyDtXP3V07tdONcboYjlkcke0I6nDxZyb34",
  authDomain: "uniapply-39179.firebaseapp.com",
  projectId: "uniapply-39179",
  storageBucket: "uniapply-39179.firebasestorage.app",
  messagingSenderId: "346861064515",
  appId: "1:346861064515:web:ffe59363b3c1b9380d1ff6"
});

const messaging = firebase.messaging();

// ── Background push message handler ──────────────────────────
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  const notificationTitle = title || "Univio SA";
  const notificationOptions = {
    body: body || "",
    icon: icon || "./icons/icon-192x192.png",
    badge: "./icons/icon-192x192.png",
    data: payload.data || {},
    tag: payload.data?.notificationId || "univio-notification",
    renotify: true
  };
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ── Notification click → focus/open app ──────────────────────
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("./index.html");
    })
  );
});

// ══════════════════════════════════════════════════════════════
// Standard PWA caching
// ══════════════════════════════════════════════════════════════
const CACHE_NAME = "univio-sa-v2";

const PRECACHE_URLS = [
  "./","./index.html","./universities.html","./news.html",
  "./bookmarks.html","./detail.html","./admin-login.html","./404.html",
  "./css/style.css","./js/app.js","./js/index.js","./js/universities.js",
  "./js/news.js","./js/bookmarks.js","./js/detail.js","./js/chat.js",
  "./js/firebase-config.js","./js/notifications.js","./manifest.json",
  "./icons/icon-192x192.png","./icons/icon-512x512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  const networkFirstDomains = [
    "firebaseapp.com","firestore.googleapis.com","identitytoolkit.googleapis.com",
    "googleapis.com","gstatic.com","cloudinary.com","fonts.googleapis.com",
    "fonts.gstatic.com","fcm.googleapis.com"
  ];
  if (networkFirstDomains.some(d => url.hostname.includes(d))) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  if (event.request.method === "GET") {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type === "opaque") return response;
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
          return response;
        }).catch(() => {
          if (event.request.headers.get("accept")?.includes("text/html"))
            return caches.match("./index.html");
        });
      })
    );
  }
});
