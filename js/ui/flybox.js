import {
  uid,
  listFlyBoxes,
  getFlyBox,
  saveFlyBox,
  deleteFlyBox,
  clearAllFlyBoxes,
  listFliesByBox,
  getFly,               // preserve createdAt on edit
  saveFly,
  deleteFly,
  adjustFlyQty
} from "../../storage.js";

import { safeText } from "../utils.js";
import { state } from "../state.js";
import { openPhotoViewer } from "../photo-viewer.js";

import {
  flyBoxMeta,
  flyBoxSummaryMeta,
  flyBoxSelect,
  newFlyBoxBtn,
  editFlyBoxBtn,
  deleteFlyBoxBtn,

  // modal trigger + modal shell
  openFlyModalBtn,
  flyModalOverlay,
  flyModal,
  flyModalClose,
  flyModalCancel,
  flyModalTitle,
  flyModalSub,
  flyCount,

  // fly form fields (now inside modal, same IDs)
  flyType,
  flyPattern,
  flySize,
  flyQty,
  flyColors,
  addFlyBtn,
  flyList,
  flyEmpty,

  flyPhoto,
  flyPhotoPreview
} from "../dom.js";

/* =========================
   Quiver (FlyBox) module
========================= */

function parseSize(v){
  const s = String(v ?? "").trim();
  return s.replace(/[^\d]+/g, "");
}

