// bookmarks.js
import { fetchUniversities, buildUniCard, getBookmarks, showToast, updateBookmarkCount } from "./app.js";

async function init() {
  const ids   = getBookmarks();
  const empty = document.getElementById("bookmarksEmpty");
  const grid  = document.getElementById("bookmarksGrid");
  const cnt   = document.getElementById("bookmarkCount");

  if (ids.length === 0) {
    if (empty) empty.style.display = "block";
    if (cnt)   cnt.textContent = 0;
    return;
  }

  const all   = await fetchUniversities();
  const saved = all.filter(u => ids.includes(u.id));

  if (cnt)   cnt.textContent = saved.length;
  if (empty) empty.style.display = saved.length === 0 ? "block" : "none";
  if (grid)  grid.innerHTML = saved.map((u, i) => buildUniCard(u, i * 60)).join("");
}

document.getElementById("clearAllBtn")?.addEventListener("click", () => {
  if (!confirm("Remove all bookmarks?")) return;
  localStorage.removeItem("uniapply_bm");
  updateBookmarkCount();
  showToast("All bookmarks cleared", "warning");
  init();
});

init();
