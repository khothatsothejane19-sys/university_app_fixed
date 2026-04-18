// admin.js — Admin Dashboard (ES Module)
import { auth, db } from "./firebase-config.js";
import { showToast } from "./app.js";
import { createNotification } from "./notifications.js";
import {
  onAuthStateChanged, signOut, updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Cloudinary Config ─────────────────────────────────────────
// Replace these with your actual Cloudinary cloud name and unsigned upload preset
const CLOUDINARY_CLOUD  = "dgcxadeyv";        // e.g. "mycloud123"
const CLOUDINARY_PRESET = "uniapply_uploads";        // your unsigned upload preset name

let allUnis     = [];
let allNews     = [];
let allTimeline = [];
let pendingDeleteId = null;
let currentFaculties = []; // tracks faculty tags in the modal

// ── Auth Guard ───────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (!user) { location.href = "admin-login.html"; return; }
  document.getElementById("pageLoader")?.classList.add("hidden");
  document.getElementById("adminLayout").style.display = "flex";
  const email = user.email || "admin";
  document.getElementById("adminAvatarInitials").textContent = email.charAt(0).toUpperCase();
  document.getElementById("adminUserName").textContent       = email;
  loadAll();
});

async function loadAll() {
  await loadUniversities();
  await loadNews();
  await loadTimeline();
  renderDashboard();
}

// ── Section Switching ─────────────────────────────────────────
const ALL_SECTIONS = ["dashboard","universities","news","timeline","analytics","settings"];

document.querySelectorAll(".admin-nav-item").forEach(item => {
  item.addEventListener("click", () => switchTo(item.dataset.section));
});

function switchTo(sec) {
  ALL_SECTIONS.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.style.display = s === sec ? "block" : "none";
  });
  document.querySelectorAll(".admin-nav-item").forEach(i =>
    i.classList.toggle("active", i.dataset.section === sec)
  );
  if (sec === "analytics") loadAnalytics();
}

