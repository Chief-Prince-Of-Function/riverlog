import { listCatches, getTrip } from "../storage.js";
import { safeText } from "./utils.js";
import { state } from "./state.js";
import {
  collageBtn,
  collageBtnTop9,
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

let _logoImgPromise = null;
const COLLAGE_LOGO_DATA_URL =
  "data:image/png;base64,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";

function loadRiverLogLogo(){
  if(_logoImgPromise) return _logoImgPromise;

  _logoImgPromise = new Promise((resolve)=>{
    const im = new Image();
    im.onload = ()=> resolve(im);
    im.onerror = ()=> resolve(null);

    // ✅ correct for GitHub Pages + local (resolved from index.html)
    im.src = COLLAGE_LOGO_DATA_URL;
  });

  return _logoImgPromise;
}

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

function wrapTextLines(ctx, text, maxWidth){
  const raw = String(text || "").trim();
  if(!raw) return [];
  const words = raw.split(/\s+/);
  const lines = [];
  let line = "";
  for(const word of words){
    const next = line ? `${line} ${word}` : word;
    if(ctx.measureText(next).width <= maxWidth || !line){
      line = next;
    }else{
      lines.push(line);
      line = word;
    }
  }
  if(line) lines.push(line);
  return lines;
}

function drawTopRightRecap(ctx, W, H, meta){
  const pad = Math.round(W * 0.05);
  const titleSize = clamp(Math.round(H * 0.020), 16, 26);
  const subSize = clamp(Math.round(H * 0.018), 12, 20);
  const maxWidth = Math.round(W * 0.40);
  const x = W - pad;
  const sections = [
    { label: "Trip note", value: meta.desc },
    { label: "Fly that won the day", value: meta.flyWin },
    { label: "Lessons learned", value: meta.lessons },
    { label: "Recap", value: meta.recap }
  ];

  const hasContent = sections.some(section => String(section.value || "").trim());
  if(!hasContent) return;

  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";

  let y = pad;
  for(const section of sections){
    const value = String(section.value || "").trim();
    if(!value) continue;

    ctx.globalAlpha = 0.80;
    ctx.font = `600 ${titleSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.fillText(section.label, x, y);
    y += Math.round(titleSize * 1.15);

    ctx.globalAlpha = 0.70;
    ctx.font = `400 ${subSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    const lines = wrapTextLines(ctx, value, maxWidth);
    for(const line of lines){
      ctx.fillText(line, x, y);
      y += Math.round(subSize * 1.35);
    }
    y += Math.round(subSize * 0.5);
  }

  ctx.restore();
}

// Classic pill badge with real RiverLog logo
function drawBottomRightBadge(ctx, W, H, logoImg){
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

  // logo area
  const cx = x + Math.round(pillH * 0.62);
  const cy = y + Math.round(pillH * 0.52);
  const cr = Math.round(pillH * 0.30);

  if(logoImg){
    const s = cr * 2;
    const scale = 1.22;
    const drawSize = s * scale;

    ctx.save();
    // subtle backdrop disk
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx, cy, cr * 1.02, 0, Math.PI*2);
    ctx.fill();

    // logo
    ctx.globalAlpha = 0.98;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI*2);
    ctx.clip();
    ctx.drawImage(logoImg, cx - drawSize/2, cy - drawSize/2, drawSize, drawSize);
    ctx.restore();
  }else{
    // fallback disk
    ctx.save();
    ctx.globalAlpha = 0.90;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

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

function drawPolaroid(ctx, img, x, y, w, h, angleRad, caption){
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

function drawSeasonalContainer(ctx, x, y, w, h, angleRad, fillColor){
  const r = Math.round(Math.min(w, h) * 0.18);
  ctx.save();
  ctx.translate(x + w/2, y + h/2);
  ctx.rotate(angleRad);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.30)";
  ctx.shadowBlur = Math.round(h * 0.22);
  ctx.shadowOffsetY = Math.round(h * 0.08);

  ctx.fillStyle = fillColor;
  roundRect(ctx, -w/2, -h/2, w, h, r);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#0b1020";
  ctx.lineWidth = 2;
  roundRect(ctx, -w/2, -h/2, w, h, r);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawSmallSetLayout(ctx, W, H, items){
  const n = items.length;
  if(n < 1 || n > 9) return false;

  const leftPad = Math.round(W * 0.06);
  const topSafe = Math.round(H * 0.18);
  const bottomSafe = Math.round(H * 0.15);

  const areaW = W - leftPad*2;
  const areaH = H - topSafe - bottomSafe;

  const rowPlan = (count)=>{
    switch(count){
      case 1: return [1];
      case 2: return [2];
      case 3: return [3];
      case 4: return [1,3];
      case 5: return [2,3];
      case 6: return [3,3];
      case 7: return [1,3,3];
      case 8: return [2,3,3];
      case 9: return [3,3,3];
      default: return [];
    }
  };

  const rows = rowPlan(n);
  const rowsCount = rows.length;
  const maxCols = Math.max(...rows);

  const aspect = 1.08;
  const gapRatio = 0.08;

  const wByWidth = areaW / (maxCols + gapRatio * (maxCols - 1));
  const wByHeight = areaH / (aspect * rowsCount + gapRatio * (rowsCount - 1));
  const w = Math.round(Math.min(wByWidth, wByHeight));
  const h = Math.round(w * aspect);
  const gap = Math.round(w * gapRatio);

  const layoutH = rowsCount * h + (rowsCount - 1) * gap;
  let y = topSafe + Math.round((areaH - layoutH) / 2);

  let idx = 0;
  for(const cols of rows){
    const rowW = cols * w + (cols - 1) * gap;
    let x = Math.round((W - rowW) / 2);
    for(let c=0; c<cols; c++){
      if(idx >= n) break;
      const angBase = cols === 1 ? 0.02 : (cols === 2 ? [-0.03, 0.03] : [-0.04, 0, 0.04]);
      const ang = Array.isArray(angBase) ? angBase[c] : angBase;
      drawPolaroid(ctx, items[idx].img, x, y, w, h, ang, items[idx].caption);
      x += w + gap;
      idx += 1;
    }
    y += h + gap;
  }

  return true;
}

function drawScatterLayout(ctx, W, H, items, seedKey){
  const count = items.length;
  if(count < 10) return false;

  const seedFn = xmur3(String(seedKey || "riverlog"));
  const rand = mulberry32(seedFn());

  const safePad = Math.round(W * 0.06);
  const topSafe = Math.round(H * 0.18);
  const bottomSafe = Math.round(H * 0.15);

  const areaW = W - safePad*2;
  const areaH = H - topSafe - bottomSafe;

  const centerX = safePad + areaW / 2;
  const centerY = topSafe + areaH / 2;

  const aspect = 1.08;
  const baseSize = Math.min(areaW, areaH);
  const sizeScale = clamp(1.08 - (count - 10) * 0.035, 0.72, 1.02);
  const baseW = Math.round(baseSize * 0.26 * sizeScale);
  const baseH = Math.round(baseW * aspect);

  const maxR = Math.min(areaW - baseW, areaH - baseH) * 0.42;
  const minR = Math.min(baseW, baseH) * 0.12;
  const golden = 2.399963229728653;

  const placed = [];

  for(let i=0; i<count; i++){
    const t = count === 1 ? 0 : i / (count - 1);
    const radius = minR + Math.sqrt(t) * maxR + (rand() - 0.5) * baseW * 0.08;
    const angle = i * golden + (rand() - 0.5) * 0.4;
    const scale = clamp(1.05 - t * 0.22, 0.76, 1.06);
    const w = Math.round(baseW * scale);
    const h = Math.round(baseH * scale);
    let x = Math.round(centerX + Math.cos(angle) * radius - w/2);
    let y = Math.round(centerY + Math.sin(angle) * radius - h/2);
    x = clamp(x, safePad, W - safePad - w);
    y = clamp(y, topSafe, H - bottomSafe - h);
    const ang = (rand() * 0.24) - 0.12;
    placed.push({
      x, y, w, h, ang,
      radius,
      img: items[i].img,
      caption: items[i].caption
    });
  }

  placed.sort((a, b)=> b.radius - a.radius);
  for(const p of placed){
    drawPolaroid(ctx, p.img, p.x, p.y, p.w, p.h, p.ang, p.caption);
  }

  return true;
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

export async function buildTripCollage(tripIdArg, tripLabel="Trip", options = {}){
  const tripId = tripIdArg || getSelectedTripId();
  if(!tripId) throw new Error("No trip selected");

  const {
    maxPhotos = 20,
    mode = "top_by_length",
    labelSuffix = "Top catches by length",
    includeRecapInfo = false
  } = options;

  const rows = await listCatches(tripId);
  const photoRows = rows.filter(r => r.photoBlob instanceof Blob);

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
      mode,
      maxPhotos,
      photoCountUsed: photos.length,
      photoTotal: photoRows.length,
      includeRecapInfo
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

  const items = loaded.map(({img,row})=> ({
    img,
    row,
    caption: captionForRow(row)
  }));

  // Structured layouts for 1–9 photos
  const didSmall = drawSmallSetLayout(ctx, W, H, items);

  // 10+ photos: organized scatter
  if(!didSmall){
    drawScatterLayout(ctx, W, H, items, tripId || meta.name || "riverlog");
  }

  const logoImg = await loadRiverLogLogo();

  // overlays
  drawTopLeftMeta(ctx, W, H, meta);
  if(includeRecapInfo){
    drawTopRightRecap(ctx, W, H, meta);
  }
  drawBottomRightBadge(ctx, W, H, logoImg);

  // Export to PNG
  const pngUrl = canvas.toDataURL("image/png");
  if(collagePreview) collagePreview.src = pngUrl;

  if(collageMeta){
    const label = String(meta.name || "Trip").trim() || "Trip";
    collageMeta.textContent = `${safeText(label)} • ${labelSuffix}`;
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

      const choice = window.prompt(
        "Collage options:\n1 = Standard collage\n2 = Include trip recap info\n\nEnter 1 or 2:"
      );
      if(choice === null) return;
      const trimmed = String(choice || "").trim();
      if(trimmed !== "1" && trimmed !== "2"){
        setStatus?.("Please enter 1 or 2 to build a collage.");
        return;
      }

      const label = getSelectedTripLabel();
      setStatus?.("Building collage…");
      await buildTripCollage(tripId, label, {
        includeRecapInfo: trimmed === "2"
      });
      setStatus?.("Collage ready.");
    }catch(e){
      setStatus?.(e?.message || String(e));
    }
  }

  collageBtn?.addEventListener("click", onBuild);
  collageBtnTop9?.addEventListener("click", async ()=>{
    try{
      const tripId = getSelectedTripId();
      if(!tripId){
        setStatus?.("Pick a trip first.");
        return;
      }

      const label = getSelectedTripLabel();
      setStatus?.("Building top 9 collage…");
      await buildTripCollage(tripId, label, {
        maxPhotos: 9,
        mode: "top9_by_length",
        labelSuffix: "Top 9 catches by length"
      });
      setStatus?.("Top 9 collage ready.");
    }catch(e){
      setStatus?.(e?.message || String(e));
    }
  });

  collageClose?.addEventListener("click", closeCollageModal);
  collageOverlay?.addEventListener("click", closeCollageModal);
}
