// detail.js — University Detail Page
import {
  fetchUniversities, buildUniCard,
  getBookmarks, toggleBookmark, updateBookmarkCount,
  showToast, statusBadge, countdownHTML, formatDate, typeLabel, SEED_DATA
} from "./app.js";
import {
  trackUniversityViewed, trackApplyClick, trackProspectusDownload, trackBookmarkAdded
} from "./analytics.js";

const params = new URLSearchParams(location.search);
const uniId  = params.get("id");

async function init() {
  if (!uniId) { showNotFound(); return; }

  const all = await fetchUniversities();
  const uni = all.find(u => u.id === uniId);

  if (!uni) { showNotFound(); return; }

  // Update page title
  document.title = `${uni.name} — UniApply SA`;

  renderHero(uni);
  renderBody(uni, all);
  setupActions(uni);
  // Track this university being viewed
  trackUniversityViewed(uni.id, uni.name);
}

function showNotFound() {
  document.getElementById("detailHero").style.display   = "none";
  document.getElementById("notFoundState").style.display = "block";
}

function renderHero(uni) {
  const hero = document.getElementById("detailHero");
  const bm   = getBookmarks();
  const saved = bm.includes(uni.id);

  const logo = uni.logoUrl
    ? `<img src="${uni.logoUrl}" alt="${uni.name}" />`
    : `<span class="detail-logo-placeholder">${(uni.shortCode || uni.name).charAt(0)}</span>`;

  hero.innerHTML = `<div class="detail-hero-inner">
    <div class="detail-logo-box">${logo}</div>
    <div class="detail-title-group">
      <h1>${uni.name}</h1>
      <div class="detail-meta">
        <span class="detail-meta-chip"> ${[uni.city, uni.province].filter(Boolean).join(", ")}</span>
        <span class="detail-meta-chip"> ${typeLabel(uni.type)}</span>
        ${uni.shortCode ? `<span class="detail-meta-chip" style="display:inline-flex;align-items:center;gap:4px"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>${uni.shortCode}</span>` : ""}
        ${statusBadge(uni.status)}
      </div>
      <div class="detail-actions">
        ${uni.applyUrl ? `<a href="${uni.applyUrl}" target="_blank" rel="noopener" class="btn btn-gold btn-sm"> Apply Now</a>` : ""}
        ${uni.prospectusUrl
          ? `<a href="${uni.prospectusUrl}" download target="_blank" rel="noopener" class="btn btn-outline btn-sm"> Download Prospectus</a>`
          : `<span class="btn btn-outline btn-sm" style="opacity:0.4;cursor:not-allowed"> No Prospectus</span>`
        }
        <button id="heroBookmarkBtn" class="btn btn-sm ${saved ? "btn-gold" : "btn-ghost"}" style="min-width:130px">
          ${saved ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Saved' : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Save'}
        </button>
      </div>
    </div>
  </div>`;

  document.getElementById("breadcrumbName").textContent = uni.name;

  document.getElementById("heroBookmarkBtn")?.addEventListener("click", () => {
    toggleBookmark(uni.id);
    const nowSaved = getBookmarks().includes(uni.id);
    const btn = document.getElementById("heroBookmarkBtn");
    btn.innerHTML = nowSaved ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Saved' : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Save';
    btn.className   = `btn btn-sm ${nowSaved ? "btn-gold" : "btn-ghost"}`;
    syncDetailBookmarkBtn(uni.id);
  });
}