// ── Logout ────────────────────────────────────────────────────
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth); location.href = "admin-login.html";
});

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard() {
  const open   = allUnis.filter(u => u.status === "open").length;
  const closed = allUnis.filter(u => u.status === "closed").length;
  const coming = allUnis.filter(u => u.status === "coming_soon").length;
  setText("dashTotal", allUnis.length);
  setText("dashOpen",  open);
  setText("dashClosed",closed);
  setText("dashComing",coming);

  const tbody  = document.getElementById("dashTableBody");
  if (!tbody) return;
  const recent = allUnis.slice(0, 5);
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--grey-mid);padding:24px">No universities yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(u => `<tr>
    <td><div class="uni-name-cell">
      <div class="mini-logo">${u.logoUrl ? `<img src="${u.logoUrl}" alt="" />` : (u.shortCode || u.name?.charAt(0) || "U")}</div>
      <span>${u.name}</span>
    </div></td>
    <td style="color:var(--grey-mid)">${u.province||"—"}</td>
    <td>${badge(u.status)}</td>
    <td style="color:var(--gold);font-family:var(--font-mono)">${u.minAps||"—"}</td>
    <td style="color:var(--grey-mid);font-family:var(--font-mono);font-size:0.8rem">${fmt(u.closeDate)}</td>
  </tr>`).join("");
}

document.getElementById("dashAddBtn")    ?.addEventListener("click", () => { switchTo("universities"); openAddModal(); });
document.getElementById("dashViewAllBtn")?.addEventListener("click", () => switchTo("universities"));

// ── Universities ──────────────────────────────────────────────
async function loadUniversities() {
  try {
    const snap = await getDocs(query(collection(db,"universities"), orderBy("name")));
    allUnis = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { allUnis = []; }
  renderUniTable(allUnis);
  setText("adminUniCount", `(${allUnis.length})`);
}

function renderUniTable(list) {
  const tbody = document.getElementById("adminTableBody");
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--grey-mid);padding:40px">No universities found.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(u => `<tr>
    <td><div class="uni-name-cell">
      <div class="mini-logo">${u.logoUrl ? `<img src="${u.logoUrl}" alt="" />` : (u.shortCode || u.name?.charAt(0) || "U")}</div>
      <div><div style="font-weight:600">${u.name}</div><div style="font-size:0.75rem;color:var(--grey-mid)">${u.city||""}</div></div>
    </div></td>
    <td style="color:var(--grey-mid);font-size:0.85rem">${u.province||"—"}</td>
    <td style="font-size:0.78rem;color:var(--grey-mid)">${typeShort(u.type)}</td>
    <td>${badge(u.status)}</td>
    <td style="font-family:var(--font-mono);color:var(--gold)">${u.minAps||"—"}</td>
    <td style="font-family:var(--font-mono);font-size:0.8rem;color:var(--grey-mid)">${fmt(u.closeDate)}</td>
    <td><div class="table-actions">
      <button class="btn-icon btn-icon-edit"   data-edit="${u.id}"   title="Edit">✏️</button>
      <button class="btn-icon btn-icon-status" data-cycle="${u.id}"  title="Cycle Status">🔄</button>
      <button class="btn-icon btn-icon-delete" data-del="${u.id}" data-delname="${esc(u.name)}" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
    </div></td>
  </tr>`).join("");
}

document.getElementById("adminSearch")      ?.addEventListener("input",  filterTable);
document.getElementById("adminStatusFilter")?.addEventListener("change", filterTable);
function filterTable() {
  const s  = (document.getElementById("adminSearch")?.value||"").toLowerCase();
  const st = document.getElementById("adminStatusFilter")?.value||"";
  renderUniTable(allUnis.filter(u => {
    if (s && !`${u.name} ${u.city} ${u.province}`.toLowerCase().includes(s)) return false;
    if (st && u.status !== st) return false;
    return true;
  }));
}

// Delegate table row actions
document.getElementById("adminTableBody")?.addEventListener("click", e => {
  const editBtn  = e.target.closest("[data-edit]");
  const cycleBtn = e.target.closest("[data-cycle]");
  const delBtn   = e.target.closest("[data-del]");
  if (editBtn)  openEditModal(editBtn.dataset.edit);
  if (cycleBtn) cycleStatus(cycleBtn.dataset.cycle);
  if (delBtn)   openDeleteModal(delBtn.dataset.del, delBtn.dataset.delname);
});

// ── University Modal ──────────────────────────────────────────
document.getElementById("addUniBtn")     ?.addEventListener("click", openAddModal);
document.getElementById("closeUniModal") ?.addEventListener("click", closeUniModal);
document.getElementById("cancelUniModal")?.addEventListener("click", closeUniModal);
document.getElementById("saveUniBtn")    ?.addEventListener("click", saveUniversity);

// ── Faculty Tag Input ─────────────────────────────────────────
function initFacultyInput() {
  const input = document.getElementById("facultyInput");
  if (!input) return;
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = input.value.trim().replace(/,/g,"");
      if (val && !currentFaculties.includes(val)) {
        currentFaculties.push(val);
        renderFacultyTags();
      }
      input.value = "";
    } else if (e.key === "Backspace" && input.value === "" && currentFaculties.length) {
      currentFaculties.pop();
      renderFacultyTags();
    }
  });
}

function renderFacultyTags() {
  const container = document.getElementById("facultyTagsInput");
  const input     = document.getElementById("facultyInput");
  if (!container || !input) return;

  // Remove existing tag spans
  container.querySelectorAll(".fac-tag").forEach(t => t.remove());

  // Re-insert before the input
  currentFaculties.forEach((fac, idx) => {
    const tag = document.createElement("span");
    tag.className = "fac-tag";
    tag.style.cssText = "display:inline-flex;align-items:center;gap:5px;padding:3px 10px 3px 12px;border-radius:100px;background:rgba(0,122,77,0.2);color:var(--green-light);font-size:0.78rem;font-weight:600;";
    tag.innerHTML = `${fac} <button type="button" style="background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:0.9rem;padding:0;line-height:1;" data-idx="${idx}">×</button>`;
    tag.querySelector("button").addEventListener("click", () => {
      currentFaculties.splice(idx, 1);
      renderFacultyTags();
    });
    container.insertBefore(tag, input);
  });
}

function setFaculties(arr) {
  currentFaculties = Array.isArray(arr) ? [...arr] : [];
  renderFacultyTags();
}

function getFaculties() { return [...currentFaculties]; }

function openAddModal() {
  setText("modalTitle","Add University");
  document.getElementById("saveUniBtn").textContent = "💾 Save University";
  document.getElementById("editingId").value = "";
  clearUniForm();
  document.getElementById("uniModal").classList.add("open");
  initFacultyInput();
}

function openEditModal(id) {
  const u = allUnis.find(x => x.id === id);
  if (!u) return;
  setText("modalTitle","Edit University");
  document.getElementById("saveUniBtn").textContent = "💾 Update University";
  document.getElementById("editingId").value = id;

  setVal("uniName",u.name); setVal("uniCode",u.shortCode);
  setVal("uniProvince",u.province); setVal("uniCity",u.city);
  setVal("uniType",u.type); setVal("uniStatus",u.status);
  setVal("uniOpenDate",u.openDate); setVal("uniCloseDate",u.closeDate);
  setVal("uniAps",u.minAps); setVal("uniFee",u.applicationFee);
  setVal("uniApplyUrl",u.applyUrl);
  setVal("uniDescription",u.description);

  // Logo
  setVal("uniLogoUrl", u.logoUrl||"");
  setVal("uniLogoUrlDirect", u.logoUrl||"");
  const prev = document.getElementById("logoPreview");
  if (prev) {
    prev.innerHTML = u.logoUrl
      ? `<img src="${u.logoUrl}" style="width:100%;height:100%;object-fit:contain;padding:6px" />`
      : `<span style="color:var(--grey-mid);font-size:0.78rem">Preview</span>`;
  }
  setText("logoUploadStatus", u.logoUrl ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green-light)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Logo loaded` : "");

  // Prospectus
  setVal("uniProspectusUrl", u.prospectusUrl||"");
  setVal("uniProspectusUrlDirect", u.prospectusUrl||"");
  const proStatus = document.getElementById("proUploadStatus");
  const proLink   = document.getElementById("proCurrentLink");
  if (proStatus) proStatus.innerHTML = u.prospectusUrl ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green-light)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Prospectus loaded` : "No file selected";
  if (proLink) {
    proLink.href = u.prospectusUrl || "#";
    proLink.style.display = u.prospectusUrl ? "block" : "none";
  }

  // Faculties
  setFaculties(u.faculties || []);

  document.getElementById("uniModal").classList.add("open");
  initFacultyInput();
}

function closeUniModal() {
  document.getElementById("uniModal").classList.remove("open");
  clearUniForm();
}

// ── Cloudinary Upload ─────────────────────────────────────────
async function uploadToCloudinary(file, resourceType = "image") {
  if (CLOUDINARY_CLOUD === "YOUR_CLOUD_NAME") {
    showToast("Set your Cloudinary cloud name in admin.js first!", "error", 5000);
    throw new Error("Cloudinary not configured");
  }
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_PRESET);
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`;
  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Cloudinary upload failed: ${res.statusText}`);
  const data = await res.json();
  return data.secure_url;
}

// Wire up logo file input
document.getElementById("logoFileInput")?.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById("logoUploadStatus");
  const prevEl   = document.getElementById("logoPreview");
  if (statusEl) statusEl.textContent = "⏳ Uploading…";

  try {
    const url = await uploadToCloudinary(file, "image");
    setVal("uniLogoUrl", url);
    setVal("uniLogoUrlDirect", url);
    if (prevEl) prevEl.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:contain;padding:6px" />`;
    if (statusEl) statusEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green-light)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Logo uploaded!`;
    showToast("Logo uploaded successfully!");
  } catch (err) {
    if (statusEl) statusEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Upload failed`;
    showToast(err.message || "Logo upload failed", "error");
  }
  e.target.value = ""; // reset input
});

