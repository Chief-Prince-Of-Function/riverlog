import { listCatches, getTrip } from "../storage.js";
import { safeText } from "./utils.js";
import { state } from "./state.js";
import {
  collageBtn,
  collageOverlay,
  collageModal,
  collageClose,
  collageMeta,
  collagePreview,
  collageDownload,
  collageShare,
  collageCanvas
} from "./dom.js";

/* =========================
   Collage helpers
========================= */

function parseLenNumber(val){
  const n = parseFloat(String(val || "").replace(/[^\d.]+/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function openCollageModal(){
  collageOverlay?.classList.remove("hidden");
  collageModal?.classList.remove("hidden");
  document.body.classList.add("modalOpen");
}

function closeCollageModal(){
  collageOverlay?.classList.add("hidden");
  collageModal?.classList.add("hidden");
  document.body.classList.remove("modalOpen");
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

async function blobToDataURL(blob){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(String(r.result || ""));
    r.onerror = ()=> reject(r.error);
    r.readAsDataURL(blob);
  });
}

function getSelectedTripId(){
  // Primary: module state (your app uses this everywhere)
  if(state?.tripId) return state.tripId;

  // Fallback: DOM select value
  const sel = document.querySelector("#tripSelect");
  return sel?.value || "";
}

function getSelectedTripLabel(){
  return document.querySelector("#tripSelect option:checked")?.textContent?.trim() || "Trip";
}

function downloadText(filename, text, mime="application/json"){
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 800);
}

function fmtTripDate(d){
  const s = String(d || "").trim();
  if(!s) return "";
  // keep as-is if it's already nice; else try Date parse
  const dt = new Date(s);
  if(Number.isFinite(dt.getTime())){
    return dt.toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
  }
  return s;
}

function drawMetaFooter(ctx, W, H, meta){
  const padX = Math.round(W * 0.03);
  const padY = Math.round(H * 0.02);
  const lineH = clamp(Math.round(H * 0.020), 18, 30);
  const fontPx = clamp(Math.round(H * 0.016), 14, 22);

  const lines = [
    `RiverLog ${meta.version || ""}`.trim() + (meta.tripId ? ` • TripID: ${meta.tripId}` : ""),
    `${meta.date || "-"} • ${meta.name || "-"}`,
    `Location: ${meta.location || "-"}`,
    `Winner fly: ${meta.flyWin || "-"} • Lessons: ${meta.lessons || "-"}`
  ];

  const footerH = padY*2 + lines.length*lineH;

  // Footer background strip
  ctx.save();
  ctx.globalAlpha = 0.70;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, H - footerH, W, footerH);
  ctx.restore();

  // Footer text
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.font = `${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.textBaseline = "top";
  ctx.globalAlpha = 0.95;

  let y = H - footerH + padY;
  for(const line of lines){
    ctx.fillText(line, padX, y);
    y += lineH;
  }
  ctx.restore();
}

/* =========================
   Public API
========================= */

export async function canBuildCollage(tripId){
  if(!tripId) return { ok: false, count: 0 };

  const rows = await listCatches(tripId);
  const photos = rows.filter(r => r.photoBlob instanceof Blob);
  return { ok: photos.length >= 1, count: photos.length };
}

export async function buildTripCollage(tripIdArg, tripLabel="Trip"){
  const tripId = tripIdArg || getSelectedTripId();
  if(!tripId) throw new Error("No trip selected");

  const rows = await listCatches(tripId);
  const photos = rows
    .filter(r => r.photoBlob instanceof Blob)
    .sort((a,b)=> parseLenNumber(b.length) - parseLenNumber(a.length))
    .slice(0, 9);

  if(!photos.length){
    throw new Error("No catch photos in this trip");
  }

  // Pull trip recap fields (schema matches your storage.js)
  const trip = await getTrip(tripId);

  const meta = {
    _schema: "riverlog_collage_meta",
    _version: 1,
    app: "RiverLog",
    version: "v32",
    exportedAt: Date.now(),
    tripId,
    // Trip recap fields
    name: (trip?.name || tripLabel || "").trim(),
    date: fmtTripDate(trip?.date || ""),
    location: (trip?.location || "").trim(),
    desc: (trip?.desc || "").trim(),
    flyWin: (trip?.flyWin || "").trim(),
    lessons: (trip?.lessons || "").trim(),
    recap: (trip?.recap || "").trim(),
    // helpful collage info
    collage: {
      mode: "top_by_length",
      maxPhotos: 9,
      photoCountUsed: photos.length
    }
  };

  // Load images as dataURLs (from blobs)
  const imgUrls = [];
  for(const r of photos){
    const dataUrl = await blobToDataURL(r.photoBlob);
    imgUrls.push({ url: dataUrl, row: r });
  }

  const canvas = collageCanvas;
  if(!canvas) throw new Error("Missing collageCanvas element");

  const ctx = canvas.getContext("2d");
  const W = canvas.width || 1400;
  const H = canvas.height || 1400;

  // background
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0,0,W,H);

  // layout: 3x3
  const cols = 3, rowsN = 3;
  const pad = Math.round(W * 0.02);
  const gap = Math.round(W * 0.015);

  const tileW = Math.floor((W - pad*2 - gap*(cols-1)) / cols);
  const tileH = Math.floor((H - pad*2 - gap*(rowsN-1)) / rowsN);

  function drawCover(img, x, y, w, h){
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.max(w/iw, h/ih);
    const sw = w/scale;
    const sh = h/scale;
    const sx = (iw - sw) / 2;
    const sy = (ih - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  // draw tiles
  let i = 0;
  for(let r=0;r<rowsN;r++){
    for(let c=0;c<cols;c++){
      if(i >= imgUrls.length) break;
      const x = pad + c*(tileW+gap);
      const y = pad + r*(tileH+gap);

      const img = await new Promise((resolve, reject)=>{
        const im = new Image();
        im.onload = ()=> resolve(im);
        im.onerror = reject;
        im.src = imgUrls[i].url;
      });

      drawCover(img, x, y, tileW, tileH);
      i++;
    }
  }

  // Visible metadata footer on the collage image
  drawMetaFooter(ctx, W, H, meta);

  // Export to PNG
  const pngUrl = canvas.toDataURL("image/png");
  if(collagePreview) collagePreview.src = pngUrl;

  if(collageMeta){
    const label = String(meta.name || "Trip").trim() || "Trip";
    collageMeta.textContent = `${safeText(label)} • Top catches by length`;
  }

  // Download button: PNG + sidecar JSON
  if(collageDownload){
    collageDownload.onclick = ()=>{
      // PNG
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = "riverlog_collage.png";
      document.body.appendChild(a);
      a.click();
      a.remove();

      // JSON sidecar (for imports later)
      try{
        downloadText("riverlog_collage.meta.json", JSON.stringify(meta, null, 2));
      }catch(_){}
    };
  }

  // Share button (image only)
  if(collageShare){
    collageShare.onclick = async ()=>{
      try{
        if(!navigator.share) return;
        const res = await fetch(pngUrl);
        const blob = await res.blob();
        const file = new File([blob], "riverlog_collage.png", { type: "image/png" });
        await navigator.share({ files: [file], title: "RiverLog Collage" });
      }catch(_){}
    };
  }

  openCollageModal();
  return true;
}

export function initCollage({ setStatus }){
  async function onBuild(){
    try{
      const tripId = getSelectedTripId();
      if(!tripId){
        setStatus?.("Pick a trip first.");
        return;
      }

      const label = getSelectedTripLabel();
      setStatus?.("Building collage…");
      await buildTripCollage(tripId, label);
      setStatus?.("Collage ready.");
    }catch(e){
      setStatus?.(e?.message || String(e));
    }
  }

  collageBtn?.addEventListener("click", onBuild);

  collageClose?.addEventListener("click", closeCollageModal);
  collageOverlay?.addEventListener("click", closeCollageModal);
}