function parseQty(v){
  const n = Math.floor(Number(String(v ?? "").replace(/[^\d\-]+/g, "")));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function prettyFlyType(v){
  const s = String(v ?? "").trim();
  if(!s) return "—";
  const k = s.toLowerCase();
  const map = {
    nymph: "Nymph",
    dry: "Dry",
    wet: "Wet",
    streamer: "Streamer",
    other: "Other"
  };
  if(map[k]) return map[k];
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function flyLabel(row){
  const t = prettyFlyType(row.type);
  const p = safeText(row.pattern);
  const szRaw = String(row.size || "").trim();
  const sz = szRaw ? `#${szRaw}` : "#-";
  return `${t} • ${p} • ${sz}`;
}

function flySub(row){
  const c = String(row.colors || "").trim();
  return c ? c : "—";
}

/* ===== Photo helpers (offline dataURL) ===== */
function fileToDataURL(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function clearPhotoInput(){
  if(flyPhoto) flyPhoto.value = "";
  if(flyPhotoPreview){
    flyPhotoPreview.innerHTML = "";
    flyPhotoPreview.classList.add("hidden");
  }
}

async function refreshPhotoPreviewFromFile(){
  const f = flyPhoto?.files?.[0];
  if(!f){
    clearPhotoInput();
    return;
  }
  try{
    const dataUrl = await fileToDataURL(f);
    if(flyPhotoPreview){
      flyPhotoPreview.innerHTML = `<img src="${dataUrl}" alt="Fly photo preview" />`;
      flyPhotoPreview.classList.remove("hidden");
    }
  }catch(_){
    // ignore preview failure
  }
}

/* =========================
   Modal controls
========================= */

function openFlyModal(mode="add"){
  const isEdit = mode === "edit";

  if(flyModalTitle) flyModalTitle.textContent = isEdit ? "Edit Fly" : "Add Fly";
  if(flyModalSub) flyModalSub.textContent = isEdit ? "Update details" : "Quick entry";

  flyModalOverlay?.classList.remove("hidden");
  flyModal?.classList.remove("hidden");
  flyModalOverlay?.setAttribute("aria-hidden", "false");
  flyModal?.setAttribute("aria-hidden", "false");
  document.body.classList.add("modalOpen");

  setTimeout(()=> flyPattern?.focus(), 0);
}

function closeFlyModal(){
  flyModalOverlay?.classList.add("hidden");
  flyModal?.classList.add("hidden");
  flyModalOverlay?.setAttribute("aria-hidden", "true");
  flyModal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modalOpen");

  clearPhotoInput();
}

function setEditingFly(id){
  state.flyEditingId = id || null;
  if(addFlyBtn){
    addFlyBtn.textContent = id ? "Save Changes" : "Save Fly";
    addFlyBtn.classList.toggle("isEditing", !!id);
  }
}

function clearFlyForm(){
  if(flyType) flyType.value = "";
  if(flyPattern) flyPattern.value = "";
  if(flySize) flySize.value = "";
  if(flyQty) flyQty.value = "";
  if(flyColors) flyColors.value = "";
  clearPhotoInput();
  setEditingFly(null);
}

function fillFlyFormFromRow(f){
  if(!f) return;
  if(flyType) flyType.value = f.type || "";
  if(flyPattern) flyPattern.value = f.pattern || "";
  if(flySize) flySize.value = f.size || "";
  if(flyQty) flyQty.value = String(Number(f.qty)||0);
  if(flyColors) flyColors.value = f.colors || "";

  clearPhotoInput();

  const hasPhoto = !!(f.photo && String(f.photo).startsWith("data:image"));
  if(hasPhoto && flyPhotoPreview){
    flyPhotoPreview.innerHTML = `<img src="${f.photo}" alt="Fly photo" />`;
    flyPhotoPreview.classList.remove("hidden");
  }
}

/* =========================
   Render / refresh
========================= */

async function refreshBoxSelect(selectedId){
  const boxes = await listFlyBoxes();
  if(!flyBoxSelect) return boxes;

  flyBoxSelect.innerHTML = "";
  if(boxes.length){
    for(const b of boxes){
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.name || "Fly Box";
      flyBoxSelect.appendChild(opt);
    }
  }else{
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No fly boxes yet";
    opt.disabled = true;
    opt.selected = true;
    flyBoxSelect.appendChild(opt);
  }

  const target = selectedId || (boxes[0]?.id || "");
  if(target) flyBoxSelect.value = target;

  return boxes;
}

async function refreshFlyMeta(boxId){
  const box = await getFlyBox(boxId);
  if(!box){
    if(flyBoxMeta) flyBoxMeta.textContent = "—";
    if(flyBoxSummaryMeta) flyBoxSummaryMeta.textContent = "";
    if(flyCount) flyCount.textContent = "0";
    return;
  }

  const flies = await listFliesByBox(boxId);
  const totalQty = flies.reduce((sum, f)=> sum + (Number(f.qty)||0), 0);

  if(flyCount) flyCount.textContent = String(totalQty);

  if(flyBoxMeta){
    flyBoxMeta.textContent =
      `${safeText(box.name)} • ${flies.length} pattern${flies.length === 1 ? "" : "s"} • ${totalQty} fly${totalQty === 1 ? "" : "ies"}`;
  }

  // ✅ IMPORTANT: do NOT include the dot here. CSS adds it when not empty.
  if(flyBoxSummaryMeta){
    flyBoxSummaryMeta.textContent = safeText(box.name || "");
  }
}

async function renderFlyList(boxId, setStatus){
  if(!flyList) return;
  if(!boxId){
    flyList.innerHTML = "";
    if(flyEmpty){
      flyEmpty.style.display = "block";
    }
    return;
  }

  const flies = await listFliesByBox(boxId);
  flyList.innerHTML = "";

  if(flyEmpty){
    flyEmpty.style.display = flies.length ? "none" : "block";
  }

  for(const f of flies){
    const el = document.createElement("div");
    el.className = "item";

    const thumb = document.createElement("div");
    thumb.className = "thumb";

    const hasPhoto = !!(f.photo && String(f.photo).startsWith("data:image"));
    if(hasPhoto){
      thumb.innerHTML = `
        <img class="flyThumb" src="${f.photo}" alt="Fly photo" />
        <div class="sizeBadge">#${safeText(f.size || "-")}</div>
      `;
      thumb.classList.add("isPhoto");
      thumb.setAttribute("role", "button");
      thumb.setAttribute("tabindex", "0");
      const altText = `${flyLabel(f)} photo`;
      const openFull = ()=> openPhotoViewer({ src: f.photo, alt: altText });
      thumb.addEventListener("click", openFull);
      thumb.addEventListener("keydown", (event)=>{
        if(event.key === "Enter" || event.key === " "){
          event.preventDefault();
          openFull();
        }
      });
    }else{
      thumb.innerHTML = `<div class="muted" style="font-size:12px; font-weight:800;">#${safeText(f.size || "-")}</div>`;
    }

    const meta = document.createElement("div");
    meta.className = "meta";

    const line1 = document.createElement("div");
    line1.className = "line1";
    line1.textContent = flyLabel(f);

    const line2 = document.createElement("div");
    line2.className = "line2";
    line2.textContent = flySub(f);

    meta.appendChild(line1);
    meta.appendChild(line2);

    const right = document.createElement("div");
    right.className = "right";

    const qty = document.createElement("span");
    qty.className = "pill";
    qty.textContent = `Qty: ${Number(f.qty)||0}`;

    const useBtn = document.createElement("button");
    useBtn.className = "btn ghost";
    useBtn.type = "button";
    useBtn.textContent = "Use";
    useBtn.onclick = async ()=> {
      try{
        await adjustFlyQty({ flyId: f.id, delta: -1, kind: "use" });
        await refreshFlyMeta(boxId);
        await renderFlyList(boxId, setStatus);
        setStatus?.("Fly used (qty -1).");
      }catch(e){
        setStatus?.(`Use failed: ${e?.message || e}`);
      }
    };

    const addBtn2 = document.createElement("button");
    addBtn2.className = "btn ghost";
    addBtn2.type = "button";
    addBtn2.textContent = "+";
    addBtn2.onclick = async ()=> {
      try{
        await adjustFlyQty({ flyId: f.id, delta: +1, kind: "add" });
        await refreshFlyMeta(boxId);
        await renderFlyList(boxId, setStatus);
        setStatus?.("Restocked (qty +1).");
      }catch(e){
        setStatus?.(`Restock failed: ${e?.message || e}`);
      }
    };

    const editBtn = document.createElement("button");
    editBtn.className = "btn";
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.onclick = async ()=> {
      setEditingFly(f.id);

      let latest = f;
      try{
        const fromDb = await getFly(f.id);
        if(fromDb) latest = fromDb;
      }catch(_){}

      fillFlyFormFromRow(latest);
      openFlyModal("edit");
      setStatus?.("Editing fly…");
    };

    const delBtn = document.createElement("button");
    delBtn.className = "btn danger";
    delBtn.type = "button";
    delBtn.textContent = "Delete";
    delBtn.onclick = async ()=> {
      const ok = confirm(
        `Delete "${f.pattern || "this fly"}" (${f.size ? `#${f.size}` : "#-"})?\n\nThis cannot be undone.`
      );
      if(!ok) return;

      try{
        await deleteFly(f.id);
        if(state.flyEditingId === f.id) setEditingFly(null);
        await refreshFlyMeta(boxId);
        await renderFlyList(boxId, setStatus);
        setStatus?.("Fly deleted.");
      }catch(e){
        setStatus?.(`Delete failed: ${e?.message || e}`);
      }
    };

    right.appendChild(qty);
    right.appendChild(useBtn);
    right.appendChild(addBtn2);
    right.appendChild(editBtn);
    right.appendChild(delBtn);

    el.appendChild(thumb);
    el.appendChild(meta);
    el.appendChild(right);

    flyList.appendChild(el);
  }
}

async function setActiveBox(boxId, setStatus){
  state.flyBoxId = boxId || null;
  await refreshFlyMeta(boxId);
  await renderFlyList(boxId, setStatus);
}

/* ===== Delete one box ===== */
async function handleDeleteBox(setStatus){
  const boxId = flyBoxSelect?.value || state.flyBoxId;
  if(!boxId){
    setStatus?.("No fly box selected.");
    return;
  }

  const box = await getFlyBox(boxId);
  const flies = await listFliesByBox(boxId);

  const msg = flies.length
    ? `Delete "${box?.name || "this box"}" and its ${flies.length} pattern(s)?\n\nThis cannot be undone.`
    : `Delete "${box?.name || "this box"}"?\n\nThis cannot be undone.`;

  if(!confirm(msg)) return;

  await deleteFlyBox(boxId);

  const boxes = await refreshBoxSelect();
  clearFlyForm();
  await setActiveBox(boxes[0]?.id || "", setStatus);

  setStatus?.("Fly box deleted.");
}

/* =========================
   Tap helpers
========================= */

function bindTap(el, handler){
  if(!el) return;
  el.onclick = handler;

  const tag = (el.tagName || "").toLowerCase();
  if(tag === "select" || tag === "input" || tag === "textarea" || tag === "label") return;

  el.addEventListener("touchstart", ()=> {
    handler();
  }, { passive: true });
}

/* ===== Prevent concurrent writes ===== */
let _saveLock = false;
async function withLock(fn){
  if(_saveLock) return;
  _saveLock = true;
  try{ await fn(); }
  finally{ _saveLock = false; }
}

export function initFlyBox({ setStatus }){
  async function boot(){
    const boxes = await refreshBoxSelect();
    await setActiveBox(boxes[0]?.id || "", setStatus);
  }

  boot().catch((e)=> setStatus?.(`FlyBox init failed: ${e?.message || e}`));

  if(flyBoxSelect){
    flyBoxSelect.onchange = async ()=> {
      const id = flyBoxSelect.value;
      if(!id) return;
      clearFlyForm();
      await setActiveBox(id, setStatus);
      setStatus?.("Fly box loaded.");
    };
  }

  bindTap(openFlyModalBtn, async ()=> {
    clearFlyForm();
    setEditingFly(null);
    openFlyModal("add");
  });

  bindTap(flyModalClose, closeFlyModal);
  bindTap(flyModalCancel, closeFlyModal);

  bindTap(newFlyBoxBtn, async ()=> {
    await withLock(async ()=>{
      const name = prompt("New fly box name?", "My Fly Box");
      if(!name) return;

      const now = Date.now();
      const box = {
        id: uid("box"),
        name: String(name).trim(),
        notes: "",
        createdAt: now,
        updatedAt: now
      };

      await saveFlyBox(box);
      await refreshBoxSelect(box.id);
      clearFlyForm();
      await setActiveBox(box.id, setStatus);
      setStatus?.("Fly box created.");
    });
  });

  bindTap(deleteFlyBoxBtn, async ()=> {
    await withLock(async ()=>{
      try{
        await handleDeleteBox(setStatus);
      }catch(e){
        setStatus?.(`Delete box failed: ${e?.message || e}`);
      }
    });
  });

  bindTap(editFlyBoxBtn, async ()=> {
    await withLock(async ()=>{
      const boxId = flyBoxSelect?.value || state.flyBoxId;
      if(!boxId){
        setStatus?.("No fly box selected.");
        return;
      }

      const box = await getFlyBox(boxId);
      const current = String(box?.name || "My Fly Box");

      const name = prompt("Rename fly box:", current);
      if(!name) return;

      const next = String(name).trim();
      if(!next){
        setStatus?.("Name cannot be blank.");
        return;
      }

      const now = Date.now();
      await saveFlyBox({ ...box, name: next, updatedAt: now });

      await refreshBoxSelect(boxId);
      await refreshFlyMeta(boxId);
      setStatus?.("Fly box renamed.");
    });
  });

  if(flyPhoto){
    flyPhoto.onchange = async ()=> {
      await refreshPhotoPreviewFromFile();
    };
  }

  bindTap(addFlyBtn, async ()=> {
    await withLock(async ()=>{
      const boxId = state.flyBoxId;
      if(!boxId){
        setStatus?.("Pick a fly box first.");
        return;
      }

      const type = (flyType?.value || "").trim();
      const pattern = (flyPattern?.value || "").trim();
      const size = parseSize(flySize?.value || "");
      const qty = parseQty(flyQty?.value || "");
      const colors = (flyColors?.value || "").trim();

      if(!pattern || !size){
        setStatus?.("Pattern + Size are required.");
        return;
      }

      const now = Date.now();
      const wasEditing = !!state.flyEditingId;

      let createdAt = now;
      let existingPhoto = "";

      if(wasEditing){
        try{
          const existing = await getFly(state.flyEditingId);
          if(existing?.createdAt) createdAt = existing.createdAt;
          if(existing?.photo) existingPhoto = existing.photo;
        }catch(_){}
      }

      let photo = existingPhoto;
      const picked = flyPhoto?.files?.[0];
      if(picked){
        try{
          photo = await fileToDataURL(picked);
        }catch(_){
          photo = existingPhoto;
        }
      }

      const id = state.flyEditingId || uid("fly");
      const row = {
        id,
        boxId,
        type,
        pattern,
        size,
        qty,
        colors,
        photo,
        createdAt,
        updatedAt: now
      };

      await saveFly(row);

      const msg = wasEditing ? "Fly updated." : "Fly added.";
      clearFlyForm();
      closeFlyModal();
      await refreshFlyMeta(boxId);
      await renderFlyList(boxId, setStatus);
      setStatus?.(msg);
    });
  });

  return {
    refreshQuiver: async ()=>{
      const id = flyBoxSelect?.value || state.flyBoxId;
      if(!id) return;
      await refreshFlyMeta(id);
      await renderFlyList(id, setStatus);
    }
  };
}
