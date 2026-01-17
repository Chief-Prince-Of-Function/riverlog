// split.js - RiverLog app.js splitter (boundary-based, Windows-safe) - CommonJS
const fs = require("fs");
const path = require("path");

const SRC = "app.js";
const OUTDIR = "js";

const text = fs.readFileSync(SRC, "utf8");

function sliceBetween(startMarker, endMarker){
  const a = text.indexOf(startMarker);
  if(a === -1) return "";
  const start = a + startMarker.length;
  const b = endMarker ? text.indexOf(endMarker, start) : -1;
  const end = (b === -1) ? text.length : b;
  return text.slice(start, end).trim();
}

function findImportBlock(){
  // take everything from start until the first big section marker
  const firstMarker = "/* =========================";
  const b = text.indexOf(firstMarker);
  if(b === -1) return "";
  return text.slice(0, b).trim();
}

const MARK = {
  PWA: `/* =========================
   PWA install + SW
========================= */`,
  DOM: `/* =========================
   DOM helpers
========================= */`,
  TRIPS: `/* =========================
   Trips
========================= */`,
  GPS: `/* =========================
   GPS + Photo
========================= */`,
  CATCHES: `/* =========================
   Catches
========================= */`,
  COLLAGE: `/* =========================
   Trip Collage Builder`,
  EXPORT: `/* =========================
   Export / Import
========================= */`,
  BOOT: `/* =========================
   Boot
========================= */`,
};

// Some people edit the collage header line, so we locate collage by a looser marker
function findCollageStart(){
  // prefer exact start of collage block if present
  const idx = text.indexOf(MARK.COLLAGE);
  if(idx !== -1) return idx;
  // fallback: search for the function marker
  const idx2 = text.indexOf("async function buildTripCollage");
  if(idx2 !== -1) return idx2;
  return -1;
}

function sliceFromIndexToMarker(startIdx, endMarker){
  if(startIdx === -1) return "";
  const end = endMarker ? text.indexOf(endMarker, startIdx) : -1;
  return text.slice(startIdx, end === -1 ? text.length : end).trim();
}

// Build sections using hard boundaries
const importBlock = findImportBlock();
const pwa = sliceBetween(MARK.PWA, MARK.DOM);
const dom = sliceBetween(MARK.DOM, MARK.TRIPS);
const trips = sliceBetween(MARK.TRIPS, MARK.GPS);
const gps = sliceBetween(MARK.GPS, MARK.CATCHES);
const catches = sliceBetween(MARK.CATCHES, (()=> {
  const collIdx = findCollageStart();
  if(collIdx === -1) return MARK.EXPORT;
  // we can’t use a marker string as end here because collage marker might be custom;
  // but catches section ends right before collage start index.
  return null;
})());

// If collage start exists, slice it to Export marker
const collageStartIdx = findCollageStart();
const collage = (collageStartIdx !== -1)
  ? sliceFromIndexToMarker(collageStartIdx, MARK.EXPORT)
  : "";

const exportImport = sliceBetween(MARK.EXPORT, MARK.BOOT);
const boot = sliceBetween(MARK.BOOT, null);

// If catches slice failed because we didn’t provide end marker, do it by index
let catchesFixed = catches;
if(!catchesFixed){
  const catchesStart = text.indexOf(MARK.CATCHES);
  if(catchesStart !== -1){
    const start = catchesStart + MARK.CATCHES.length;
    const end = (collageStartIdx !== -1) ? collageStartIdx : text.indexOf(MARK.EXPORT, start);
    catchesFixed = text.slice(start, end === -1 ? text.length : end).trim();
  }
}

// Create output dir
fs.mkdirSync(OUTDIR, { recursive: true });

// Write utils.js (keep small; you can expand later)
fs.writeFileSync(path.join(OUTDIR, "utils.js"), `
export function $(id){ return document.getElementById(id); }

export function fmtTime(ts){
  try{ return new Date(ts).toLocaleString(); }catch(_){ return String(ts); }
}

export function safeText(v){
  const s = String(v ?? "").trim();
  return s ? s : "-";
}

export function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
`.trim() + "\n");

// Dump the raw sections (these will NOT run yet — this is just the split)
fs.writeFileSync(path.join(OUTDIR, "pwa.js"), (pwa || "// PWA section not found") + "\n");
fs.writeFileSync(path.join(OUTDIR, "dom.js"), (dom || "// DOM section not found") + "\n");
fs.writeFileSync(path.join(OUTDIR, "trips.js"), (trips || "// Trips section not found") + "\n");
fs.writeFileSync(path.join(OUTDIR, "catches.js"), (gps ? gps + "\n\n" : "") + (catchesFixed || "// Catches section not found") + "\n");
fs.writeFileSync(path.join(OUTDIR, "collage.js"), (collage || "// Collage section not found") + "\n");
fs.writeFileSync(path.join(OUTDIR, "io.js"), (exportImport || "// Export/Import section not found") + "\n");

// main.js just glues things for now (wiring comes next)
fs.writeFileSync(path.join(OUTDIR, "main.js"), `
${importBlock}

import "./pwa.js";
import "./dom.js";
import "./trips.js";
import "./catches.js";
import "./collage.js";
import "./io.js";

${boot}
`.trim() + "\n");

console.log("Split complete. Wrote real section content to /js/*.js");
