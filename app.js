import {
  uid,
  ensureDefaultTrip,
  listTrips,
  getTrip,
  saveTrip,
  listCatches,
  saveCatch,
  deleteCatch,
  exportTripZip,
  importTripZip,
  exportTripPackage,
  importTripPackage,
  exportAllTripsZip,
  exportSelectedTripZip,
  getCatchById
} from "./storage.js";

/* =========================
   PWA install + SW
========================= */
let deferredPrompt = null;
const installBtn = document.getElementById("installBtn");

window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});

installBtn?.addEventListener("click", async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  });
}

/* =========================
   DOM helpers
========================= */
const $ = (id)=> document.getElementById(id);
const tripSelect = $("tripSelect");
const newTripBtn = $("newTripBtn");
const newTripForm = $("newTripForm");
const newTripLocation = $("newTripLocation");
const newTripDate = $("newTripDate");
const newTripDesc = $("newTripDesc");
const createTripBtn = $("createTripBtn");
const cancelTripBtn = $("cancelTripBtn");
const saveCatchBtn = $("saveCatchBtn");
const gpsBtn = $("gpsBtn");
const photoInput = $("photoInput");
const exportBtn = $("exportBtn");
const importInput = $("importInput");
const catchList = $("catchList");
const emptyState = $("emptyState");
const catchCount = $("catchCount");
const tripMeta = $("tripMeta");
const syncStatus = $("syncStatus");

// Trip recap drawer
const tripDrawer = $("tripDrawer");
const editTripBtn = $("editTripBtn");
const closeTripDrawer = $("closeTripDrawer");
const saveTripBtn = $("saveTripBtn");
const tripName = $("tripName");
const tripDate = $("tripDate");
const tripLocation = $("tripLocation");
const tripDesc = $("tripDesc");
const tripFlyWin = $("tripFlyWin");
const tripLessons = $("tripLessons");
const tripRecap = $("tripRecap");

// Collage buttons (drawer + optional top button)
const collageBtn = $("collageBtn");
const collageBtnTop = $("collageBtnTop"); // optional (won't break if missing)

// Catch inputs
const species = $("species");
const fly = $("fly");
const length = $("length");
const notes = $("notes");
const gpsHint = $("gpsHint");
const photoHint = $("photoHint");

let state = {
  tripId: null,
  pendingGPS: null,
  pendingPhotoBlob: null,
  pendingPhotoName: "",

  // Edit mode
  editingCatchId: null
};

function setStatus(msg){
  syncStatus.textContent = msg;
}

