// ============================================================
//  app.js — Shared utilities (imported by every page script)
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection, getDocs, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  trackPageView, trackBookmarkAdded, trackApplyClick, trackProspectusDownload
} from "./analytics.js";

// ── Hide loader as soon as this module runs ──────────────────
function hideLoader() {
  const loader = document.getElementById("pageLoader");
  if (loader) loader.classList.add("hidden");
}
// Hide after a short delay so styles have painted
setTimeout(hideLoader, 400);
// Also hide on window load as a fallback
window.addEventListener("load", () => setTimeout(hideLoader, 200));

const MOON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const SUN_SVG  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

// ── Dark Mode ─────────────────────────────────────────────────
const DARK_KEY = "uniapply_dark";
function applyDarkMode(on) {
  document.body.classList.toggle("dark-mode", on);
  const btn = document.getElementById("darkModeToggle");
  if (btn) btn.innerHTML = on ? SUN_SVG : MOON_SVG;
}
const savedDark = localStorage.getItem(DARK_KEY) === "true";
applyDarkMode(savedDark);

// ── Analytics: track every page view ─────────────────────────
document.addEventListener("DOMContentLoaded", () => trackPageView());
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("darkModeToggle");
  if (btn) {
    btn.addEventListener("click", () => {
      const isDark = document.body.classList.toggle("dark-mode");
      localStorage.setItem(DARK_KEY, isDark);
      btn.innerHTML = isDark ? SUN_SVG : MOON_SVG;
    });
  }
});

// ── Back to Top ───────────────────────────────────────────────
window.addEventListener("scroll", () => {
  const btn = document.getElementById("backToTop");
  if (btn) btn.classList.toggle("visible", window.scrollY > 400);
}, { passive: true });
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("backToTop")?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

const HAMBURGER_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
const CLOSE_SVG     = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

// ── Mobile Nav ───────────────────────────────────────────────
const hamburger  = document.getElementById("hamburger");
const mobileMenu = document.getElementById("mobileMenu");
if (hamburger && mobileMenu) {
  hamburger.addEventListener("click", () => {
    mobileMenu.classList.toggle("open");
    hamburger.innerHTML = mobileMenu.classList.contains("open") ? CLOSE_SVG : HAMBURGER_SVG;
  });
}

// ── Bookmarks ────────────────────────────────────────────────
export function getBookmarks() {
  try { return JSON.parse(localStorage.getItem("uniapply_bm") || "[]"); }
  catch { return []; }
}

export function saveBookmarks(arr) {
  localStorage.setItem("uniapply_bm", JSON.stringify(arr));
  updateBookmarkCount();
}

export function toggleBookmark(id) {
  let bm = getBookmarks();
  if (bm.includes(id)) {
    bm = bm.filter(x => x !== id);
    showToast("Bookmark removed", "warning");
  } else {
    bm.push(id);
    showToast("Bookmarked!");
    // Track bookmark — look up name from card DOM if available
    const nameEl = document.querySelector(`.uni-bookmark-btn[data-id="${id}"]`)
      ?.closest(".uni-card")?.querySelector(".uni-name");
    const uniName = nameEl ? nameEl.textContent.trim() : id;
    trackBookmarkAdded(id, uniName);
  }
  saveBookmarks(bm);
  const BOOKMARK_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
  const LINK_SVG     = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
  document.querySelectorAll(`.uni-bookmark-btn[data-id="${id}"]`).forEach(btn => {
    btn.classList.toggle("saved", bm.includes(id));
    btn.innerHTML = bm.includes(id) ? BOOKMARK_SVG : LINK_SVG;
  });
}

export function updateBookmarkCount() {
  const bm = getBookmarks();
  const el = document.getElementById("navBookmarkCount");
  if (!el) return;
  el.textContent    = bm.length;
  el.style.display  = bm.length > 0 ? "flex" : "none";
}
updateBookmarkCount();

// Make toggleBookmark available to inline onclick=""
window._toggleBookmark = toggleBookmark;

// Make analytics helpers available to inline onclick=""
window._trackApply = (id, name) => trackApplyClick(id, name);
window._trackPro   = (id, name) => trackProspectusDownload(id, name);

