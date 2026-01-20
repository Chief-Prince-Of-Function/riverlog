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
  if(state?.tripId) return state.tripId;
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
  const dt = new Date(s);
  if(Number.isFinite(dt.getTime())){
    return dt.toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
  }
  return s;
}

/* ---------- Drawing helpers ---------- */

function roundRect(ctx, x, y, w, h, r){
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

function drawTopLeftMeta(ctx, W, H, meta){
  const pad = Math.round(W * 0.05);
  const titleSize = clamp(Math.round(H * 0.045), 28, 54);
  const subSize   = clamp(Math.round(H * 0.020), 14, 24);

  const name = (meta.name || "Trip").trim();
  const date = (meta.date || "").trim();
  const where = (meta.location || "").trim();

  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "top";

  ctx.globalAlpha = 0.95;
  ctx.font = `700 ${titleSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.fillText(`${name}${date ? ` • ${date}` : ""}`, pad, pad);

  let y = pad + Math.round(titleSize * 1.08);

  if(where){
    ctx.globalAlpha = 0.78;
    ctx.font = `400 ${subSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.fillText(`Location: ${where}`, pad, y);
    y += Math.round(subSize * 1.35);
  }

  if(meta?.collage){
    const used = meta.collage.photoCountUsed || 0;
    const total = meta.collage.photoTotal ?? used;
    ctx.globalAlpha = 0.60;
    ctx.font = `400 ${subSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.fillText(`Top ${used} biggest (from ${total} photo catches)`, pad, y);
  }

  ctx.restore();
}

// Classic pill badge (restores your “good” vibe)
function drawBottomRightBadge(ctx, W, H){
  const pad = Math.round(W * 0.04);

  const pillW = Math.round(W * 0.22);
  const pillH = Math.round(H * 0.085);
  const x = W - pad - pillW;
  const y = H - pad - pillH;
  const r = Math.round(pillH * 0.45);

  // shadow + frosted pill
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.40)";
  ctx.shadowBlur = Math.round(pillH * 0.22);
  ctx.shadowOffsetY = Math.round(pillH * 0.10);

  ctx.globalAlpha = 0.34;
  ctx.fillStyle = "#0b1020";
  roundRect(ctx, x, y, pillW, pillH, r);
  ctx.fill();

  ctx.restore();

  // subtle stroke
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, pillW, pillH, r);
  ctx.stroke();
  ctx.restore();

  // icon disk
  const cx = x + Math.round(pillH * 0.62);
  const cy = y + Math.round(pillH * 0.52);
  const cr = Math.round(pillH * 0.28);

  ctx.save();
  ctx.globalAlpha = 0.90;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx, cy, cr, 0, Math.PI * 2);
  ctx.fill();

  // simple fish glyph (dark)
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#0b1020";
  // body
  ctx.beginPath();
  ctx.ellipse(cx + cr*0.15, cy, cr*0.62, cr*0.42, 0, 0, Math.PI*2);
  ctx.fill();
  // tail
  ctx.beginPath();
  ctx.moveTo(cx - cr*0.55, cy);
  ctx.lineTo(cx - cr*0.95, cy - cr*0.35);
  ctx.lineTo(cx - cr*0.95, cy + cr*0.35);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // text
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "top";

  const titleSize = clamp(Math.round(H * 0.022), 14, 22);
  const subSize   = clamp(Math.round(H * 0.016), 11, 18);

  const tx = x + Math.round(pillH * 1.15);
  const ty = y + Math.round(pillH * 0.20);

  ctx.globalAlpha = 0.92;
  ctx.font = `700 ${titleSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.fillText("RiverLog", tx, ty);

  ctx.globalAlpha = 0.70;
  ctx.font = `400 ${subSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.fillText("Offline-first", tx, ty + Math.round(titleSize * 1.05));

  ctx.restore();
}

function drawCover(ctx, img, x, y, w, h){
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(w/iw, h/ih);
  const sw = w/scale;
  const sh = h/scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function captionForRow(row){
  const len = parseLenNumber(row?.length);
  const species = String(row?.species || "").trim();
  const fly = String(row?.fly || "").trim();

  if(len && (species || fly)){
    const l = `${Math.round(len)}"`;
    return `${l}${species ? ` - ${species}` : ""}${fly ? ` - ${fly}` : ""}`;
  }
  if(species) return `-- ${species} --`;
  return `-- Catch --`;
}

function drawCaption(ctx, text, x, y, w, h){
  const pad = Math.round(w * 0.06);
  const maxW = w - pad*2;
  const fontSize = clamp(Math.round(h * 0.42), 12, 22);

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.72)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${fontSize}px ui-rounded, system-ui, -apple-system, Segoe UI, Roboto, Arial`;

  let t = String(text || "").trim() || "— —";
  while(ctx.measureText(t).width > maxW && t.length > 6){
    t = t.slice(0, -2).trim() + "…";
  }

  ctx.fillText(t, x + w/2, y + h/2);
  ctx.restore();
}

// deterministic RNG so the same trip yields same layout
function xmur3(str){
  let h = 1779033703 ^ str.length;
  for(let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rectsOverlap(a, b, pad=0){
  return !(
    a.x + a.w + pad < b.x ||
    a.x > b.x + b.w + pad ||
    a.y + a.h + pad < b.y ||
    a.y > b.y + b.h + pad
  );
}

function drawPolaroid(ctx, img, x, y, w, h, angleRad, caption){
  // Polaroid structure
  const border = Math.round(w * 0.045);
  const bottomStrip = Math.round(h * 0.17);
  const innerX = border;
  const innerY = border;
  const innerW = w - border*2;
  const innerH = h - border*2 - bottomStrip;

  ctx.save();
  ctx.translate(x + w/2, y + h/2);
  ctx.rotate(angleRad);

  // shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = Math.round(h * 0.12);
  ctx.shadowOffsetY = Math.round(h * 0.04);

  ctx.fillStyle = "rgba(255,255,255,.94)";
  roundRect(ctx, -w/2, -h/2, w, h, Math.round(h * 0.06));
  ctx.fill();
  ctx.restore();

  // photo area
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, -w/2 + innerX, -h/2 + innerY, innerW, innerH, Math.round(h * 0.03));
  ctx.clip();
  drawCover(ctx, img, -w/2 + innerX, -h/2 + innerY, innerW, innerH);
  ctx.restore();

  // caption
  const capX = -w/2 + innerX;
  const capY = -h/2 + innerY + innerH + Math.round(border * 0.65);
  const capW = innerW;
  const capH = bottomStrip;

  drawCaption(ctx, caption, capX, capY, capW, capH);

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

  const photoRows = rows.filter(r => r.photoBlob instanceof Blob);

  // Keep top-by-length (like your intent), but allow up to 20 for the “scatter” vibe
  const maxPhotos = 20;
  const photos = photoRows
    .slice()
    .sort((a,b)=> parseLenNumber(b.length) - parseLenNumber(a.length))
    .slice(0, maxPhotos);

  if(!photos.length){
    throw new Error("No catch photos in this trip");
  }

  const trip = await getTrip(tripId);

  const meta = {
    _schema: "riverlog_collage_meta",
    _version: 1,
    app: "RiverLog",
    version: "v32",
    exportedAt: Date.now(),
    tripId,
    name: (trip?.name || tripLabel || "").trim(),
    date: fmtTripDate(trip?.date || ""),
    location: (trip?.location || "").trim(),
    desc: (trip?.desc || "").trim(),
    flyWin: (trip?.flyWin || "").trim(),
    lessons: (trip?.lessons || "").trim(),
    recap: (trip?.recap || "").trim(),
    collage: {
      mode: "top_by_length",
      maxPhotos,
      photoCountUsed: photos.length,
      photoTotal: photoRows.length
    }
  };

  // Convert blobs -> data URLs
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

  // preload images
  const loaded = await Promise.all(
    imgUrls.map(({url,row})=> new Promise((resolve, reject)=>{
      const im = new Image();
      im.onload = ()=> resolve({ img: im, row });
      im.onerror = reject;
      im.src = url;
    }))
  );

  // deterministic scatter layout per trip
  const seedFn = xmur3(String(tripId || meta.name || "riverlog"));
  const rand = mulberry32(seedFn());

  // Polaroid sizing & safe area (don’t collide with meta/badge too much)
  const baseW = Math.round(W * 0.34);
  const baseH = Math.round(baseW * 1.08);

  const safePad = Math.round(W * 0.06);
  const topSafe = Math.round(H * 0.16);      // room for top-left meta
  const bottomSafe = Math.round(H * 0.12);   // room for badge

  const placed = [];

  // Draw larger first (nice layering)
  const count = loaded.length;
  const order = Array.from({length: count}, (_,i)=>i);

  // slight “size falloff” so top catches are bigger
  function sizeForIndex(idx){
    const t = idx / Math.max(1, count - 1); // 0..1
    const scale = clamp(1.05 - t*0.35, 0.70, 1.05);
    const w = Math.round(baseW * scale);
    const h = Math.round(baseH * scale);
    return { w, h };
  }

  // attempt non-overlap-ish placements
  for(let k=0;k<order.length;k++){
    const idx = order[k];
    const { img, row } = loaded[idx];
    const { w, h } = sizeForIndex(k);

    // try up to N placements
    let best = null;
    for(let tries=0; tries<140; tries++){
      const x = Math.round(safePad + rand() * (W - safePad*2 - w));
      const y = Math.round(topSafe + rand() * (H - topSafe - bottomSafe - h));

      const a = {
        x, y, w, h,
        // rotation: +- ~10deg, with slight variation
        ang: (rand() * 0.36) - 0.18
      };

      // soft collision avoidance
      let hits = 0;
      for(const b of placed){
        if(rectsOverlap(a, b, Math.round(w*0.06))) hits++;
      }

      // accept if low overlap, prefer fewer hits
      if(best == null || hits < best.hits){
        best = { ...a, hits };
        if(hits === 0) break;
      }
    }

    placed.push({
      ...best,
      img,
      row,
      caption: captionForRow(row)
    });
  }

  // Layering: draw in placement order, but jitter z a bit
  // (small random shuffle makes it look natural)
  placed.sort((p,q)=> (p.y + rand()*30) - (q.y + rand()*30));

  for(const p of placed){
    drawPolaroid(ctx, p.img, p.x, p.y, p.w, p.h, p.ang, p.caption);
  }

  // overlays
  drawTopLeftMeta(ctx, W, H, meta);
  drawBottomRightBadge(ctx, W, H);

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
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = "riverlog_collage.png";
      document.body.appendChild(a);
      a.click();
      a.remove();

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