function fmtTime(ts){
  try{
    return new Date(ts).toLocaleString();
  }catch(_){
    return String(ts);
  }
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

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
   Trips
========================= */
async function refreshTrips(selectedId=null){
  const trips = await listTrips();
  tripSelect.innerHTML = "";
  for(const t of trips){
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name || "(Unnamed trip)";
    tripSelect.appendChild(opt);
  }
  if(selectedId) tripSelect.value = selectedId;
  if(!tripSelect.value && trips[0]) tripSelect.value = trips[0].id;
  state.tripId = tripSelect.value || null;

  // Exit catch edit mode when switching trips
  exitCatchEditMode();

  await refreshTripMeta();
  await refreshCatches();
}

async function refreshTripMeta(){
  const t = state.tripId ? await getTrip(state.tripId) : null;
  if(!t){
    tripMeta.textContent = "—";
    return;
  }
  const bits = [];
  if(t.location) bits.push(t.location);
  if(t.date){
    bits.push(new Date(t.date + "T00:00:00").toLocaleDateString());
  }else{
    bits.push(`Started ${fmtTime(t.createdAt)}`);
  }
  if(t.desc) bits.push(t.desc);
  if(t.flyWin) bits.push(`Fly: ${t.flyWin}`);
  tripMeta.textContent = bits.join(" • ");

  // Fill recap drawer fields
  tripName.value = t.name || "";
  tripDate.value = t.date || "";
  tripLocation.value = t.location || "";
  tripDesc.value = t.desc || "";
  tripFlyWin.value = t.flyWin || "";
  tripLessons.value = t.lessons || "";
  tripRecap.value = t.recap || "";
}

function toggleNewTrip(show){
  if(!newTripForm) return;

  const overlay = document.getElementById("tripSheetOverlay");

  newTripForm.hidden = !show;
  if(overlay) overlay.hidden = !show;

  if(overlay){
    overlay.onclick = ()=> toggleNewTrip(false);
  }
  newTripForm.onclick = (e)=> e.stopPropagation();
}

newTripBtn.addEventListener("click", async ()=>{
  toggleNewTrip(true);
});

cancelTripBtn?.addEventListener("click", ()=> toggleNewTrip(false));

createTripBtn?.addEventListener("click", async ()=>{
  const now = Date.now();
  const location = (newTripLocation.value || "").trim();
  const date = (newTripDate.value || "").trim();
  const desc = (newTripDesc.value || "").trim();

  const labelDate = date ? new Date(date + "T00:00:00").toLocaleDateString() : new Date(now).toLocaleDateString();
  const name = location ? `${location} • ${labelDate}` : labelDate;

  const t = {
    id: uid("trip"),
    name,
    date: date || "",
    location: location || "",
    desc: desc || "",
    createdAt: now,
    updatedAt: now,
    flyWin: "",
    lessons: "",
    recap: ""
  };

  await saveTrip(t);
  await refreshTrips(t.id);
  toggleNewTrip(false);
  setStatus("New trip saved.");
});

tripSelect.addEventListener("change", async ()=>{
  state.tripId = tripSelect.value;
  exitCatchEditMode();
  await refreshTripMeta();
  await refreshCatches();
});

editTripBtn.addEventListener("click", ()=>{
  tripDrawer.style.display = "block";
  tripDrawer.setAttribute("aria-hidden", "false");
  tripDrawer.scrollIntoView({ behavior: "smooth", block: "start" });
});

closeTripDrawer.addEventListener("click", ()=>{
  tripDrawer.style.display = "none";
  tripDrawer.setAttribute("aria-hidden", "true");
});

saveTripBtn.addEventListener("click", async ()=>{
  if(!state.tripId) return;
  const t = await getTrip(state.tripId);
  if(!t) return;
  t.name = (tripName.value || "").trim() || t.name;
  t.date = (tripDate.value || "").trim();
  t.location = (tripLocation.value || "").trim();
  t.desc = (tripDesc.value || "").trim();
  t.flyWin = (tripFlyWin.value || "").trim();
  t.lessons = (tripLessons.value || "").trim();
  t.recap = (tripRecap.value || "").trim();
  t.updatedAt = Date.now();
  await saveTrip(t);
  await refreshTrips(t.id);
  setStatus("Trip recap saved.");
});

/* =========================
   GPS + Photo
========================= */
gpsBtn.addEventListener("click", ()=>{
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
      gpsHint.textContent = `GPS: ${state.pendingGPS.lat}, ${state.pendingGPS.lon} (±${state.pendingGPS.acc}m)`;
      setStatus("GPS added to next catch.");
    },
    (err)=>{
      setStatus(`GPS failed: ${err.message || "permission denied"}`);
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
});

photoInput.addEventListener("change", async (e)=>{
  const file = e.target.files && e.target.files[0];
  if(!file){
    state.pendingPhotoBlob = null;
    state.pendingPhotoName = "";
    photoHint.textContent = "Photo: none";
    return;
  }

  setStatus("Processing photo…");
  const blob = await compressImageFileToBlob(file, 1600, 0.82);
  state.pendingPhotoBlob = blob;
  state.pendingPhotoName = file.name || "photo.jpg";
  photoHint.textContent = `Photo: ready (${Math.round((blob.size||0)/1024)} KB)`;
  setStatus("Photo ready for next catch.");
});

/* =========================
   Catches
========================= */
function safeText(v){
  const s = String(v ?? "").trim();
  return s ? s : "-";
}

function enterCatchEditMode(catchId){
  state.editingCatchId = catchId;
  saveCatchBtn.textContent = "Update Catch";
  saveCatchBtn.classList.add("isEditing");
}

function exitCatchEditMode(){
  state.editingCatchId = null;
  saveCatchBtn.textContent = "Save Catch";
  saveCatchBtn.classList.remove("isEditing");
}

async function refreshCatches(){
  if(!state.tripId) return;
  const rows = await listCatches(state.tripId);

  catchCount.textContent = String(rows.length);
  catchList.innerHTML = "";
  emptyState.style.display = rows.length ? "none" : "block";

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

    // EDIT button (next to Delete)
    const edit = document.createElement("button");
    edit.className = "btn ghost";
    edit.textContent = "Edit";
    edit.addEventListener("click", async ()=>{
      // Load freshest copy (safe)
      const full = await getCatchById(c.id);
      if(!full) return;

      // Fill form fields
      species.value = full.species || "";
      fly.value = full.fly || "";
      length.value = full.length || "";
      notes.value = full.notes || "";

      // NOTE: For MVP we do NOT try to auto-load the old photo/gps into "pending".
      // If you want, we can add "keep existing photo/gps unless user adds new" (we already do that on update).

      enterCatchEditMode(full.id);

      // Optional: bring user back to the top form
      window.scrollTo({ top: 0, behavior: "smooth" });
      setStatus("Editing catch. Update fields, then tap Update Catch.");
    });

    const del = document.createElement("button");
    del.className = "btn ghost";
    del.textContent = "Delete";
    del.addEventListener("click", async ()=>{
      if(!confirm("Delete this catch?")) return;
      await deleteCatch(c.id);

      // If you deleted the one you were editing, exit edit mode
      if(state.editingCatchId === c.id) exitCatchEditMode();

      setStatus("Catch deleted.");
      await refreshCatches();
    });

    right.appendChild(pill);
    right.appendChild(edit);
    right.appendChild(del);

    el.appendChild(thumb);
    el.appendChild(meta);
    el.appendChild(right);
    catchList.appendChild(el);
  }
}

