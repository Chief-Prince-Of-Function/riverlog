import { listCatches, saveCatch, deleteCatch } from "../storage.js";
import { uid } from "../storage.js";
import { fmtTime, safeText } from "./utils.js";
import { state } from "./state.js";
import {
  catchList, emptyState, catchCount,
  saveCatchBtn, gpsBtn, photoInput,
  species, fly, length, notes,
  gpsHint, photoHint,
  tripSelect,
  collageBtn,
  collageBtnTop
} from "./dom.js";

import { canBuildCollage } from "./collage.js";
import { buildTripCollage } from "./collage.js";

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

function setCollageButtonsEnabled(ok, count){
  const title = ok ? `Build collage (${count} photos)` : "Add a catch photo first";

  if(collageBtn){
    collageBtn.disabled = !ok;
    collageBtn.title = title;
    collageBtn.style.opacity = ok ? "1" : ".55";
  }
  if(collageBtnTop){
    collageBtnTop.disabled = !ok;
    collageBtnTop.title = title;
    collageBtnTop.style.opacity = ok ? "1" : ".55";
  }
}

export function initCatches({ setStatus }){
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
        setStatus("GPS added to next catch.");
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
      if(photoHint) photoHint.textContent = "Photo: none";
      return;
    }

    setStatus("Processing photo…");
    const blob = await compressImageFileToBlob(file, 1600, 0.82);
    state.pendingPhotoBlob = blob;
    state.pendingPhotoName = file.name || "photo.jpg";
    if(photoHint) photoHint.textContent = `Photo: ready (${Math.round((blob.size||0)/1024)} KB)`;
    setStatus("Photo ready for next catch.");
  });

  async function refreshCatches(){
    if(!state.tripId) return;
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

      const del = document.createElement("button");
      del.className = "btn ghost";
      del.textContent = "Delete";
      del.addEventListener("click", async ()=>{
        if(!confirm("Delete this catch?")) return;
        await deleteCatch(c.id);
        setStatus("Catch deleted.");
        await refreshCatches();
      });

      const pill = document.createElement("div");
      pill.className = "pill";
      pill.textContent = c.fly ? "Logged" : "Quick log";

      right.appendChild(pill);
      right.appendChild(del);

      el.appendChild(thumb);
      el.appendChild(meta);
      el.appendChild(right);
      catchList?.appendChild(el);
    }

    // Update collage button enable/disable state based on photo count
    try{
      const { ok, count } = await canBuildCollage(state.tripId);
      setCollageButtonsEnabled(ok, count);
    }catch(_){
      // ignore
    }
  }

  saveCatchBtn?.addEventListener("click", async ()=>{
    if(!state.tripId) return;
    const now = Date.now();

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

    state.pendingGPS = null;
    state.pendingPhotoBlob = null;
    state.pendingPhotoName = "";

    if(gpsHint) gpsHint.textContent = "GPS: not added";
    if(photoHint) photoHint.textContent = "Photo: none";
    if(photoInput) photoInput.value = "";

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
    }catch(_){
      // ignore
    }
  });

  return { refreshCatches };
}