// Wire up direct logo URL input
document.getElementById("uniLogoUrlDirect")?.addEventListener("input", e => {
  const url = e.target.value.trim();
  setVal("uniLogoUrl", url);
  const prev = document.getElementById("logoPreview");
  if (prev) {
    prev.innerHTML = url
      ? `<img src="${url}" style="width:100%;height:100%;object-fit:contain;padding:6px" onerror="this.parentElement.innerHTML='<span style=color:var(--red);font-size:0.75rem>Invalid image URL</span>'" />`
      : `<span style="color:var(--grey-mid);font-size:0.78rem">Preview</span>`;
  }
});

// Wire up prospectus file input
document.getElementById("proFileInput")?.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById("proUploadStatus");
  const linkEl   = document.getElementById("proCurrentLink");
  if (statusEl) statusEl.textContent = "⏳ Uploading PDF…";

  try {
    const url = await uploadToCloudinary(file, "raw"); // raw = for PDFs
    setVal("uniProspectusUrl", url);
    setVal("uniProspectusUrlDirect", url);
    if (statusEl) statusEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green-light)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ${file.name}`;
    if (linkEl)   { linkEl.href = url; linkEl.style.display = "block"; }
    showToast("Prospectus uploaded successfully!");
  } catch (err) {
    if (statusEl) statusEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Upload failed`;
    showToast(err.message || "Prospectus upload failed", "error");
  }
  e.target.value = "";
});

