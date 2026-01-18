import {
  uid,
  ensureDefaultFlyBox,
  listFlyBoxes,
  getFlyBox,
  saveFlyBox,
  deleteFlyBox,
  listFliesByBox,
  getFly,               // ✅ preserve createdAt on edit
  saveFly,
  deleteFly,
  adjustFlyQty
} from "../../storage.js";

import { safeText } from "../utils.js";
import { state } from "../state.js";

import {
  flyBoxBtn,
  flyBoxCard,
  flyBoxClose,
  flyBoxMeta,
  flyBoxSelect,
  newFlyBoxBtn,
  flyType,
  flyPattern,
  flySize,
  flyQty,
  flyColors,
  addFlyBtn,
  flyList,
  deleteFlyBoxBtn,
  flyEmpty,

  // ✅ NEW (you will add in dom.js + HTML next)
  flyPhoto,
  flyPhotoPreview,
  clearFlyBoxesBtn
} from "../dom.js";

/* =========================
   FlyBox module (MVP)
   - Boxes (“quiver”)
   - Flies inventory inside a box
   - Quick +/- qty + delete
   - NEW: delete box (can delete last box)
   - NEW: clear all boxes (strong confirm)
   - NEW: photo per pattern row (offline dataURL)
========================= */

function showFlyBox(open){
  if(!flyBoxCard) return;

  // Support BOTH patterns:
  // 1) class="hidden"
  // 2) hidden attribute
  flyBoxCard.classList.toggle("hidden", !open);

  if(open){
    flyBoxCard.removeAttribute("hidden");
    flyBoxCard.setAttribute("aria-hidden", "false");
  }else{
    flyBoxCard.setAttribute("hidden", "");
    flyBoxCard.setAttribute("aria-hidden", "true");
  }
}

function parseSize(v){
  const s = String(v ?? "").trim();
  // allow "18", "18 ", "#18"
  return s.replace(/[^\d]+/g, "");
}

