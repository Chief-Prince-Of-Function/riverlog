import {
  uid,
  ensureDefaultFlyBox,
  listFlyBoxes,
  getFlyBox,
  saveFlyBox,
  deleteFlyBox,
  listFliesByBox,
  saveFly,
  deleteFly,
  adjustFlyQty
} from "../storage.js";

import { safeText } from "./utils.js";
import { state } from "./state.js";
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
  flyEmpty
} from "./dom.js";

/* =========================
   FlyBox module (MVP)
   - Boxes (“quiver”)
   - Flies inventory inside a box
   - Quick +/- qty + delete
========================= */

function showFlyBox(open){
  if(!flyBoxCard) return;
  flyBoxCard.classList.toggle("hidden", !open);
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
  const sz = safeText(row.size);
  return `${t} • ${p} • #${sz}`;
}

function flySub(row){
  const c = String(row.colors || "").trim();
  return c ? c : "—";
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

    // left thumb placeholder (you can replace with photo later)
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.innerHTML = `<div class="muted" style="font-size:12px; font-weight:800;">#${safeText(f.size)}</div>`;

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
    useBtn.onclick = async ()=>{
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
    addBtn.onclick = async ()=>{
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
    editBtn.onclick = ()=>{
      setEditingFly(f.id);
      if(flyType) flyType.value = f.type || "";
      if(flyPattern) flyPattern.value = f.pattern || "";
      if(flySize) flySize.value = f.size || "";
      if(flyQty) flyQty.value = String(Number(f.qty)||0);
      if(flyColors) flyColors.value = f.colors || "";
      setStatus?.("Editing fly…");
    };

    const delBtn = document.createElement("button");
    delBtn.className = "btn danger";
    delBtn.textContent = "Delete";
    delBtn.onclick = async ()=>{
      const ok = confirm(`Delete "${f.pattern || "this fly"}" (#${f.size || "-"})?\n\nThis cannot be undone.`);
      if(!ok) return;

      try{
        await deleteFly(f.id);
        setEditingFly(null);
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

export function initFlyBox({ setStatus }){
  // open/close
  flyBoxBtn?.addEventListener("click", async ()=>{
    showFlyBox(true);

    // ensure at least 1 box exists
    const box = await ensureDefaultFlyBox();
    await refreshBoxSelect(box.id);
    await setActiveBox(box.id, setStatus);

    setStatus?.("FlyBox ready.");
  });

  flyBoxClose?.addEventListener("click", ()=>{
    showFlyBox(false);
    clearFlyForm();
  });

  // switch boxes
  flyBoxSelect?.addEventListener("change", async ()=>{
    const id = flyBoxSelect.value;
    if(!id) return;
    clearFlyForm();
    await setActiveBox(id, setStatus);
    setStatus?.("Fly box loaded.");
  });

  // new box
  newFlyBoxBtn?.addEventListener("click", async ()=>{
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

  // add/update fly
  addFlyBtn?.addEventListener("click", async ()=>{
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

    const id = state.flyEditingId || uid("fly");
    const row = {
      id,
      boxId,
      type,
      pattern,
      size,
      qty,
      colors,
      createdAt: state.flyEditingId ? (now) : now,
      updatedAt: now
    };

    try{
      await saveFly(row);
      clearFlyForm();
      await refreshFlyMeta(boxId);
      await renderFlyList(boxId, setStatus);
      setStatus?.(state.flyEditingId ? "Fly updated." : "Fly added.");
    }catch(e){
      setStatus?.(`Save failed: ${e?.message || e}`);
    }
  });

  return {
    openFlyBox: ()=> showFlyBox(true)
  };
}
