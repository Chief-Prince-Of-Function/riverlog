import { listCatches } from "../storage.js";
import { state } from "./state.js";
import { $, safeText } from "./utils.js";
import {
  tripSelect,
  collageBtn,
  collageBtnTop,
  collageOverlay,
  collageModal,
  collageClose,
  collageMeta,
  collagePreview,
  collageDownload,
  collageCanvas
} from "./dom.js";

/* =========================
   Trip Collage Builder (ALWAYS PNG)
   1–9: hero grid (rows of 3, centered)
   10–19: pane “scatter” collage (less patterned, more viewable)
   20+: top 20 largest by length (scatter)
========================= */

function openCollageModal(){
  collageOverlay?.classList.remove("hidden");
  collageModal?.classList.remove("hidden");
}
function closeCollageModal(){
  collageOverlay?.classList.add("hidden");
  collageModal?.classList.add("hidden");
}

collageOverlay?.addEventListener("click", closeCollageModal);
collageClose?.addEventListener("click", closeCollageModal);

function loadImgFromBlob(blob){
  return new Promise((resolve, reject)=>{
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = ()=>{
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e)=>{
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/* --- brand mark loader (logo from assets/) --- */
let _brandImgPromise = null;
function loadImgFromUrl(url){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=> resolve(img);
    img.onerror = (e)=> reject(e);
    img.src = url;
  });
}
function getBrandImg(){
  if(!_brandImgPromise){
    _brandImgPromise = loadImgFromUrl("assets/icon-192.png");
  }
  return _brandImgPromise;
}

function roundRectPath(ctx, x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
}

function drawImageCover(ctx, img, x, y, w, h){
  const ir = img.width / img.height;
  const tr = w / h;
  let sx, sy, sw, sh;

  if(ir > tr){
    sh = img.height;
    sw = sh * tr;
    sx = (img.width - sw) / 2;
    sy = 0;
  }else{
    sw = img.width;
    sh = sw / tr;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function fitText(ctx, text, maxWidth){
  let t = String(text || "");
  if(ctx.measureText(t).width <= maxWidth) return t;
  const ell = "…";
  while(t.length > 0 && ctx.measureText(t + ell).width > maxWidth){
    t = t.slice(0, -1);
  }
  return t.length ? (t + ell) : "";
}

function parseLen(val){
  const n = parseFloat(String(val || "").replace(/[^\d.]+/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatLen(val){
  const n = parseLen(val);
  if(!n) return "";
  const s = String(val || "").trim();
  const hasDecimal = s.includes(".");
  const out = hasDecimal ? n.toFixed(1) : String(Math.round(n));
  return out.replace(/\.0$/, "") + "\"";
}

function safePart(v){
  const s = String(v ?? "").trim();
  return s ? s : "-";
}

function makeCaption(c){
  const len = formatLen(c.length);
  const partLen = len ? len : "-";
  const partSpecies = safePart(c.species);
  const partFly = safePart(c.fly);
  return `${partLen} - ${partSpecies} - ${partFly}`;
}

async function getTripPhotoCatchesFromDB(tripId){
  const rows = await listCatches(tripId);
  return rows
    .filter(c => c.photoBlob instanceof Blob)
    .map(c => ({
      blob: c.photoBlob,
      lengthNum: parseLen(c.length),
      length: c.length,
      species: c.species || "",
      fly: c.fly || "",
      createdAt: c.createdAt || 0
    }));
}

/** For UI gating: are there any photos for this trip? */
export async function canBuildCollage(tripId){
  if(!tripId) return { ok:false, count:0 };
  const rows = await listCatches(tripId);
  const count = rows.filter(c => c.photoBlob instanceof Blob).length;
  return { ok: count > 0, count };
}

function makeBg(ctx, W, H){
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0,0,W,H);

  ctx.save();
  const g = ctx.createRadialGradient(W*0.45, H*0.40, 10, W*0.5, H*0.5, Math.max(W,H)*0.85);
  g.addColorStop(0, "rgba(19,163,139,.10)");
  g.addColorStop(1, "rgba(0,0,0,.60)");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
  ctx.restore();
}

function drawTile(ctx, img, x, y, w, h, caption){
  // shadow
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "black";
  ctx.filter = "blur(10px)";
  ctx.fillRect(x + 8, y + 10, w, h);
  ctx.filter = "none";
  ctx.restore();

  // card
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.10)";
  roundRectPath(ctx, x, y, w, h, 22);
  ctx.fill();
  ctx.restore();

  // inner photo area + caption band
  const pad = Math.max(16, Math.round(w * 0.06));
  const capH = Math.max(44, Math.round(h * 0.16));
  const photoX = x + pad;
  const photoY = y + pad;
  const photoW = w - pad*2;
  const photoH = h - pad*2 - capH;

  // photo
  ctx.save();
  roundRectPath(ctx, photoX, photoY, photoW, photoH, 16);
  ctx.clip();
  drawImageCover(ctx, img, photoX, photoY, photoW, photoH);
  ctx.restore();

  // caption band
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.35)";
  roundRectPath(ctx, x + pad, y + h - pad - capH, w - pad*2, capH, 14);
  ctx.fill();

  ctx.fillStyle = "rgba(238,244,255,.92)";
  ctx.font = "600 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const t = fitText(ctx, caption, w - pad*2 - 18);
  ctx.fillText(t, x + w/2, y + h - pad - capH/2);
  ctx.restore();
}

function layoutHeroRows(n){
  const rows = [];
  let remaining = n;
  while(remaining > 0){
    const take = Math.min(3, remaining);
    rows.unshift(take);
    remaining -= take;
  }
  return rows;
}

/* ---------- Deterministic random ---------- */
function mulberry32(seed){
  return function(){
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Pane scatter layout (less overlap, no ring) ---------- */
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function rectsOverlap(a, b){
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

function tryPlaceRect(rnd, area, w, h, placed, tries=180){
  // we’ll allow a little overlap (soft), but try to avoid heavy overlap
  for(let i=0;i<tries;i++){
    const x = area.x + rnd() * (area.w - w);
    const y = area.y + rnd() * (area.h - h);
    const rect = { x, y, w, h };

    let overlaps = 0;
    for(const p of placed){
      if(rectsOverlap(rect, p)) overlaps++;
      if(overlaps >= 2) break; // allow at most 1 overlap
    }

    if(overlaps < 2){
      placed.push(rect);
      return rect;
    }
  }

  // fallback: just place it somewhere valid
  const x = area.x + rnd() * (area.w - w);
  const y = area.y + rnd() * (area.h - h);
  const rect = { x, y, w, h };
  placed.push(rect);
  return rect;
}

/* --- watermark / brand mark (bottom-right) --- */
async function drawBrandMark(ctx, W, H){
  const pad = 44;
  const boxW = 130;
  const boxH = 150;
  const x = W - pad - boxW;
  const y = H - pad - boxH;

  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "rgba(10,14,24,.55)";
  roundRectPath(ctx, x, y, boxW, boxH, 18);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,.14)";
  ctx.lineWidth = 1;
  roundRectPath(ctx, x, y, boxW, boxH, 18);
  ctx.stroke();
  ctx.restore();

  let icon = null;
  try{ icon = await getBrandImg(); }catch(_){ icon = null; }

  const iconSize = 56;
  const iconX = x + Math.round((boxW - iconSize)/2);
  const iconY = y + 18;

  if(icon){
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.filter = "blur(10px)";
    ctx.fillRect(iconX + 4, iconY + 6, iconSize, iconSize);
    ctx.filter = "none";

    ctx.fillStyle = "rgba(255,255,255,.08)";
    roundRectPath(ctx, iconX-8, iconY-8, iconSize+16, iconSize+16, 18);
    ctx.fill();

    ctx.globalAlpha = 0.95;
    ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = "rgba(238,244,255,.92)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("RiverLog", x + boxW/2, y + boxH - 34);

  ctx.fillStyle = "rgba(238,244,255,.60)";
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Offline-first", x + boxW/2, y + boxH - 16);
  ctx.restore();
}

async function buildTripCollage(tripId, tripLabel){
  const canvas = collageCanvas || $("collageCanvas");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;

  makeBg(ctx, W, H);

  // collect + sort by length desc (ties: newest first)
  let items = await getTripPhotoCatchesFromDB(tripId);
  items.sort((a,b)=>{
    const dl = (b.lengthNum||0) - (a.lengthNum||0);
    if(dl !== 0) return dl;
    return (b.createdAt||0) - (a.createdAt||0);
  });

  const nTotal = items.length;

  if(nTotal === 0){
    if(collageMeta) collageMeta.textContent = "No catch photos found for this trip.";
    if(collagePreview) collagePreview.src = "";
    openCollageModal();
    return;
  }

  // selection rule:
  //  - 1–19 => use all
  //  - 20+  => use top 20 by length
  const use = (nTotal >= 20) ? items.slice(0,20) : items.slice(0, nTotal);
  const n = use.length;

  // load images
  const imgs = await Promise.all(use.map(x=> loadImgFromBlob(x.blob)));

  // header
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "rgba(238,244,255,.92)";
  ctx.font = "800 38px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(tripLabel || "Trip Collage", 54, 70);

  ctx.fillStyle = "rgba(238,244,255,.72)";
  ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, Arial";

  let subtitle = "";
  if(nTotal >= 20){
    subtitle = `Top 20 biggest (from ${nTotal} photo catches)`;
  }else if(nTotal >= 10){
    subtitle = `${nTotal} photo catches • Collage unlocked`;
  }else{
    subtitle = `${nTotal} photo catches`;
  }
  ctx.fillText(subtitle, 56, 96);
  ctx.restore();

  // layout area (below header)
  const area = { x: 54, y: 126, w: W - 108, h: H - 176 };
  const gap = 18;

  if(n <= 9){
    // HERO GRID: rows of 3, centered
    const rows = layoutHeroRows(n);
    const cols = 3;
    const totalRows = rows.length;

    const tileW = Math.floor((area.w - gap*(cols-1)) / cols);
    const tileH = Math.floor((area.h - gap*(totalRows-1)) / totalRows);

    const gridH = tileH*totalRows + gap*(totalRows-1);
    const startY = area.y + Math.floor((area.h - gridH)/2);

    let idx = 0;
    for(let r=0; r<rows.length; r++){
      const k = rows[r];
      const rowW = tileW*k + gap*(k-1);
      const startX = area.x + Math.floor((area.w - rowW)/2);

      for(let c=0; c<k; c++){
        const x = startX + c*(tileW + gap);
        const y = startY + r*(tileH + gap);
        drawTile(ctx, imgs[idx], x, y, tileW, tileH, makeCaption(use[idx]));
        idx++;
      }
    }
  }else{
    // PANE SCATTER COLLAGE (10–20): less pattern, more viewable
    // Deterministic seed per trip + count
    const seed = (String(tripId || "trip").split("").reduce((a,c)=>a + c.charCodeAt(0), 0) + n*97) >>> 0;
    const rnd = mulberry32(seed);

    // Keep a safe zone for brand mark (bottom-right)
    const brandSafe = { x: area.x + area.w - 220, y: area.y + area.h - 240, w: 220, h: 240 };

    // base tile sizes (bigger than before, less overlap)
    const baseW = Math.round(area.w * 0.34);
    const baseH = Math.round(area.h * 0.30);

    const placed = [];

    // Place the hero (largest fish) near center
    {
      const heroW = Math.round(baseW * 1.08);
      const heroH = Math.round(baseH * 1.08);
      const heroX = area.x + Math.round((area.w - heroW)/2);
      const heroY = area.y + Math.round((area.h - heroH)/2);

      placed.push({ x: heroX, y: heroY, w: heroW, h: heroH });
      const rot = ((rnd()*14) - 7) * Math.PI/180;
      // draw hero last for prominence? we’ll draw in z-order later.
      // For simplicity, draw hero first but it’s large anyway.
      drawTile(ctx, imgs[0], heroX, heroY, heroW, heroH, makeCaption(use[0]));
    }

    // Scatter the rest, trying to avoid heavy overlap
    for(let i=1;i<n;i++){
      const depth = i / (n-1);
      const scale = clamp(1.0 - depth*0.18, 0.80, 1.0);
      const w = Math.round(baseW * scale);
      const h = Math.round(baseH * scale);

      // shrink area slightly so tiles don't touch edges
      const inset = 8;
      const usable = {
        x: area.x + inset,
        y: area.y + inset,
        w: area.w - inset*2,
        h: area.h - inset*2
      };

      const rect = tryPlaceRect(rnd, usable, w, h, placed, 220);

      // avoid brand safe zone (simple push away)
      if(rectsOverlap(rect, brandSafe)){
        rect.x = clamp(rect.x - 120, usable.x, usable.x + usable.w - rect.w);
        rect.y = clamp(rect.y - 120, usable.y, usable.y + usable.h - rect.h);
      }

      // tiny rotation for “collage” feel, but not crazy
      const rot = ((rnd()*10) - 5) * Math.PI/180;

      // We’re drawing as panes (no polaroid frame). This makes it feel “pane collage”
      // If you want polaroid frames back, tell me and we’ll wrap it.
      ctx.save();
      // rotation about center
      const cx = rect.x + rect.w/2;
      const cy = rect.y + rect.h/2;
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.translate(-cx, -cy);
      drawTile(ctx, imgs[i], rect.x, rect.y, rect.w, rect.h, makeCaption(use[i]));
      ctx.restore();
    }
  }

  // add brand mark on top
  try{ await drawBrandMark(ctx, W, H); }catch(_){}

  const dataUrl = canvas.toDataURL("image/png");

  if(collageMeta){
    let meta = "";
    if(nTotal >= 20){
      meta = `Top 20 by length • ${tripLabel || ""}`.trim();
    }else if(nTotal >= 10){
      meta = `${nTotal} photos • Collage unlocked • ${tripLabel || ""}`.trim();
    }else{
      meta = `${nTotal} photos • ${tripLabel || ""}`.trim();
    }
    collageMeta.textContent = meta;
  }

  if(collagePreview) collagePreview.src = dataUrl;

  if(collageDownload){
    collageDownload.onclick = ()=>{
      const a = document.createElement("a");
      a.href = dataUrl;
      const safe = (tripLabel || "trip").replace(/[^\w\-]+/g, "_");
      a.download = `RiverLog_${safe}_collage.png`;
      a.click();
    };
  }

  openCollageModal();
}

export function initCollage({ setStatus }){
  async function onBuildCollage(){
    if(!state.tripId) return;

    const { ok, count } = await canBuildCollage(state.tripId);
    if(!ok){
      setStatus("Add at least 1 catch photo to build a collage.");
      return;
    }

    const label = tripSelect?.selectedOptions?.[0]?.textContent?.trim()
      || safeText(tripSelect?.value)
      || "Trip";

    setStatus(`Building collage… (${count} photos)`);
    try{
      await buildTripCollage(state.tripId, label);
      setStatus("Collage ready.");
    }catch(e){
      setStatus(`Collage failed: ${e.message || e}`);
    }
  }

  collageBtn?.addEventListener("click", onBuildCollage);
  collageBtnTop?.addEventListener("click", onBuildCollage);

  return { buildTripCollage };
}

export { buildTripCollage };