// Wire up direct prospectus URL input
document.getElementById("uniProspectusUrlDirect")?.addEventListener("input", e => {
  const url = e.target.value.trim();
  setVal("uniProspectusUrl", url);
  const linkEl = document.getElementById("proCurrentLink");
  if (linkEl) { linkEl.href = url; linkEl.style.display = url ? "block" : "none"; }
  const statusEl = document.getElementById("proUploadStatus");
  if (statusEl) statusEl.innerHTML = url ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green-light)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> URL set` : "No file selected";
});

// ── Save University ───────────────────────────────────────────
async function saveUniversity() {
  const editId = getVal("editingId");
  const name   = getVal("uniName").trim();
  if (!name) { showToast("University name is required", "error"); return; }

  // Resolve logo & prospectus — prefer hidden field (set by uploader or direct URL input)
  const logoUrl       = getVal("uniLogoUrl")       || getVal("uniLogoUrlDirect");
  const prospectusUrl = getVal("uniProspectusUrl")  || getVal("uniProspectusUrlDirect");

  const data = {
    name,
    shortCode:      getVal("uniCode"),
    province:       getVal("uniProvince"),
    city:           getVal("uniCity"),
    type:           getVal("uniType"),
    status:         getVal("uniStatus") || "closed",
    openDate:       getVal("uniOpenDate"),
    closeDate:      getVal("uniCloseDate"),
    minAps:         parseInt(getVal("uniAps"))  || null,
    applicationFee: parseInt(getVal("uniFee"))  || null,
    applyUrl:       getVal("uniApplyUrl"),
    logoUrl,
    prospectusUrl,
    description:    getVal("uniDescription"),
    faculties:      getFaculties(),
    updatedAt:      serverTimestamp()
  };

  const btn = document.getElementById("saveUniBtn");
  btn.textContent = "⏳ Saving…"; btn.disabled = true;

  try {
    if (editId) {
      await updateDoc(doc(db,"universities",editId), data);
      showToast(`${name} updated!`);
      // Notify users about status change if status changed
      const original = allUnis.find(u => u.id === editId);
      if (original && original.status !== data.status) {
        const statusLabel = data.status === "open" ? "is now open for applications" :
                            data.status === "closed" ? "has closed applications" :
                            "will be opening soon";
        await createNotification({
          title: `${name} ${statusLabel.split(" ")[0].charAt(0).toUpperCase() + statusLabel.split(" ")[0].slice(1)}`,
          message: `${name} ${statusLabel}.`,
          type: data.status === "open" ? "open" : data.status === "closed" ? "closed" : "general"
        });
      }
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db,"universities"), data);
      showToast(`${name} added!`);
      const statusLabel = data.status === "open" ? "is now open for applications" :
                          data.status === "coming_soon" ? "will be opening soon" :
                          "has been added";
      await createNotification({
        title: `New University: ${name}`,
        message: `${name} ${statusLabel}.`,
        type: data.status === "open" ? "open" : "general"
      });
    }
    closeUniModal();
    await loadUniversities();
    renderDashboard();
  } catch (err) {
    console.error(err);
    showToast("Save failed. Check your Firebase connection.", "error");
  } finally {
    btn.textContent = "💾 Save University"; btn.disabled = false;
  }
}

// ── Delete ────────────────────────────────────────────────────
document.getElementById("closeDeleteModal") ?.addEventListener("click", () => document.getElementById("deleteModal").classList.remove("open"));
document.getElementById("cancelDeleteModal")?.addEventListener("click", () => document.getElementById("deleteModal").classList.remove("open"));
document.getElementById("confirmDeleteBtn") ?.addEventListener("click", () => deleteUniversity(pendingDeleteId));

function openDeleteModal(id, name) {
  pendingDeleteId = id;
  setText("deleteUniName", name);
  document.getElementById("deleteModal").classList.add("open");
}

async function deleteUniversity(id) {
  if (!id) return;
  try {
    await deleteDoc(doc(db,"universities",id));
    showToast("University deleted.", "warning");
    document.getElementById("deleteModal").classList.remove("open");
    await loadUniversities();
    renderDashboard();
  } catch { showToast("Delete failed.", "error"); }
}

async function cycleStatus(id) {
  const u    = allUnis.find(x => x.id === id);
  if (!u) return;
  const next = { open:"closed", closed:"coming_soon", coming_soon:"open" }[u.status] || "open";
  try {
    await updateDoc(doc(db,"universities",id), { status: next, updatedAt: serverTimestamp() });
    showToast(`Status → ${next.replace("_"," ")}`);
    // Notify users
    const statusMsg = next === "open"
      ? `${u.name} is now open for applications!`
      : next === "closed"
      ? `${u.name} has closed its applications.`
      : `${u.name} will be opening applications soon.`;
    await createNotification({
      title: next === "open" ? `🟢 ${u.name} is Open!` : next === "closed" ? `🔴 ${u.name} Closed` : `🔔 ${u.name} Opening Soon`,
      message: statusMsg,
      type: next === "open" ? "open" : next === "closed" ? "closed" : "general"
    });
    await loadUniversities();
    renderDashboard();
  } catch { showToast("Update failed.", "error"); }
}

// ── News ──────────────────────────────────────────────────────
document.getElementById("addNewsBtn")     ?.addEventListener("click", openAddNewsModal);
document.getElementById("closeNewsModal") ?.addEventListener("click", () => document.getElementById("newsModal").classList.remove("open"));
document.getElementById("cancelNewsModal")?.addEventListener("click", () => document.getElementById("newsModal").classList.remove("open"));
document.getElementById("saveNewsBtn")    ?.addEventListener("click", saveNewsPost);

document.getElementById("newsTableBody")?.addEventListener("click", e => {
  const editBtn = e.target.closest("[data-news-edit]");
  const delBtn  = e.target.closest("[data-news-del]");
  if (editBtn) openEditNewsModal(editBtn.dataset.newsEdit);
  if (delBtn)  deleteNews(delBtn.dataset.newsDel);
});

async function loadNews() {
  try {
    const snap = await getDocs(query(collection(db,"news"), orderBy("date","desc")));
    allNews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { allNews = []; }
  renderNewsTable();
}

function renderNewsTable() {
  const tbody = document.getElementById("newsTableBody");
  if (!tbody) return;
  if (!allNews.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--grey-mid);padding:30px">No posts yet. Click "+ Add Post".</td></tr>`;
    return;
  }
  tbody.innerHTML = allNews.map(n => `<tr>
    <td style="font-weight:500">${n.title}</td>
    <td><span style="font-size:0.75rem;padding:3px 10px;border-radius:100px;background:rgba(0,122,77,0.15);color:var(--green-light)">${n.tag||"news"}</span></td>
    <td style="font-family:var(--font-mono);font-size:0.8rem;color:var(--grey-mid)">${fmt(n.date)}</td>
    <td><div class="table-actions">
      <button class="btn-icon btn-icon-edit"   data-news-edit="${n.id}">✏️</button>
      <button class="btn-icon btn-icon-delete" data-news-del="${n.id}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
    </div></td>
  </tr>`).join("");
}