// ── Toast ────────────────────────────────────────────────────
export function showToast(msg, type = "success", duration = 3200) {
  const c = document.getElementById("toastContainer");
  if (!c) return;
  const icons = {
    success: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    warning: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  };
  const t = document.createElement("div");
  t.className = `toast${type === "error" ? " error" : type === "warning" ? " warning" : ""}`;
  t.innerHTML = `<span class="toast-icon">${icons[type] || icons.success}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add("fadeOut"); setTimeout(() => t.remove(), 350); }, duration);
}

// ── Helpers ──────────────────────────────────────────────────
export function formatDate(str) {
  if (!str) return "TBA";
  try { return new Date(str).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return str; }
}

export function statusBadge(status) {
  const map = {
    open:        { cls: "status-open",   label: "Open" },
    closed:      { cls: "status-closed", label: "Closed" },
    coming_soon: { cls: "status-coming", label: "Coming Soon" }
  };
  const s = map[status] || map.closed;
  return `<span class="status-badge ${s.cls}"><span class="dot"></span>${s.label}</span>`;
}

export function typeLabel(type) {
  return { university: "Traditional University", university_of_technology: "University of Technology", comprehensive: "Comprehensive University" }[type] || "University";
}

export function countdownHTML(closeDateStr, status) {
  if (status === "closed")      return `<div class="countdown-wrap"><span class="countdown-expired"><svg width="10" height="10" viewBox="0 0 10 10" style="display:inline;vertical-align:middle;margin-right:4px"><circle cx="5" cy="5" r="5" fill="#ef4444"/></svg>Applications Closed</span></div>`;
  if (status === "coming_soon") return `<div class="countdown-wrap"><span class="countdown-expired" style="color:var(--gold)"><svg width="10" height="10" viewBox="0 0 10 10" style="display:inline;vertical-align:middle;margin-right:4px"><circle cx="5" cy="5" r="5" fill="#eab308"/></svg>Not Yet Open</span></div>`;
  if (!closeDateStr) return "";
  const diff = new Date(closeDateStr) - new Date();
  if (diff <= 0) return `<div class="countdown-wrap"><span class="countdown-expired"><svg width="10" height="10" viewBox="0 0 10 10" style="display:inline;vertical-align:middle;margin-right:4px"><circle cx="5" cy="5" r="5" fill="#ef4444"/></svg>Deadline Passed</span></div>`;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `<div class="countdown-wrap">
    <span class="countdown-label">Closes in</span>
    <div class="countdown-timer">
      <div class="countdown-unit"><div class="countdown-num">${String(d).padStart(2,"0")}</div><div class="countdown-tag">days</div></div>
      <span class="countdown-sep">:</span>
      <div class="countdown-unit"><div class="countdown-num">${String(h).padStart(2,"0")}</div><div class="countdown-tag">hrs</div></div>
      <span class="countdown-sep">:</span>
      <div class="countdown-unit"><div class="countdown-num">${String(m).padStart(2,"0")}</div><div class="countdown-tag">min</div></div>
    </div>
  </div>`;
}

// ── University Card Builder ───────────────────────────────────
export function buildUniCard(uni, delay = 0) {
  const id    = uni.id;
  const saved = getBookmarks().includes(id);
  const logo  = uni.logoUrl
    ? `<img src="${uni.logoUrl}" alt="${uni.name}" loading="lazy" />`
    : `<span class="uni-logo-placeholder">${(uni.shortCode || uni.name || "U").charAt(0)}</span>`;

  const applyBtn = uni.applyUrl
    ? `<a href="${uni.applyUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" onclick="window._trackApply('${uni.id}','${(uni.name||'').replace(/'/g,'')}')">Apply Now</a>`
    : `<button class="btn btn-primary btn-sm" disabled style="opacity:0.45;cursor:not-allowed">Coming Soon</button>`;

  const proBtn = uni.prospectusUrl
    ? `<a href="${uni.prospectusUrl}" download target="_blank" rel="noopener" class="btn btn-sm" style="background:var(--cream);border:1.5px solid var(--grey-light);color:var(--black)" title="Download Prospectus PDF" onclick="window._trackPro('${uni.id}','${(uni.name||'').replace(/'/g,'')}')">Download Prospectus</a>`
    : `<button class="btn btn-sm" disabled style="opacity:0.35;background:var(--cream);border:1.5px solid var(--grey-light);cursor:not-allowed" title="No prospectus uploaded yet">No Prospectus</button>`;

  return `<div class="uni-card" style="animation-delay:${delay}ms">
    <div class="uni-card-top-accent"></div>
    <div class="uni-card-header">
      <a href="detail.html?id=${id}" style="display:contents">
        <div class="uni-logo-wrap" style="cursor:pointer">${logo}</div>
      </a>
      <div class="uni-card-title-wrap">
        <a href="detail.html?id=${id}" style="text-decoration:none;color:inherit">
          <div class="uni-name" style="transition:color 0.2s" onmouseover="this.style.color='var(--green)'" onmouseout="this.style.color=''">${uni.name || "Unknown"}</div>
        </a>
        <div class="uni-location" style="display:flex;align-items:center;gap:4px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${[uni.city, uni.province].filter(Boolean).join(", ")}
        </div>
        <div style="margin-top:4px;font-size:0.7rem;color:var(--grey-mid)">${typeLabel(uni.type)}</div>
      </div>
      <button class="uni-bookmark-btn ${saved ? "saved" : ""}" data-id="${id}"
        onclick="window._toggleBookmark('${id}')" title="${saved ? "Remove bookmark" : "Save bookmark"}">
        ${saved
          ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
          : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
        }
      </button>
    </div>
    <div class="uni-card-body">
      <div class="uni-card-status-row">
        ${statusBadge(uni.status)}
        ${uni.applicationFee ? `<span style="font-size:0.76rem;color:var(--grey-mid);font-family:var(--font-mono)">Fee: R${uni.applicationFee}</span>` : ""}
      </div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Opens</div><div class="info-value">${formatDate(uni.openDate)}</div></div>
        <div class="info-item"><div class="info-label">Closes</div><div class="info-value">${formatDate(uni.closeDate)}</div></div>
        <div class="info-item"><div class="info-label">Min APS</div><div class="info-value aps">${uni.minAps ?? "N/A"}</div></div>
        <div class="info-item"><div class="info-label">Province</div><div class="info-value" style="font-size:0.8rem">${uni.province || "—"}</div></div>
      </div>
      ${countdownHTML(uni.closeDate, uni.status)}
      ${uni.description ? `<p style="font-size:0.8rem;color:var(--grey-dark);line-height:1.5;margin-top:2px">${uni.description.slice(0, 120)}${uni.description.length > 120 ? "…" : ""}</p>` : ""}
    </div>
    <div class="uni-card-footer">
      ${applyBtn}
      ${proBtn}
      <a href="detail.html?id=${id}" class="btn btn-sm" style="background:var(--cream);border:1.5px solid var(--grey-light);color:var(--black);flex:0 0 auto" title="View full details"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></a>
    </div>
  </div>`;
}

// ── Fetch Universities ────────────────────────────────────────
export async function fetchUniversities() {
  try {
    const snap = await getDocs(query(collection(db, "universities"), orderBy("name")));
    if (!snap.empty) return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return SEED_DATA; // fallback when Firestore is empty/not configured
  } catch (e) {
    console.warn("Firestore unavailable, using seed data:", e.message);
    return SEED_DATA;
  }
}

export async function fetchNews() {
  try {
    const snap = await getDocs(query(collection(db, "news"), orderBy("date", "desc")));
    if (!snap.empty) return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return SEED_NEWS;
  } catch (e) {
    console.warn("Firestore unavailable, using seed news:", e.message);
    return SEED_NEWS;
  }
}

// ── Seed Data (shown before Firebase is wired up) ─────────────
export const SEED_DATA = [
  { id:"uct",  name:"University of Cape Town",           shortCode:"UCT",  province:"Western Cape",   city:"Cape Town",          type:"university",              status:"open",        openDate:"2025-04-01", closeDate:"2025-09-30", minAps:36, applicationFee:100,  applyUrl:"https://www.uct.ac.za/study/apply",         prospectusUrl:"", description:"Africa's leading university, ranked #1 on the continent. Known for excellence in medicine, law and engineering.",           logoUrl:"" },
  { id:"wits", name:"University of the Witwatersrand",   shortCode:"WITS", province:"Gauteng",         city:"Johannesburg",       type:"university",              status:"open",        openDate:"2025-04-01", closeDate:"2025-09-26", minAps:35, applicationFee:100,  applyUrl:"https://www.wits.ac.za/registration/",      prospectusUrl:"", description:"A world-class research university with strengths in mining engineering, medicine and the humanities.",                   logoUrl:"" },
  { id:"up",   name:"University of Pretoria",            shortCode:"UP",   province:"Gauteng",         city:"Pretoria",           type:"university",              status:"open",        openDate:"2025-03-01", closeDate:"2025-09-30", minAps:30, applicationFee:300,  applyUrl:"https://www.up.ac.za/apply",                prospectusUrl:"", description:"One of South Africa's largest residential universities. Renowned for veterinary science and engineering.",                 logoUrl:"" },
  { id:"ukzn", name:"University of KwaZulu-Natal",       shortCode:"UKZN", province:"KwaZulu-Natal",   city:"Durban",             type:"university",              status:"open",        openDate:"2025-04-01", closeDate:"2025-09-30", minAps:28, applicationFee:200,  applyUrl:"https://www.ukzn.ac.za/apply",              prospectusUrl:"", description:"A dynamic, multi-campus institution in KwaZulu-Natal known for strong research output and diverse programmes.",            logoUrl:"" },
  { id:"uj",   name:"University of Johannesburg",        shortCode:"UJ",   province:"Gauteng",         city:"Johannesburg",       type:"comprehensive",           status:"open",        openDate:"2025-04-01", closeDate:"2025-09-30", minAps:28, applicationFee:200,  applyUrl:"https://www.uj.ac.za/apply",                prospectusUrl:"", description:"A vibrant cosmopolitan university offering a wide range of academic, professional and vocational programmes.",             logoUrl:"" },
  { id:"sun",  name:"Stellenbosch University",           shortCode:"SUN",  province:"Western Cape",   city:"Stellenbosch",       type:"university",              status:"closed",      openDate:"2025-03-01", closeDate:"2025-07-31", minAps:34, applicationFee:100,  applyUrl:"https://www.sun.ac.za/apply",               prospectusUrl:"", description:"Renowned university known for agriculture, engineering and medical sciences.",                                              logoUrl:"" },
  { id:"nwu",  name:"North-West University",             shortCode:"NWU",  province:"North West",      city:"Potchefstroom",      type:"comprehensive",           status:"open",        openDate:"2025-04-01", closeDate:"2025-10-31", minAps:24, applicationFee:150,  applyUrl:"https://www.nwu.ac.za/apply",               prospectusUrl:"", description:"A multi-campus university spanning three provinces with a strong research culture.",                                        logoUrl:"" },
  { id:"ufs",  name:"University of the Free State",      shortCode:"UFS",  province:"Free State",      city:"Bloemfontein",       type:"university",              status:"coming_soon", openDate:"2025-08-01", closeDate:"2025-11-30", minAps:26, applicationFee:150,  applyUrl:"https://www.ufs.ac.za/apply",               prospectusUrl:"", description:"A proudly South African university in the heart of the country with an inclusive campus culture.",                          logoUrl:"" },
  { id:"ru",   name:"Rhodes University",                 shortCode:"RU",   province:"Eastern Cape",    city:"Makhanda",           type:"university",              status:"open",        openDate:"2025-04-01", closeDate:"2025-09-30", minAps:32, applicationFee:100,  applyUrl:"https://www.ru.ac.za/admissions/",          prospectusUrl:"", description:"A small but academically excellent university known for journalism, law, pharmacy and sciences.",                           logoUrl:"" },
  { id:"tut",  name:"Tshwane University of Technology",  shortCode:"TUT",  province:"Gauteng",         city:"Pretoria",           type:"university_of_technology",status:"open",        openDate:"2025-04-01", closeDate:"2025-09-30", minAps:20, applicationFee:240,  applyUrl:"https://www.tut.ac.za/apply",               prospectusUrl:"", description:"Africa's largest residential university offering career-focused qualifications in technology and applied sciences.",         logoUrl:"" },
  { id:"cput", name:"Cape Peninsula Univ. of Technology",shortCode:"CPUT", province:"Western Cape",   city:"Cape Town",          type:"university_of_technology",status:"open",        openDate:"2025-04-01", closeDate:"2025-09-30", minAps:22, applicationFee:100,  applyUrl:"https://www.cput.ac.za/apply",              prospectusUrl:"", description:"The only university of technology in the Western Cape, offering creative and applied sciences programmes.",                 logoUrl:"" },
  { id:"dut",  name:"Durban University of Technology",   shortCode:"DUT",  province:"KwaZulu-Natal",  city:"Durban",             type:"university_of_technology",status:"coming_soon", openDate:"2025-08-01", closeDate:"2025-11-30", minAps:20, applicationFee:200,  applyUrl:"https://www.dut.ac.za/apply",               prospectusUrl:"", description:"A vibrant, innovative institution in Durban offering applied technology and business programmes.",                          logoUrl:"" },
  { id:"unisa",name:"University of South Africa",        shortCode:"UNISA",province:"Gauteng",         city:"Pretoria",           type:"comprehensive",           status:"open",        openDate:"2025-04-01", closeDate:"2025-10-31", minAps:0,  applicationFee:160,  applyUrl:"https://www.unisa.ac.za/apply",             prospectusUrl:"", description:"The largest distance-learning institution in Africa. Flexible study for working adults and full-time students.",              logoUrl:"" },
  { id:"ul",   name:"University of Limpopo",             shortCode:"UL",   province:"Limpopo",         city:"Polokwane",          type:"university",              status:"open",        openDate:"2025-04-01", closeDate:"2025-09-30", minAps:22, applicationFee:200,  applyUrl:"https://www.ul.ac.za/apply",                prospectusUrl:"", description:"A historically significant institution serving communities in Limpopo and beyond.",                                          logoUrl:"" },
  { id:"ufh",  name:"University of Fort Hare",           shortCode:"UFH",  province:"Eastern Cape",    city:"Alice",              type:"university",              status:"coming_soon", openDate:"2025-07-01", closeDate:"2025-11-30", minAps:22, applicationFee:150,  applyUrl:"https://www.ufh.ac.za/apply",               prospectusUrl:"", description:"One of Africa's oldest universities and alma mater to many liberation struggle leaders.",                                   logoUrl:"" },
];

export const SEED_NEWS = [
  { id:"n1", tag:"deadline", title:"UCT Applications Close 30 September 2025",       excerpt:"The University of Cape Town has confirmed that undergraduate applications for 2026 close on 30 September. Submit your application and all supporting documents before the deadline.", date:"2025-06-01", link:"https://www.uct.ac.za" },
  { id:"n2", tag:"nsfas",    title:"NSFAS 2026 Applications Now Open",               excerpt:"The National Student Financial Aid Scheme has opened applications for the 2026 academic year. Students from households earning under R350,000/year may qualify. Apply at nsfas.org.za.", date:"2025-08-01", link:"https://www.nsfas.org.za" },
  { id:"n3", tag:"bursary",  title:"Sasol Bursary 2026 — Engineering & Science",     excerpt:"Sasol is offering fully-funded bursaries for students pursuing Chemical Engineering, Mechanical Engineering and B.Sc. Chemistry. Applications close November 2025.", date:"2025-07-15", link:"#" },
  { id:"n4", tag:"tip",      title:"5 Things to Include in Your University Application", excerpt:"A strong application includes certified Grade 11 results, a motivational letter, proof of identity, and in some cases a portfolio. Start gathering your documents early.", date:"2025-06-10", link:"#" },
  { id:"n5", tag:"news",     title:"Wits Opens New Faculty of Data Science",          excerpt:"The University of the Witwatersrand announced a new Faculty of Data Science and Artificial Intelligence for 2026, with 200 undergraduate places available.", date:"2025-05-20", link:"https://www.wits.ac.za" },
  { id:"n6", tag:"bursary",  title:"Funza Lushaka Teaching Bursary Applications",    excerpt:"The Department of Education's Funza Lushaka Bursary is available for students wanting to become teachers. The bursary covers tuition, accommodation and meals.", date:"2025-07-01", link:"https://www.funza.mobi" },
];