function parseQty(v){
  const n = Math.floor(Number(String(v ?? "").replace(/[^\d\-]+/g, "")));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function flyLabel(row){
  const t = safeText(row.type);
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

async function refreshBoxSelect(selectedId){
  const boxes = await listFlyBoxes();
  if(!flyBoxSelect) return boxes;

  flyBoxSelect.innerHTML = "";
  for(const b of boxes){
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = b.name || "Fly Box";
    flyBoxSelect.appendChild(opt);
  }

  const target = selectedId || (boxes[0]?.id || "");
  if(target) flyBoxSelect.value = target;

  return boxes;
}

async function refreshFlyMeta(boxId){
  if(!flyBoxMeta) return;
  const box = await getFlyBox(boxId);
  if(!box){
    flyBoxMeta.textContent = "—";
    return;
  }

  const flies = await listFliesByBox(boxId);
  const totalQty = flies.reduce((sum, f)=> sum + (Number(f.qty)||0), 0);

  flyBoxMeta.textContent = `${safeText(box.name)} • ${flies.length} patterns • ${totalQty} flies`;
}

function setEditingFly(id){
  state.flyEditingId = id || null;
  if(addFlyBtn){
    addFlyBtn.textContent = id ? "Update Fly" : "Add Fly";
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

async function renderFlyList(boxId, setStatus){
  if(!flyList) return;

  const flies = await listFliesByBox(boxId);

  flyList.innerHTML = "";

  if(flyEmpty){
    flyEmpty.style.display = flies.length ? "none" : "block";
  }

  for(const f of flies){
    const el = document.createElement("div");
    el.className = "item";

    // left thumb: show photo if available, else size placeholder
    const thumb = document.createElement("div");
    thumb.className = "thumb";

    const hasPhoto = !!(f.photo && String(f.photo).startsWith("data:image"));
    if(hasPhoto){
      thumb.innerHTML = `
        <img class="flyThumb" src="${f.photo}" alt="Fly photo" />
        <div class="sizeBadge">#${safeText(f.size || "-")}</div>
      `;
    }else{
      thumb.innerHTML = `<div class="muted" style="font-size:12px; font-weight:800;">#${safeText(f.size)}</div>`;
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
    qty.className = "qtyPill";
    qty.textContent = `Qty: ${Number(f.qty)||0}`;

    const useBtn = document.createElement("button");
    useBtn.className = "btn ghost";
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

    const addBtn = document.createElement("button");
    addBtn.className = "btn ghost";
    addBtn.textContent = "+";
    addBtn.onclick = async ()=> {
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
    editBtn.textContent = "Edit";
    editBtn.onclick = ()=> {
      setEditingFly(f.id);
      if(flyType) flyType.value = f.type || "";
      if(flyPattern) flyPattern.value = f.pattern || "";
      if(flySize) flySize.value = f.size || "";
      if(flyQty) flyQty.value = String(Number(f.qty)||0);
      if(flyColors) flyColors.value = f.colors || "";

      // photo: keep existing unless user picks a new one (so just clear file input)
      clearPhotoInput();

      setStatus?.("Editing fly…");
    };

    const delBtn = document.createElement("button");
    delBtn.className = "btn danger";
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
    right.appendChild(addBtn);
    right.appendChild(editBtn);
    right.appendChild(delBtn);

    el.appendChild(thumb);
    el.appendChild(meta);
    el.appendChild(right);

    flyList.appendChild(el);
  }
}

async function setActiveBox(boxId, setStatus){
  state.flyBoxId = boxId;
  await refreshFlyMeta(boxId);
  await renderFlyList(boxId, setStatus);
}

/* ===== Delete one box (ALLOWED even if it's the last box) ===== */
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

  try{
    await deleteFlyBox(boxId);

    // After delete, ensure we still have at least one box
    const ensured = await ensureDefaultFlyBox();

    // Rebuild selector + UI on ensured box
    await refreshBoxSelect(ensured.id);
    clearFlyForm();
    await setActiveBox(ensured.id, setStatus);

    setStatus?.("Fly box deleted.");
  }catch(e){
    setStatus?.(`Delete box failed: ${e?.message || e}`);
  }
}

/* ===== Clear ALL boxes (strong confirm) =====
   We delete each box id we can see, then ensure default box.
*/
async function handleClearAllBoxes(setStatus){
  const boxes = await listFlyBoxes();

  if(!boxes.length){
    // still ensure one exists
    const ensured = await ensureDefaultFlyBox();
    await refreshBoxSelect(ensured.id);
    clearFlyForm();
    await setActiveBox(ensured.id, setStatus);
    setStatus?.("No boxes to clear.");
    return;
  }

  const typed = prompt(
    `DANGER ZONE\n\nThis will delete ALL fly boxes and ALL flies inside them.\n\nType DELETE to confirm:`,
    ""
  );

  if(String(typed || "").trim().toUpperCase() !== "DELETE"){
    setStatus?.("Clear all canceled.");
    return;
  }

  try{
    // delete them all (storage should cascade flies per box)
    for(const b of boxes){
      await deleteFlyBox(b.id);
    }

    const ensured = await ensureDefaultFlyBox();
    await refreshBoxSelect(ensured.id);
    clearFlyForm();
    await setActiveBox(ensured.id, setStatus);

    setStatus?.("All fly boxes cleared.");
  }catch(e){
    setStatus?.(`Clear all failed: ${e?.message || e}`);
  }
}

export function initFlyBox({ setStatus }){
  // open
  flyBoxBtn?.addEventListener("click", async ()=> {
    showFlyBox(true);

    // ensure at least 1 box exists
    const box = await ensureDefaultFlyBox();
    await refreshBoxSelect(box.id);
    await setActiveBox(box.id, setStatus);

    setStatus?.("FlyBox ready.");
  });

  // close
  flyBoxClose?.addEventListener("click", ()=> {
    showFlyBox(false);
    clearFlyForm();
  });

  // switch boxes
  flyBoxSelect?.addEventListener("change", async ()=> {
    const id = flyBoxSelect.value;
    if(!id) return;
    clearFlyForm();
    await setActiveBox(id, setStatus);
    setStatus?.("Fly box loaded.");
  });

  // new box
  newFlyBoxBtn?.addEventListener("click", async ()=> {
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
    await setActiveBox(box.id, setStatus);
    setStatus?.("Fly box created.");
  });

  // delete active box (allowed even if last)
  deleteFlyBoxBtn?.addEventListener("click", async ()=> {
    await handleDeleteBox(setStatus);
  });

  // clear all boxes (danger)
  clearFlyBoxesBtn?.addEventListener("click", async ()=> {
    await handleClearAllBoxes(setStatus);
  });

  // photo input preview
  flyPhoto?.addEventListener("change", async ()=>{
    await refreshPhotoPreviewFromFile();
  });

  // add/update fly (pattern row)
  addFlyBtn?.addEventListener("click", async ()=> {
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

    // preserve createdAt + existing photo on edit (unless user selected a new one)
    let createdAt = now;
    let existingPhoto = "";

    if(wasEditing){
      try{
        const existing = await getFly(state.flyEditingId);
        if(existing && existing.createdAt) createdAt = existing.createdAt;
        if(existing && existing.photo) existingPhoto = existing.photo;
      }catch(_){}
    }

    // If user picked a new photo, use it; else keep existing photo.
    // This is "one photo for the pattern".
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
      photo,        // ✅ photo stored on the pattern row
      createdAt,
      updatedAt: now
    };

    try{
      await saveFly(row);
      const msg = wasEditing ? "Fly updated." : "Fly added.";

      clearFlyForm();
      await refreshFlyMeta(boxId);
      await renderFlyList(boxId, setStatus);
      setStatus?.(msg);
    }catch(e){
      setStatus?.(`Save failed: ${e?.message || e}`);
    }
  });

  return {
    openFlyBox: ()=> showFlyBox(true)
  };
}