function openAddNewsModal() {
  setText("newsModalTitle","Add News Post");
  setVal("editingNewsId",""); setVal("newsTitle",""); setVal("newsExcerpt",""); setVal("newsLink","");
  document.getElementById("newsDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("newsModal").classList.add("open");
}

function openEditNewsModal(id) {
  const n = allNews.find(x => x.id === id);
  if (!n) return;
  setText("newsModalTitle","Edit Post");
  setVal("editingNewsId",id); setVal("newsTitle",n.title); setVal("newsTag",n.tag);
  setVal("newsDate",n.date); setVal("newsExcerpt",n.excerpt); setVal("newsLink",n.link);
  document.getElementById("newsModal").classList.add("open");
}

async function saveNewsPost() {
  const editId = getVal("editingNewsId");
  const title  = getVal("newsTitle").trim();
  if (!title) { showToast("Title is required", "error"); return; }
  const data = {
    title, tag: getVal("newsTag")||"news", date: getVal("newsDate"),
    excerpt: getVal("newsExcerpt"), link: getVal("newsLink"),
    updatedAt: serverTimestamp()
  };
  try {
    if (editId) { await updateDoc(doc(db,"news",editId), data); showToast("Post updated!"); }
    else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db,"news"), data);
      showToast("Post added!");
      // Notify all users about new news post
      await createNotification({
        title: `📰 ${title}`,
        message: data.excerpt ? data.excerpt.substring(0, 120) + (data.excerpt.length > 120 ? "…" : "") : "New update posted.",
        type: "news"
      });
    }
    document.getElementById("newsModal").classList.remove("open");
    await loadNews();
  } catch { showToast("Save failed.", "error"); }
}

