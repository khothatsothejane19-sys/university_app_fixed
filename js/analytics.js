// analytics.js — Lightweight in-house analytics
// Tracks events to Firestore. No third-party tools, no user accounts.
// Admin reads all data from the Analytics section in admin.html.

import { db } from "./firebase-config.js";
import {
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const EVENTS_COLL = "analytics_events";

// ── Core event logger ─────────────────────────────────────────
// Fire-and-forget: never blocks UI, silently fails if offline
async function logEvent(eventName, params = {}) {
  try {
    await addDoc(collection(db, EVENTS_COLL), {
      event:     eventName,
      page:      location.pathname.split("/").pop() || "index.html",
      referrer:  document.referrer ? new URL(document.referrer).pathname.split("/").pop() : "",
      ts:        serverTimestamp(),
      ...params
    });
  } catch (_) {
    // Silently ignore — analytics should never break the app
  }
}

// ── Public tracking functions ─────────────────────────────────

export function trackPageView() {
  logEvent("page_view");
}

export function trackUniversityViewed(uniId, uniName) {
  logEvent("university_viewed", { uniId, uniName });
}

export function trackApplyClick(uniId, uniName) {
  logEvent("apply_click", { uniId, uniName });
}

export function trackProspectusDownload(uniId, uniName) {
  logEvent("prospectus_downloaded", { uniId, uniName });
}

export function trackBookmarkAdded(uniId, uniName) {
  logEvent("bookmark_added", { uniId, uniName });
}

export function trackNotificationClicked(notifId, notifTitle) {
  logEvent("notification_clicked", { notifId, notifTitle });
}
