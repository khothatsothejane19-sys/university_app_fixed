// index.js — Home page
import { fetchUniversities, buildUniCard, showToast } from "./app.js";

async function init() {
  const unis = await fetchUniversities();

  const open   = unis.filter(u => u.status === "open").length;
  const closed = unis.filter(u => u.status === "closed").length;
  const coming = unis.filter(u => u.status === "coming_soon").length;
  const soon   = unis.filter(u => {
    if (u.status !== "open" || !u.closeDate) return false;
    return (new Date(u.closeDate) - new Date()) < 30 * 86400000;
  }).length;

  counter("heroTotal",   unis.length);
  counter("heroOpen",    open);
  counter("heroClosing", soon);
  counter("statOpen",    open);
  counter("statClosed",  closed);
  counter("statComing",  coming);

  const featured = [
    ...unis.filter(u => u.status === "open"),
    ...unis.filter(u => u.status !== "open")
  ].slice(0, 6);

  const grid = document.getElementById("featuredGrid");
  if (!grid) return;

  if (featured.length === 0) {
    grid.innerHTML = `<div class="no-results" style="grid-column:1/-1"><div class="icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div><h3>No universities yet</h3><p>Add universities via the admin dashboard.</p></div>`;
    return;
  }
  grid.innerHTML = featured.map((u, i) => buildUniCard(u, i * 60)).join("");
}

function counter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let n = 0;
  const step  = Math.max(1, Math.ceil(target / 25));
  const timer = setInterval(() => {
    n = Math.min(n + step, target);
    el.textContent = n;
    if (n >= target) clearInterval(timer);
  }, 35);
}

init();