async function deleteNews(id) {
  if (!confirm("Delete this post?")) return;
  try { await deleteDoc(doc(db,"news",id)); showToast("Deleted.", "warning"); await loadNews(); }
  catch { showToast("Delete failed.", "error"); }
}

// ── Timeline ──────────────────────────────────────────────────
document.getElementById("addTimelineBtn")      ?.addEventListener("click", openAddTimelineModal);
document.getElementById("closeTimelineModal")  ?.addEventListener("click", () => document.getElementById("timelineModal").classList.remove("open"));
document.getElementById("cancelTimelineModal") ?.addEventListener("click", () => document.getElementById("timelineModal").classList.remove("open"));
document.getElementById("saveTimelineBtn")     ?.addEventListener("click", saveTimelineItem);

document.getElementById("timelineTableBody")?.addEventListener("click", e => {
  const editBtn = e.target.closest("[data-tl-edit]");
  const delBtn  = e.target.closest("[data-tl-del]");
  if (editBtn) openEditTimelineModal(editBtn.dataset.tlEdit);
  if (delBtn)  deleteTimelineItem(delBtn.dataset.tlDel);
});

async function loadTimeline() {
  try {
    const snap = await getDocs(query(collection(db,"timeline"), orderBy("order","asc")));
    allTimeline = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { allTimeline = []; }
  renderTimelineTable();
}

function renderTimelineTable() {
  const tbody = document.getElementById("timelineTableBody");
  if (!tbody) return;
  if (!allTimeline.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--grey-mid);padding:40px">No key dates yet. Click "+ Add Date" to create one.<br><br><span style="font-size:0.8rem;opacity:0.6">These dates appear in the sidebar on the News & Deadlines page.</span></td></tr>`;
    return;
  }
  const typeLabel = { "":"Normal","upcoming":"Upcoming","urgent":"Urgent" };
  tbody.innerHTML = allTimeline.map(t => `<tr>
    <td style="font-family:var(--font-mono);color:var(--gold);font-size:0.85rem">${t.date||"—"}</td>
    <td style="font-weight:600">${t.title||"—"}</td>
    <td style="color:var(--grey-mid);font-size:0.85rem">${t.desc||"—"}</td>
    <td><span style="font-size:0.75rem;padding:2px 8px;border-radius:100px;background:rgba(255,255,255,0.06);color:var(--grey-mid)">${typeLabel[t.type||""]||"Normal"}</span></td>
    <td><div class="table-actions">
      <button class="btn-icon btn-icon-edit"   data-tl-edit="${t.id}">✏️</button>
      <button class="btn-icon btn-icon-delete" data-tl-del="${t.id}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
    </div></td>
  </tr>`).join("");
}

function openAddTimelineModal() {
  setText("timelineModalTitle","Add Key Date");
  setVal("editingTimelineId",""); setVal("tlDate",""); setVal("tlTitle","");
  setVal("tlDesc",""); setVal("tlType",""); setVal("tlOrder", allTimeline.length + 1);
  document.getElementById("timelineModal").classList.add("open");
}

function openEditTimelineModal(id) {
  const t = allTimeline.find(x => x.id === id);
  if (!t) return;
  setText("timelineModalTitle","Edit Key Date");
  setVal("editingTimelineId",id); setVal("tlDate",t.date); setVal("tlTitle",t.title);
  setVal("tlDesc",t.desc); setVal("tlType",t.type||""); setVal("tlOrder",t.order??0);
  document.getElementById("timelineModal").classList.add("open");
}

