# 🔔 FCM Notifications — Complete Setup Guide
## Univio SA — Firebase Cloud Messaging

---

## What Was Implemented

- **Notification bell** in the navbar on every page (🔔 icon with unread count badge)
- **In-app notification panel** — click the bell to see all notifications
- **7-day auto-expiry** — old notifications are automatically deleted from Firestore
- **Auto-triggers** — notifications fire when:
  - Admin adds a new university
  - Admin changes a university's status (open / closed / coming soon)
  - Admin publishes a news post
- **Foreground FCM** — if the app is open, a toast appears instantly
- **Background FCM** — if the app is closed/minimised, the device shows a system push notification

---

## STEP 1 — Enable Cloud Messaging in Firebase Console

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Open your project: **uniapply-39179**
3. Click **Project Settings** (gear icon ⚙️ top left)
4. Click the **Cloud Messaging** tab
5. Under **Web Push certificates**, click **Generate key pair**
6. Copy the **Key pair** value — this is your **VAPID public key**

---

## STEP 2 — Add Your VAPID Key to notifications.js

Open `js/notifications.js` and replace line 18:

```js
// BEFORE:
export const VAPID_KEY = "YOUR_VAPID_PUBLIC_KEY_HERE";

// AFTER (paste your actual key):
export const VAPID_KEY = "BExample_abc123xyz...your_full_key_here";
```

> ⚠️ This is the **only** placeholder you need to fill in. Everything else is already wired up.

---

## STEP 3 — Deploy Firestore Security Rules

These rules allow users to **read** notifications but only the **admin** can write them.

### Option A — Firebase CLI (recommended)
```bash
# In your project folder
firebase deploy --only firestore:rules
```

### Option B — Firebase Console
1. Go to **Firestore Database** → **Rules** tab
2. Paste the contents of `firestore.rules` into the editor
3. Click **Publish**

---

## STEP 4 — Create the Firestore `notifications` Collection

Firestore creates collections automatically when the first document is written,
so you don't need to manually create it. It will appear after the first admin action.

**However**, to set up the index for sorting by date, run this in Firebase CLI:
```bash
firebase deploy --only firestore:indexes
```

Or it will be created automatically on first query (may show a console warning the first time).

---

## STEP 5 — Enable the Messaging API in Google Cloud

Firebase Cloud Messaging needs the **Firebase Cloud Messaging API (V1)** enabled.

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (**uniapply-39179**)
3. Go to **APIs & Services** → **Library**
4. Search for **"Firebase Cloud Messaging API"**
5. Click it → Click **Enable**

This is required for sending notifications server-side (step 6 below).

---

## STEP 6 — Server-Side: Send Push Notifications (Cloud Functions)

The app stores notifications in Firestore and users read them in-app.
For **actual device push notifications** (system-level, when app is closed),
you need a server to call the FCM API.

### Recommended: Firebase Cloud Functions

Create a file `functions/index.js` in your project:

```js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp }     = require("firebase-admin/app");
const { getMessaging }      = require("firebase-admin/messaging");
const { getFirestore }      = require("firebase-admin/firestore");

initializeApp();

exports.sendNotificationOnCreate = onDocumentCreated(
  "notifications/{notifId}",
  async (event) => {
    const data = event.data.data();
    if (!data) return;

    const db     = getFirestore();
    const tokens = await db.collection("fcm_tokens").get();
    const fcmTokens = tokens.docs.map(d => d.data().token).filter(Boolean);

    if (!fcmTokens.length) return;

    // Send in batches of 500 (FCM limit)
    const chunks = [];
    for (let i = 0; i < fcmTokens.length; i += 500) {
      chunks.push(fcmTokens.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      await getMessaging().sendEachForMulticast({
        tokens: chunk,
        notification: {
          title: data.title,
          body:  data.message || "",
        },
        webpush: {
          notification: {
            icon: "https://your-deployed-site.web.app/icons/icon-192x192.png"
          }
        }
      });
    }
  }
);
```

### Deploy the function:
```bash
cd functions
npm install firebase-functions firebase-admin
cd ..
firebase deploy --only functions
```

> 💡 Every time the admin creates a notification (by changing university status
> or posting news), the Cloud Function fires automatically and sends a push
> to every registered device.

---

## STEP 7 — Deploy the Updated App

```bash
firebase deploy --only hosting
```

Or deploy everything at once:
```bash
firebase deploy
```

---

## STEP 8 — Test It End-to-End

1. Open your deployed site in **Chrome** or **Firefox**
2. You will see a **🔔 bell icon** in the navbar
3. Click the bell → a permission prompt appears → click **Allow**
4. Open the **Admin panel** → Add or update a university / publish news
5. The bell badge should increment with a green dot
6. Click the bell to read the notification
7. If the browser tab is in background, you should also receive a **system push notification**

---

## File Changes Summary

| File | What Changed |
|------|-------------|
| `sw.js` | Full rewrite — now imports Firebase Messaging compat SDK for background push |
| `js/notifications.js` | **New file** — all notification logic (bell UI, Firestore read/write, FCM token) |
| `js/admin.js` | Added `createNotification()` calls in `saveUniversity`, `cycleStatus`, `saveNewsPost` |
| `index.html` | Bell container + init script added to navbar |
| `universities.html` | Bell container + init script added to navbar |
| `news.html` | Bell container + init script added to navbar |
| `bookmarks.html` | Bell container + init script added to navbar |
| `detail.html` | Bell container + init script added to navbar |
| `css/style.css` | Bell, badge, dropdown, notification item styles appended |
| `firestore.rules` | **New file** — security rules for notifications + fcm_tokens collections |
| `firebase.json` | Updated to reference firestore.rules |

---

## Troubleshooting

**Bell shows but no notifications appear**
→ Check browser console for Firestore permission errors.
→ Make sure you deployed the updated `firestore.rules`.

**"Messaging: A problem occurred while subscribing the user to FCM"**
→ You haven't set the VAPID key yet. Follow Step 2.

**Notifications appear in-app but no system push on mobile**
→ The Cloud Function in Step 6 is required for system-level push.
→ Without it, in-app notifications still work, but the device won't be woken up.

**FCM token not saving**
→ Check your Firestore rules allow `create` and `update` on `fcm_tokens`.

**Old service worker is still active**
→ Open DevTools → Application → Service Workers → click "Unregister", then reload.
