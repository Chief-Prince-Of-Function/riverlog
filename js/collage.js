import { listCatches } from "../storage.js";
import { safeText } from "./utils.js";
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

/* =========================
   Public API
========================= */

export async function canBuildCollage(tripId){
  if(!tripId) return { ok: false, count: 0 };

  const rows = await listCatches(tripId);
  const photos = rows.filter(r => r.photoBlob instanceof Blob);
  return { ok: photos.length >= 1, count: photos.length };
}

export async function buildTripCollage(tripId, tripLabel="Trip"){
  if(!tripId) throw new Error("No trip selected");

  const rows = await listCatches(tripId);
  const photos = rows
    .filter(r => r.photoBlob instanceof Blob)
    .sort((a,b)=> parseLenNumber(b.length) - parseLenNumber(a.length))
    .slice(0, 9);

  if(!photos.length){
    throw new Error("No catch photos in this trip");
  }

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

  // Export to PNG
  const pngUrl = canvas.toDataURL("image/png");
  if(collagePreview) collagePreview.src = pngUrl;

  if(collageMeta){
    const label = String(tripLabel || "Trip").trim() || "Trip";
    collageMeta.textContent = `${safeText(label)} • Top catches by length`;
  }

  // Download button
  if(collageDownload){
    collageDownload.onclick = ()=>{
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = "riverlog_collage.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
  }

  // Share button (if supported)
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
      const tripId = window.state?.tripId;
      if(!tripId){
        setStatus?.("Pick a trip first.");
        return;
      }
      const label = document.querySelector("#tripSelect option:checked")?.textContent?.trim() || "Trip";
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