async function saveTimelineItem() {
  const editId = getVal("editingTimelineId");
  const date   = getVal("tlDate").trim();
  const title  = getVal("tlTitle").trim();
  if (!date || !title) { showToast("Date label and title are required", "error"); return; }
  const data = {
    date, title, desc: getVal("tlDesc"), type: getVal("tlType"),
    order: parseInt(getVal("tlOrder")) || 0,
    updatedAt: serverTimestamp()
  };
  try {
    if (editId) { await updateDoc(doc(db,"timeline",editId), data); showToast("Date updated!"); }
    else        { data.createdAt = serverTimestamp(); await addDoc(collection(db,"timeline"), data); showToast("Date added!"); }
    document.getElementById("timelineModal").classList.remove("open");
    await loadTimeline();
  } catch { showToast("Save failed.", "error"); }
}

async function deleteTimelineItem(id) {
  if (!confirm("Delete this date?")) return;
  try { await deleteDoc(doc(db,"timeline",id)); showToast("Deleted.", "warning"); await loadTimeline(); }
  catch { showToast("Delete failed.", "error"); }
}

// ── Settings ──────────────────────────────────────────────────
document.getElementById("changePassBtn")?.addEventListener("click", async () => {
  const np = document.getElementById("newPassword")?.value;
  const cp = document.getElementById("confirmPassword")?.value;
  if (!np || np.length < 8) { showToast("Min. 8 characters.", "error"); return; }
  if (np !== cp)            { showToast("Passwords don't match.", "error"); return; }
  try { await updatePassword(auth.currentUser, np); showToast("Password updated!"); }
  catch { showToast("Re-login required to change password.", "error"); }
});