saveCatchBtn.addEventListener("click", async ()=>{
  if(!state.tripId) return;

  // Common fields from form
  const patch = {
    tripId: state.tripId,
    species: (species.value || "").trim(),
    fly: (fly.value || "").trim(),
    length: (length.value || "").trim(),
    notes: (notes.value || "").trim(),
    updatedAt: Date.now()
  };

  // If editing: update existing catch
  if(state.editingCatchId){
    const existing = await getCatchById(state.editingCatchId);
    if(!existing){
      setStatus("Could not find that catch to update.");
      exitCatchEditMode();
      return;
    }

    // Keep existing photo/gps unless user added new pending ones
    const next = {
      ...existing,
      ...patch,
      gps: state.pendingGPS ? state.pendingGPS : existing.gps,
      photoBlob: state.pendingPhotoBlob ? state.pendingPhotoBlob : existing.photoBlob,
      photoName: state.pendingPhotoName ? state.pendingPhotoName : existing.photoName
    };

    await saveCatch(next);

    // Clear edit mode + pending
    exitCatchEditMode();
    state.pendingGPS = null;
    state.pendingPhotoBlob = null;
    state.pendingPhotoName = "";
    gpsHint.textContent = "GPS: not added";
    photoHint.textContent = "Photo: none";
    if(photoInput) photoInput.value = "";

    setStatus("Catch updated.");
    await refreshCatches();
    return;
  }

  // Otherwise: create new catch
  const now = Date.now();
  const c = {
    id: uid("catch"),
    ...patch,
    createdAt: now,
    gps: state.pendingGPS || null,
    photoBlob: state.pendingPhotoBlob || null,
    photoName: state.pendingPhotoName || ""
  };

  await saveCatch(c);

  // Clear inputs + pending
  species.value = "";
  fly.value = "";
  length.value = "";
  notes.value = "";

  state.pendingGPS = null;
  state.pendingPhotoBlob = null;
  state.pendingPhotoName = "";
  gpsHint.textContent = "GPS: not added";
  photoHint.textContent = "Photo: none";
  if(photoInput) photoInput.value = "";

  setStatus("Catch saved.");
  await refreshCatches();
});

/* =========================
   Trip Collage Builder (ALWAYS PNG)
   1–9: hero grid (rows of 3, centered)
   10–19: all photos collage
   20+: top 20 largest by length
========================= */
function openCollageModal(){
  $("collageOverlay")?.classList.remove("hidden");
  $("collageModal")?.classList.remove("hidden");
}
function closeCollageModal(){
  $("collageOverlay")?.classList.add("hidden");
  $("collageModal")?.classList.add("hidden");
}

$("collageOverlay")?.addEventListener("click", closeCollageModal);
$("collageClose")?.addEventListener("click", closeCollageModal);

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
    sy = (img.width - sh * tr) / (2*tr); // defensive; not used often
    if(!Number.isFinite(sy)) sy = (img.height - sh) / 2;
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

function pickGridCols(n){
  if(n <= 9) return 3;
  if(n <= 12) return 4;
  return 5; // up to 20
}

function layoutHeroRows(n){
  // bottom-up rows of 3; partial rows centered
  const rows = [];
  let remaining = n;
  while(remaining > 0){
    const take = Math.min(3, remaining);
    rows.unshift(take);
    remaining -= take;
  }
  return rows;
}

