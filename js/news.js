// news.js
import { fetchNews } from "./app.js";

let allNews = [];

async function init() {
  allNews = await fetchNews();
  renderNews(allNews);
  buildTimeline();
  buildApsCalc();

  document.querySelectorAll("[data-tag]").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("[data-tag]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const tag = chip.dataset.tag;
      renderNews(tag ? allNews.filter(n => n.tag === tag) : allNews);
    });
  });

  document.getElementById("openApsBtn")?.addEventListener("click",  () => document.getElementById("apsModal").classList.add("open"));
  document.getElementById("closeApsBtn")?.addEventListener("click", () => document.getElementById("apsModal").classList.remove("open"));
  document.getElementById("apsModal")?.addEventListener("click", e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
  });
}

function renderNews(items) {
  const grid = document.getElementById("newsGrid");
  if (!grid) return;
  if (items.length === 0) { grid.innerHTML = `<div style="text-align:center;padding:40px;color:var(--grey-dark);grid-column:1/-1">No posts found.</div>`; return; }

  const tagIcon  = { deadline:"", nsfas:"", bursary:"", news:"", tip:"" };
  const tagClass = { deadline:"tag-deadline", nsfas:"tag-nsfas", bursary:"tag-bursary", news:"tag-news", tip:"tag-tip" };

  grid.innerHTML = items.map((item, i) => {
    const d = item.date ? new Date(item.date).toLocaleDateString("en-ZA", { day:"numeric", month:"long", year:"numeric" }) : "";
    return `<div class="news-card" style="animation-delay:${i*60}ms">
      <div class="news-card-body">
        <span class="news-card-tag ${tagClass[item.tag] || "tag-news"}">${(item.tag || "news").replace("_"," ")}</span>
        <h3 class="news-card-title">${item.title}</h3>
        <p class="news-card-excerpt">${item.excerpt}</p>
      </div>
      <div class="news-card-footer">
        <span class="news-date">${d}</span>
        ${item.link && item.link !== "#" ? `<a href="${item.link}" target="_blank" rel="noopener" class="news-cta">Read more →</a>` : "<span></span>"}
      </div>
    </div>`;
  }).join("");
}

async function buildTimeline() {
  const el = document.getElementById("timelineContainer");
  if (!el) return;

  // Show loader
  el.innerHTML = `<div style="color:var(--grey-mid);font-size:0.82rem;text-align:center;padding:12px">Loading dates…</div>`;

  try {
    const { db } = await import("./firebase-config.js");
    const { collection, getDocs, query, orderBy } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

    const snap = await getDocs(query(collection(db, "timeline"), orderBy("order", "asc")));
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Fallback to static if Firestore is empty / not set up yet
    if (!items.length) items = STATIC_TIMELINE;

    el.innerHTML = items.map(d => `
      <div class="timeline-item ${d.type || ""}">
        <div class="timeline-date">${d.date || ""}</div>
        <div class="timeline-title">${d.title || ""}</div>
        ${d.desc ? `<div class="timeline-desc">${d.desc}</div>` : ""}
      </div>`).join("");

  } catch {
    // Fallback to static data if Firebase unavailable
    el.innerHTML = STATIC_TIMELINE.map(d => `
      <div class="timeline-item ${d.type || ""}">
        <div class="timeline-date">${d.date}</div>
        <div class="timeline-title">${d.title}</div>
        <div class="timeline-desc">${d.desc}</div>
      </div>`).join("");
  }
}

// Static fallback (used only if Firestore timeline collection is empty)
const STATIC_TIMELINE = [
  { date:"Apr 2025", title:"Most applications open",   desc:"UCT, Wits, UP, UKZN, UJ and others open applications.", type:"" },
  { date:"Aug 2025", title:"NSFAS applications open",  desc:"Apply for financial aid for the 2026 academic year.",   type:"upcoming" },
  { date:"Sep 2025", title:"UCT & Wits deadlines",     desc:"UCT closes 30 Sep, Wits closes 26 Sep.",                type:"urgent" },
  { date:"Oct 2025", title:"NWU deadline",             desc:"North-West University applications close 31 October.",   type:"upcoming" },
  { date:"Nov 2025", title:"UFS & DUT close",          desc:"University of Free State and DUT deadlines.",           type:"upcoming" },
  { date:"Jan 2026", title:"NSFAS applications close", desc:"Last date to submit NSFAS applications for 2026.",      type:"urgent" },
  { date:"Feb 2026", title:"Academic year begins",     desc:"Most South African universities begin the 2026 year.",  type:"" },
];

function buildApsCalc() {
  const container = document.getElementById("apsSubjects");
  if (!container) return;
  const subjects = ["Home Language","First Additional Language","Mathematics / Maths Literacy","Life Sciences","Physical Sciences","Elective Subject 1","Elective Subject 2"];
  container.innerHTML = subjects.map((s, i) => `
    <div style="display:grid;grid-template-columns:1fr 90px 52px;gap:8px;align-items:center">
      <label style="font-size:0.83rem;color:var(--grey-dark)">${s}</label>
      <input type="number" min="0" max="100" class="search-input" placeholder="Mark %" id="aps_${i}" oninput="calcAps()" style="padding:8px 10px;font-size:0.85rem" />
      <div style="font-family:var(--font-mono);font-size:0.9rem;color:var(--green);text-align:center" id="aps_pts_${i}">—</div>
    </div>`).join("");
}

function calcAps() {
  let total = 0, filled = 0;
  for (let i = 0; i < 7; i++) {
    const val = parseInt(document.getElementById(`aps_${i}`)?.value) || 0;
    const pts = markToAps(val);
    const el  = document.getElementById(`aps_pts_${i}`);
    if (el) el.textContent = val > 0 ? pts : "—";
    if (val > 0) { total += pts; filled++; }
  }
  const rEl = document.getElementById("apsResult");
  const aEl = document.getElementById("apsAdvice");
  if (rEl) rEl.textContent = filled > 0 ? total : "—";
  if (aEl && filled > 0) {
    if (total >= 36)      aEl.textContent = "🌟 Excellent! Qualifies for top universities including UCT and Wits.";
    else if (total >= 30) aEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px"><polyline points="20 6 9 17 4 12"/></svg> Good score! Qualifies for most traditional universities.';
    else if (total >= 24) aEl.textContent = "👍 Solid. Qualifies for universities of technology and some traditional universities.";
    else                  aEl.textContent = "📚 Keep working — consider bridging courses or mature student programmes.";
  }
}
window.calcAps = calcAps; // needed for oninput="calcAps()"

function markToAps(m) {
  if (m >= 90) return 7; if (m >= 80) return 6; if (m >= 70) return 5;
  if (m >= 60) return 4; if (m >= 50) return 3; if (m >= 40) return 2;
  if (m >= 30) return 1; return 0;
}

init();