// ── Helpers ───────────────────────────────────────────────────
function setText(id,v)  { const el=document.getElementById(id); if(el) el.textContent=v; }
function getVal(id)     { return document.getElementById(id)?.value||""; }
function setVal(id,v)   { const el=document.getElementById(id); if(el) el.value=v??"";}
function esc(s)         { return (s||"").replace(/"/g,"&quot;"); }
function fmt(str)       { if(!str) return "—"; try { return new Date(str).toLocaleDateString("en-ZA",{day:"numeric",month:"short",year:"numeric"}); } catch { return str; } }
function typeShort(t)   { return {university:"Trad.",university_of_technology:"UoT",comprehensive:"Comp."}[t]||t||"—"; }
function badge(status)  {
  const m={open:{cls:"status-open",l:"Open"},closed:{cls:"status-closed",l:"Closed"},coming_soon:{cls:"status-coming",l:"Coming Soon"}};
  const s=m[status]||m.closed;
  return `<span class="status-badge ${s.cls}"><span class="dot"></span>${s.l}</span>`;
}
function clearUniForm() {
  ["uniName","uniCode","uniProvince","uniCity","uniType","uniOpenDate","uniCloseDate",
   "uniAps","uniFee","uniApplyUrl","uniLogoUrl","uniLogoUrlDirect",
   "uniProspectusUrl","uniProspectusUrlDirect","uniDescription"].forEach(id => setVal(id,""));
  setVal("uniStatus","open");
  currentFaculties = [];
  renderFacultyTags();
  // Reset logo preview
  const prev = document.getElementById("logoPreview");
  if (prev) prev.innerHTML = `<span style="color:var(--grey-mid);font-size:0.78rem">Preview</span>`;
  setText("logoUploadStatus","");
  // Reset prospectus status
  const ps = document.getElementById("proUploadStatus");
  if (ps) ps.textContent = "No file selected";
  const pl = document.getElementById("proCurrentLink");
  if (pl) pl.style.display = "none";
}

// ══════════════════════════════════════════════════════════════
// ANALYTICS SECTION
// ══════════════════════════════════════════════════════════════
import {
  collection as colA, getDocs as getDocsAn,
  query as qA, where as wA, orderBy as obA, Timestamp as TS
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const ANALYTICS_COLL = "analytics_events";

document.getElementById("analyticsRefreshBtn")?.addEventListener("click", loadAnalytics);
document.getElementById("analyticsRange")?.addEventListener("change", loadAnalytics);

async function loadAnalytics() {
  const days    = parseInt(document.getElementById("analyticsRange")?.value || "30");
  const cutoff  = TS.fromDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

  // Show loading state
  ["aTablePages","aTableUniViews","aTableApply","aTablePro","aTableBm","aTableNotif"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--grey-mid);padding:24px"><div class="loader-ring" style="width:18px;height:18px;border-width:2px;margin:0 auto"></div></td></tr>`;
  });
  ["aStatPageViews","aStatUniViews","aStatApply","aStatPro","aStatBm","aStatNotif"].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = "…";
  });

  try {
    const snap = await getDocsAn(qA(
      colA(db, ANALYTICS_COLL),
      wA("ts", ">=", cutoff)
    ));

    const events = snap.docs.map(d => d.data());

    // ── Totals ───────────────────────────────────────────────
    const count = (name) => events.filter(e => e.event === name).length;
    setText("aStatPageViews", count("page_view").toLocaleString());
    setText("aStatUniViews",  count("university_viewed").toLocaleString());
    setText("aStatApply",     count("apply_click").toLocaleString());
    setText("aStatPro",       count("prospectus_downloaded").toLocaleString());
    setText("aStatBm",        count("bookmark_added").toLocaleString());
    setText("aStatNotif",     count("notification_clicked").toLocaleString());

    // ── Helper: group by a field and count ───────────────────
    function topN(eventName, groupField, labelField, n = 8) {
      const counts = {};
      events
        .filter(e => e.event === eventName)
        .forEach(e => {
          const key   = e[groupField] || "Unknown";
          const label = e[labelField] || key;
          if (!counts[key]) counts[key] = { label, count: 0 };
          counts[key].count++;
        });
      return Object.values(counts)
        .sort((a, b) => b.count - a.count)
        .slice(0, n);
    }

    // ── Page name prettifier ─────────────────────────────────
    function prettyPage(raw) {
      const map = {
        "index.html": "Home",
        "": "Home",
        "universities.html": "Universities",
        "news.html": "News & Deadlines",
        "bookmarks.html": "Bookmarks",
        "detail.html": "University Detail",
        "admin.html": "Admin",
        "admin-login.html": "Admin Login"
      };
      return map[raw] || raw || "Home";
    }

    // ── Page views ───────────────────────────────────────────
    const pageCounts = {};
    events.filter(e => e.event === "page_view").forEach(e => {
      const pg = prettyPage(e.page || "");
      pageCounts[pg] = (pageCounts[pg] || 0) + 1;
    });
    const pageRows = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 8);
    renderTableRows("aTablePages", pageRows.map(([label, count]) => ({ label, count })));

    // ── University views ─────────────────────────────────────
    renderTableRows("aTableUniViews", topN("university_viewed", "uniId", "uniName"));

    // ── Apply clicks ─────────────────────────────────────────
    renderTableRows("aTableApply", topN("apply_click", "uniId", "uniName"));

    // ── Prospectus downloads ─────────────────────────────────
    renderTableRows("aTablePro", topN("prospectus_downloaded", "uniId", "uniName"));

    // ── Bookmarks ────────────────────────────────────────────
    renderTableRows("aTableBm", topN("bookmark_added", "uniId", "uniName"));

    // ── Notification clicks ───────────────────────────────────
    renderTableRows("aTableNotif", topN("notification_clicked", "notifId", "notifTitle"));

  } catch (err) {
    console.error("Analytics load error:", err);
    showToast("Could not load analytics. Check Firestore rules.", "error");
  }
}

function renderTableRows(tbodyId, rows) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--grey-mid);padding:24px;font-size:0.85rem">No data yet for this period.</td></tr>`;
    return;
  }
  const max = rows[0].count || 1;
  tbody.innerHTML = rows.map(({ label, count }, i) => `
    <tr>
      <td style="font-size:0.85rem;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${label}">
        <span style="color:var(--grey-mid);font-size:0.72rem;margin-right:6px">#${i+1}</span>${label}
      </td>
      <td style="text-align:right">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">
          <div style="width:60px;height:5px;border-radius:3px;background:rgba(255,255,255,0.07);overflow:hidden">
            <div style="width:${Math.round((count/max)*100)}%;height:100%;background:var(--gold);border-radius:3px"></div>
          </div>
          <span style="font-family:var(--font-mono);font-size:0.82rem;color:var(--gold);min-width:28px;text-align:right">${count}</span>
        </div>
      </td>
    </tr>`).join("");
}