async function buildTripCollage(tripId, tripLabel){
  const canvas = $("collageCanvas");
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
    if($("collageMeta")) $("collageMeta").textContent = "No catch photos found for this trip.";
    if($("collagePreview")) $("collagePreview").src = "";
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
    // COLLAGE GRID (10–20): choose cols 4/5, fill rows top-down
    const cols = pickGridCols(n);
    const rows = Math.ceil(n / cols);

    const tileW = Math.floor((area.w - gap*(cols-1)) / cols);
    const tileH = Math.floor((area.h - gap*(rows-1)) / rows);

    const gridH = tileH*rows + gap*(rows-1);
    const startY = area.y + Math.floor((area.h - gridH)/2);

    let idx = 0;
    for(let r=0; r<rows; r++){
      const remaining = n - idx;
      const k = Math.min(cols, remaining);
      const rowW = tileW*k + gap*(k-1);
      const startX = area.x + Math.floor((area.w - rowW)/2);

      for(let c=0; c<k; c++){
        const x = startX + c*(tileW + gap);
        const y = startY + r*(tileH + gap);
        drawTile(ctx, imgs[idx], x, y, tileW, tileH, makeCaption(use[idx]));
        idx++;
      }
    }
  }

  const dataUrl = canvas.toDataURL("image/png");

  if($("collageMeta")){
    let meta = "";
    if(nTotal >= 20){
      meta = `Top 20 by length • ${tripLabel || ""}`.trim();
    }else if(nTotal >= 10){
      meta = `${nTotal} photos • Collage unlocked • ${tripLabel || ""}`.trim();
    }else{
      meta = `${nTotal} photos • ${tripLabel || ""}`.trim();
    }
    $("collageMeta").textContent = meta;
  }

  if($("collagePreview")) $("collagePreview").src = dataUrl;

  const dlBtn = $("collageDownload");
  if(dlBtn){
    dlBtn.onclick = ()=>{
      const a = document.createElement("a");
      a.href = dataUrl;
      const safe = (tripLabel || "trip").replace(/[^\w\-]+/g, "_");
      a.download = `RiverLog_${safe}_collage.png`;
      a.click();
    };
  }

  openCollageModal();
}

async function onBuildCollage(){
  if(!state.tripId) return;
  const label = tripSelect?.selectedOptions?.[0]?.textContent?.trim() || "Trip";
  setStatus("Building collage…");
  try{
    await buildTripCollage(state.tripId, label);
    setStatus("Collage ready.");
  }catch(e){
    setStatus(`Collage failed: ${e.message || e}`);
  }
}

// Wire collage buttons (drawer + optional top button)
collageBtn?.addEventListener("click", onBuildCollage);
collageBtnTop?.addEventListener("click", onBuildCollage);

/* =========================
   Export / Import
========================= */
function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "riverlog.zip";
  a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 800);
}

exportBtn?.addEventListener("click", async ()=>{
  const choice = window.prompt(
    "Export options:\n1 = Selected trip\n2 = All trips\n\nEnter 1 or 2:"
  );

  try{
    if(choice === "2"){
      const { blob, filename } = await exportAllTripsZip();
      downloadBlob(blob, filename);
      setStatus("Exported all trips.");
    }else if(choice === "1"){
      if(!state.tripId){
        setStatus("No trip selected.");
        return;
      }
      const { blob, filename } = await exportSelectedTripZip(state.tripId);
      downloadBlob(blob, filename);
      setStatus("Exported selected trip.");
    }
  }catch(e){
    setStatus(`Export failed: ${e.message || e}`);
  }
});

importInput.addEventListener("change", async (e)=>{
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  setStatus("Importing…");
  try{
    const name = (file.name || "").toLowerCase();

    if(name.endsWith(".zip")){
      // ✅ try trip zip first, then fall back to all-zip
      let res = null;
      try{
        res = await importTripZip(file);
        await refreshTrips(res.tripId || null);
      }catch(err){
        const msg = String(err?.message || err || "");
        // If it failed because it's not a trip zip (or missing riverlog.json), try all-zip
        if(
          msg.includes("Zip missing riverlog.json") ||
          msg.includes("Not a RiverLog trip zip export")
        ){
          await importAllTripsZip(file);
          await refreshTrips(null);
        }else{
          throw err; // real error, bubble up
        }
      }

    }else{
      const text = await file.text();
      const pkg = JSON.parse(text);
      await importTripPackage(pkg);
      await refreshTrips(pkg.trip?.id || null);
    }

    setStatus("Import complete.");
  }catch(err){
    setStatus(`Import failed: ${err.message || err}`);
  }finally{
    importInput.value = "";
  }
});


/* =========================
   Boot
========================= */
(async function boot(){
  try{
    const t = await ensureDefaultTrip();
    await refreshTrips(t.id);
    tripDrawer.style.display = "none";

    // 5C: Remember badges collapse state
    const d = document.getElementById("badgesCollapse");
    if(d){
      const saved = localStorage.getItem("riverlog_badges_open");
      if(saved !== null) d.open = saved === "1";
      d.addEventListener("toggle", ()=>{
        localStorage.setItem("riverlog_badges_open", d.open ? "1" : "0");
      });
    }

    setStatus("Ready (offline-first)." + (navigator.onLine ? " Online." : " Offline."));
  }catch(e){
    setStatus(`Boot error: ${e.message || e}`);
  }
})();

window.addEventListener("online", ()=> setStatus("Online."));
window.addEventListener("offline", ()=> setStatus("Offline."));
