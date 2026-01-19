import { listCatches, saveCatch, deleteCatch, getCatchById, getTrip, uid } from "../storage.js";
import { fmtTime, safeText } from "./utils.js";
import { state } from "./state.js";
import {
  catchList, emptyState, catchCount,
  saveCatchBtn, gpsBtn, photoInput,
  species, fly, length, notes,
  gpsHint, photoHint,
  tripSelect,
  collageBtn,
  catchesCollapse, catchesSummaryMeta, tripMeta
} from "./dom.js";

import { canBuildCollage, buildTripCollage } from "./collage.js";

/* =========================
   Badge engine (local, device-based)
========================= */

const BADGE_KEY = "riverlog_badges_v1";

function getEarnedSet(){
  try{
    const raw = localStorage.getItem(BADGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  }catch(_){
    return new Set();
  }
}

function saveEarnedSet(set){
  try{ localStorage.setItem(BADGE_KEY, JSON.stringify(Array.from(set))); }catch(_){}
}

function unlockBadge(id, payload = {}){
  const earned = getEarnedSet();
  if(earned.has(id)) return false;
  earned.add(id);
  saveEarnedSet(earned);

  try{
    window.dispatchEvent(new CustomEvent("riverlog:badge_unlock", {
      detail: { id, ...payload }
    }));
  }catch(_){}

  return true;
}

function parseLenNumber(val){
  const n = parseFloat(String(val || "").replace(/[^\d.]+/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function evalBadgesFromRows(rows){
  const total = rows.length;
  const photoCount = rows.filter(r => r.photoBlob instanceof Blob).length;
  const gpsCount = rows.filter(r => r.gps && typeof r.gps.lat === "number").length;

  if(total >= 1) unlockBadge("first_catch", { title: "First Catch", sub: "Log started." });

  if(photoCount >= 1) unlockBadge("first_photo", { title: "First Photo", sub: "A memory worth keeping." });
  if(gpsCount >= 1) unlockBadge("first_gps", { title: "First GPS", sub: "Location pinned." });

  if(total >= 5) unlockBadge("five_catches", { title: "5 Catches", sub: "You’re on fish." });
  if(total >= 10) unlockBadge("ten_catches", { title: "10 Catches", sub: "That’s a day." });
  if(total >= 20) unlockBadge("twenty_catches", { title: "20 Catches", sub: "Legend session." });

  if(photoCount >= 10) unlockBadge("collage_unlocked", { title: "Collage Unlocked", sub: "10 photo catches." });

  const lengths = rows.map(r => parseLenNumber(r.length)).filter(n => n > 0);
  if(lengths.length){
    const best = Math.max(...lengths);
    const PB_KEY = "riverlog_pb_in";
    const prev = parseFloat(localStorage.getItem(PB_KEY) || "0") || 0;
    if(best > prev){
      localStorage.setItem(PB_KEY, String(best));
      unlockBadge("new_pb", { title: "New PB", sub: `New personal best: ${best}"` });
    }
  }

  return { total, photoCount, gpsCount };
}

/* =========================
   Photo processing
========================= */

async function compressImageFileToBlob(file, maxEdge=1600, quality=0.82){
  const img = await loadImageFromFile(file);
  const { w, h } = fitWithin(img.naturalWidth || img.width, img.naturalHeight || img.height, maxEdge);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  return await new Promise((resolve)=>{
    canvas.toBlob((blob)=> resolve(blob || file), "image/jpeg", quality);
  });
}

function fitWithin(w, h, maxEdge){
  w = w || 1; h = h || 1;
  const scale = Math.min(1, maxEdge / Math.max(w,h));
  return { w: Math.round(w*scale), h: Math.round(h*scale) };
}

function loadImageFromFile(file){
  return new Promise((resolve, reject)=>{
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=>{ URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e)=>{ URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

/* =========================
   Collage button enable/disable
========================= */

function setCollageButtonsEnabled(ok, count){
  const title = ok ? `Build collage (${count} photos)` : "Add a catch photo first";

  if(collageBtn){
    collageBtn.disabled = !ok;
    collageBtn.title = title;
    collageBtn.style.opacity = ok ? "1" : ".55";
  }
}

/* =========================
   Mobile select reliability
========================= */

// Prevent “open then instantly close” on iOS by stopping touch bubbling.
// IMPORTANT: do NOT preventDefault here (that can break native select).
function stabilizeSelect(el){
  if(!el) return;
  el.addEventListener("touchstart", (e)=> e.stopPropagation(), { passive: true });
  el.addEventListener("pointerdown", (e)=> e.stopPropagation(), { passive: true });
}

/* =========================
   Module
========================= */

export function initCatches({ setStatus }){
  // Editing state
  let editingCatchId = null;

  // Photo preview URL (avoid leaks)
  let _pendingPhotoUrl = "";

  function clearPendingPhotoPreview(){
    try{
      if(_pendingPhotoUrl){
        URL.revokeObjectURL(_pendingPhotoUrl);
        _pendingPhotoUrl = "";
      }
    }catch(_){}
  }

  function resetPendingAddOns(){
    state.pendingGPS = null;
    state.pendingPhotoBlob = null;
    state.pendingPhotoName = "";

    clearPendingPhotoPreview();

    if(gpsHint) gpsHint.textContent = "GPS: not added";

    if(photoHint){
      // keep it simple + consistent
      photoHint.textContent = "Photo: none";
    }

    if(photoInput) photoInput.value = "";
  }

  // Make Trip + Species selects more reliable on mobile
  stabilizeSelect(tripSelect);
  stabilizeSelect(species);

  function beginEditCatch(c){
    editingCatchId = c.id;

    // clear pending so we don’t accidentally apply old add-ons
    resetPendingAddOns();

    if(species) species.value = c.species || "";
    if(fly) fly.value = c.fly || "";
    if(length) length.value = c.length || "";
    if(notes) notes.value = c.notes || "";

    if(saveCatchBtn){
      saveCatchBtn.textContent = "Update Catch";
      saveCatchBtn.classList.add("isEditing");
    }

    setStatus("Editing catch. Update fields, then tap “Update Catch”.");
  }

  function endEditMode(){
    editingCatchId = null;

    if(saveCatchBtn){
      saveCatchBtn.textContent = "Save Catch";
      saveCatchBtn.classList.remove("isEditing");
    }

    resetPendingAddOns();
  }

  // If user switches trips while editing, bail out of edit mode
  const originalTripSelectHandler = tripSelect?.onchange;
  if(tripSelect){
    tripSelect.addEventListener("change", ()=>{
      if(editingCatchId){
        endEditMode();
        setStatus("Edit canceled (switched trips).");
      }
      if(typeof originalTripSelectHandler === "function"){
        originalTripSelectHandler();
      }
    });
  }

  gpsBtn?.addEventListener("click", ()=>{
    if(!navigator.geolocation){
      setStatus("GPS not supported on this device.");
      return;
    }
    setStatus("Getting GPS…");
    navigator.geolocation.getCurrentPosition(
      (pos)=>{
        state.pendingGPS = {
          lat: +pos.coords.latitude.toFixed(6),
          lon: +pos.coords.longitude.toFixed(6),
          acc: Math.round(pos.coords.accuracy || 0),
          ts: Date.now()
        };
        if(gpsHint) gpsHint.textContent = `GPS: ${state.pendingGPS.lat}, ${state.pendingGPS.lon} (±${state.pendingGPS.acc}m)`;
        setStatus(editingCatchId ? "GPS ready (will replace on update)." : "GPS added to next catch.");
      },
      (err)=>{
        setStatus(`GPS failed: ${err.message || "permission denied"}`);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });

  photoInput?.addEventListener("change", async (e)=>{
    const file = e.target.files && e.target.files[0];
    if(!file){
      state.pendingPhotoBlob = null;
      state.pendingPhotoName = "";
      clearPendingPhotoPreview();
      if(photoHint) photoHint.textContent = "Photo: none";
      return;
    }

    setStatus("Processing photo…");
    const blob = await compressImageFileToBlob(file, 1600, 0.82);
    state.pendingPhotoBlob = blob;
    state.pendingPhotoName = file.name || "photo.jpg";

    // Preview (uses the COMPRESSED blob)
    clearPendingPhotoPreview();
    try{
      _pendingPhotoUrl = URL.createObjectURL(blob);
      if(photoHint){
        const kb = Math.round((blob.size || 0) / 1024);
        photoHint.innerHTML = `
          <div style="display:flex; gap:10px; align-items:center;">
            <img src="${_pendingPhotoUrl}" alt="Catch photo preview"
                 style="width:52px; height:52px; object-fit:cover; border-radius:12px; border:1px solid rgba(255,255,255,.14);" />
            <div class="muted">Photo: ready (${kb} KB)</div>
          </div>
        `;
      }
    }catch(_){
      if(photoHint) photoHint.textContent = `Photo: ready (${Math.round((blob.size||0)/1024)} KB)`;
    }

    setStatus(editingCatchId ? "Photo ready (will replace on update)." : "Photo ready for next catch.");
  });

  async function refreshCatches(){
    if(!state.tripId) return;
        // === Catches header context (Trip date + name/location) ===
    try{
      const trip = await getTrip(state.tripId);
      const label = (trip?.name || trip?.location || "").trim();

      const dateStr = (trip?.date || "").trim()
        ? new Date(trip.date).toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" })
        : "";

      // Update the <summary> text inside the catches <details>
      const summaryEl = catchesCollapse?.querySelector("summary");
      if(summaryEl){
        summaryEl.innerHTML = `Catches <span class="muted">· ${dateStr}${label ? ` — ${safeText(label)}` : ""}</span>`;
      }
    }catch(_){}
    const rows = await listCatches(state.tripId);

    if(catchCount) catchCount.textContent = String(rows.length);
    if(catchList) catchList.innerHTML = "";
    if(emptyState) emptyState.style.display = rows.length ? "none" : "block";

    for(const c of rows){
      const el = document.createElement("div");
      el.className = "item";

      const thumb = document.createElement("div");
      thumb.className = "thumb";

      if(c.photoBlob instanceof Blob){
        const img = document.createElement("img");
        const url = URL.createObjectURL(c.photoBlob);
        img.src = url;
        img.onload = ()=> URL.revokeObjectURL(url);
        thumb.appendChild(img);
      }else{
        thumb.textContent = "No photo";
        thumb.style.color = "rgba(238,244,255,.55)";
        thumb.style.fontSize = "12px";
      }

      const meta = document.createElement("div");
      meta.className = "meta";

      const line1 = document.createElement("div");
      line1.className = "line1";
      const sp = safeText(c.species) === "-" ? "Catch" : c.species;
      const len = safeText(c.length);
      line1.textContent = sp + (len !== "-" ? ` • ${len}\"` : "");

      const line2 = document.createElement("div");
      line2.className = "line2";
      const bits = [fmtTime(c.createdAt)];
      const flyTxt = safeText(c.fly);
      if(flyTxt !== "-") bits.push(`Fly: ${flyTxt}`);
      if(c.gps && typeof c.gps.lat === "number") bits.push(`GPS: ${c.gps.lat}, ${c.gps.lon}`);
      const noteTxt = safeText(c.notes);
      if(noteTxt !== "-") bits.push(noteTxt);
      line2.textContent = bits.join(" • ");

      meta.appendChild(line1);
      meta.appendChild(line2);

      const right = document.createElement("div");
      right.className = "right";

      const pill = document.createElement("div");
      pill.className = "pill";
      pill.textContent = c.fly ? "Logged" : "Quick log";

      const edit = document.createElement("button");
      edit.className = "btn ghost";
      edit.textContent = (editingCatchId === c.id) ? "Editing…" : "Edit";
      edit.disabled = (editingCatchId === c.id);
      edit.addEventListener("click", async ()=>{
        const fresh = await getCatchById(c.id);
        if(!fresh) return;
        beginEditCatch(fresh);
      });

      const del = document.createElement("button");
      del.className = "btn ghost";
      del.textContent = "Delete";
      del.addEventListener("click", async ()=>{
        if(!confirm("Delete this catch?")) return;

        if(editingCatchId === c.id){
          endEditMode();
        }

        await deleteCatch(c.id);
        setStatus("Catch deleted.");
        await refreshCatches();
      });

      right.appendChild(pill);
      right.appendChild(edit);
      right.appendChild(del);

      el.appendChild(thumb);
      el.appendChild(meta);
      el.appendChild(right);
      catchList?.appendChild(el);
    }

    try{ evalBadgesFromRows(rows); }catch(_){}

    try{
      const { ok, count } = await canBuildCollage(state.tripId);
      setCollageButtonsEnabled(ok, count);
    }catch(_){}
  }

  saveCatchBtn?.addEventListener("click", async ()=>{
    if(!state.tripId) return;
    const now = Date.now();

    // === UPDATE EXISTING ===
    if(editingCatchId){
      const existing = await getCatchById(editingCatchId);
      if(!existing){
        setStatus("Could not load catch to edit.");
        endEditMode();
        return;
      }

      const next = {
        ...existing,
        updatedAt: now,
        species: (species?.value || "").trim(),
        fly: (fly?.value || "").trim(),
        length: (length?.value || "").trim(),
        notes: (notes?.value || "").trim(),
        gps: (state.pendingGPS != null) ? state.pendingGPS : existing.gps,
        photoBlob: (state.pendingPhotoBlob instanceof Blob) ? state.pendingPhotoBlob : existing.photoBlob
      };

      await saveCatch(next);

      if(species) species.value = "";
      if(fly) fly.value = "";
      if(length) length.value = "";
      if(notes) notes.value = "";

      endEditMode();
      setStatus("Catch updated.");
      await refreshCatches();
      return;
    }

    // === CREATE NEW ===
    const row = {
      id: uid("catch"),
      tripId: state.tripId,
      createdAt: now,
      updatedAt: now,
      species: (species?.value || "").trim(),
      fly: (fly?.value || "").trim(),
      length: (length?.value || "").trim(),
      notes: (notes?.value || "").trim(),
      gps: state.pendingGPS,
      photoBlob: state.pendingPhotoBlob
    };

    await saveCatch(row);

    if(species) species.value = "";
    if(fly) fly.value = "";
    if(length) length.value = "";
    if(notes) notes.value = "";

    resetPendingAddOns();

    setStatus("Catch saved.");
    await refreshCatches();

    // Collage unlock moment: auto-build when you hit EXACTLY 10 photo catches
    try{
      const { ok, count } = await canBuildCollage(state.tripId);
      if(ok && count === 10){
        const label = tripSelect?.selectedOptions?.[0]?.textContent?.trim() || "Trip";
        setStatus("Collage unlocked — building…");
        await buildTripCollage(state.tripId, label);
        setStatus("Collage ready.");
      }
    }catch(_){}
  });

  return { refreshCatches };
}
