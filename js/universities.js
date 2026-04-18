// universities.js
import { fetchUniversities, buildUniCard } from "./app.js";

let all = [];

async function init() {
  all = await fetchUniversities();
  render(all);

  document.getElementById("searchInput")  ?.addEventListener("input",  apply);
  document.getElementById("provinceFilter")?.addEventListener("change", apply);
  document.getElementById("apsFilter")    ?.addEventListener("change", apply);
  document.getElementById("typeFilter")   ?.addEventListener("change", apply);
  document.getElementById("sortFilter")   ?.addEventListener("change", apply);

  document.querySelectorAll("[data-status]").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("[data-status]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      apply();
    });
  });
}

function apply() {
  const search   = (document.getElementById("searchInput")?.value || "").toLowerCase();
  const province = document.getElementById("provinceFilter")?.value || "";
  const apsMin   = parseInt(document.getElementById("apsFilter")?.value) || 0;
  const type     = document.getElementById("typeFilter")?.value || "";
  const sort     = document.getElementById("sortFilter")?.value || "name";
  const status   = document.querySelector("[data-status].active")?.dataset.status || "";

  let list = all.filter(u => {
    if (search && !`${u.name} ${u.city} ${u.province} ${u.description || ""}`.toLowerCase().includes(search)) return false;
    if (province && u.province !== province) return false;
    if (apsMin && (u.minAps || 0) < apsMin) return false;
    if (type && u.type !== type) return false;
    if (status && u.status !== status) return false;
    return true;
  });

  list.sort((a, b) => {
    if (sort === "name")      return (a.name || "").localeCompare(b.name || "");
    if (sort === "aps_asc")   return (a.minAps || 0) - (b.minAps || 0);
    if (sort === "aps_desc")  return (b.minAps || 0) - (a.minAps || 0);
    if (sort === "deadline") {
      const far = new Date("9999-01-01");
      return (a.closeDate ? new Date(a.closeDate) : far) - (b.closeDate ? new Date(b.closeDate) : far);
    }
    return 0;
  });
  render(list);
}

function render(list) {
  const grid = document.getElementById("universitiesGrid");
  const cnt  = document.getElementById("resultCount");
  if (cnt) cnt.textContent = list.length;
  if (!grid) return;
  if (list.length === 0) {
    grid.innerHTML = `<div class="no-results" style="grid-column:1/-1"><div class="icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="color:var(--grey-mid)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><h3>No universities found</h3><p>Try adjusting your filters.</p></div>`;
    return;
  }
  grid.innerHTML = list.map((u, i) => buildUniCard(u, i * 50)).join("");
}

init();