function renderBody(uni, all) {
  document.getElementById("detailBody").style.display = "grid";

  // Description
  document.getElementById("detailDescription").textContent =
    uni.description || "No description available. Visit the official university website for more information.";

  // Key facts
  const kf = document.getElementById("keyFactsGrid");
  kf.innerHTML = [
    { label: "Min APS", value: uni.minAps ?? "N/A", cls: "green" },
    { label: "App Fee",  value: uni.applicationFee ? `R${uni.applicationFee}` : "Free", cls: "" },
    { label: "Opens",   value: formatDate(uni.openDate), cls: "" },
    { label: "Closes",  value: formatDate(uni.closeDate), cls: "gold" },
    { label: "Province",value: uni.province || "—", cls: "" },
    { label: "City",    value: uni.city || "—", cls: "" },
  ].map(f => `
    <div class="key-fact">
      <div class="label">${f.label}</div>
      <div class="value ${f.cls}">${f.value}</div>
    </div>`).join("");

  // Countdown
  document.getElementById("detailCountdown").innerHTML = countdownHTML(uni.closeDate, uni.status);

  // Faculties
  const tags = document.getElementById("facultyTags");
  const facs = uni.faculties?.length ? uni.faculties : [];
  if (facs.length) {
    tags.innerHTML = facs.map(f => `<span class="faculty-tag">${f}</span>`).join("");
  } else {
    tags.innerHTML = `<p style="font-size:0.85rem;color:var(--grey-mid)">No faculties listed yet. Check the official university website for available programmes.</p>`;
  }

  // Requirements sidebar
  document.getElementById("reqAps").textContent  = uni.minAps ? `${uni.minAps} points` : "Varies per programme";
  document.getElementById("reqFee").textContent  = uni.applicationFee ? `R${uni.applicationFee}` : "Free";

  // Sidebar status
  document.getElementById("sidebarStatus").innerHTML = statusBadge(uni.status);
  document.getElementById("sidebarOpen").textContent  = formatDate(uni.openDate);
  document.getElementById("sidebarClose").textContent = formatDate(uni.closeDate);
  document.getElementById("sidebarAps").textContent   = uni.minAps ?? "N/A";

  // Apply CTA
  const applyLink = document.getElementById("applyNowLink");
  if (applyLink) {
    if (uni.applyUrl) {
      applyLink.href = uni.applyUrl;
      applyLink.addEventListener("click", () => trackApplyClick(uni.id, uni.name));
    } else {
      applyLink.style.display = "none";
    }
  }

  // Prospectus download button
  const proLink   = document.getElementById("prospectusLink");
  const proNote   = document.getElementById("noProspectusNote");
  if (uni.prospectusUrl) {
    if (proLink) {
      proLink.href = uni.prospectusUrl;
      proLink.style.display = "flex";
      proLink.addEventListener("click", () => trackProspectusDownload(uni.id, uni.name));
    }
    if (proNote) proNote.style.display = "none";
  } else {
    if (proLink) proLink.style.display = "none";
    if (proNote) proNote.style.display = "block";
  }

  // Similar universities (same province or similar APS ±8)
  const similar = all
    .filter(u => u.id !== uni.id && (u.province === uni.province || Math.abs((u.minAps || 0) - (uni.minAps || 0)) <= 8))
    .slice(0, 5);

  const simEl = document.getElementById("similarUnis");
  if (similar.length === 0) {
    simEl.innerHTML = `<p style="color:var(--grey-mid);font-size:0.85rem">No similar universities found.</p>`;
  } else {
    simEl.innerHTML = similar.map(u => `
      <a href="detail.html?id=${u.id}" class="similar-uni-item">
        <div class="similar-mini-logo">${u.shortCode?.charAt(0) || u.name.charAt(0)}</div>
        <div>
          <div class="similar-uni-name">${u.name}</div>
          <div class="similar-uni-aps">Min APS: ${u.minAps ?? "N/A"} · ${u.province}</div>
        </div>
      </a>`).join("");
  }
}

function setupActions(uni) {
  const bm    = getBookmarks();
  const saved = bm.includes(uni.id);

  // Sidebar bookmark btn
  const bmBtn = document.getElementById("bookmarkDetailBtn");
  if (bmBtn) {
    bmBtn.innerHTML = saved ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Remove Bookmark' : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Save to Bookmarks';
    bmBtn.addEventListener("click", () => {
      toggleBookmark(uni.id);
      const nowSaved = getBookmarks().includes(uni.id);
      if (nowSaved) trackBookmarkAdded(uni.id, uni.name);
      bmBtn.innerHTML = nowSaved ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Remove Bookmark' : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Save to Bookmarks';
      syncHeroBookmarkBtn(uni.id, nowSaved);
    });
  }

  // Share
  document.getElementById("shareBtn")?.addEventListener("click", async () => {
    const shareData = {
      title: uni.name,
      text:  `Check out ${uni.name} on UniApply SA — Applications ${uni.status === "open" ? "are Open!" : "status: " + uni.status}`,
      url:   location.href
    };
    if (navigator.share) {
      try { await navigator.share(shareData); }
      catch {}
    } else {
      await navigator.clipboard.writeText(location.href);
      showToast("Link copied to clipboard! 📋");
    }
  });

  // Print
  document.getElementById("printBtn")?.addEventListener("click", () => window.print());
}

function syncDetailBookmarkBtn(id) {
  const nowSaved = getBookmarks().includes(id);
  const btn = document.getElementById("bookmarkDetailBtn");
  if (btn) btn.innerHTML = nowSaved ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Remove Bookmark' : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Save to Bookmarks';
}

function syncHeroBookmarkBtn(id, saved) {
  const btn = document.getElementById("heroBookmarkBtn");
  if (btn) {
    btn.innerHTML = saved ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Saved' : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Save';
    btn.className   = `btn btn-sm ${saved ? "btn-gold" : "btn-ghost"}`;
  }
}

init();
