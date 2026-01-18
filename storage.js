// storage.js — IndexedDB wrapper (Trips + Catches + FlyBox)

const DB_NAME = "riverlog";
const DB_VERSION = 2;

function openDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = ()=>{
      const db = req.result;

      // trips
      if(!db.objectStoreNames.contains("trips")){
        const trips = db.createObjectStore("trips", { keyPath: "id" });
        trips.createIndex("createdAt", "createdAt");
      }

      // catches
      if(!db.objectStoreNames.contains("catches")){
        const c = db.createObjectStore("catches", { keyPath: "id" });
        c.createIndex("tripId", "tripId");
        c.createIndex("createdAt", "createdAt");
      }

      /* =========================
         FlyBox (NEW)
      ========================= */

      // flyboxes (your “quiver”)
      if(!db.objectStoreNames.contains("flyboxes")){
        const b = db.createObjectStore("flyboxes", { keyPath: "id" });
        b.createIndex("createdAt", "createdAt");
        b.createIndex("updatedAt", "updatedAt");
      }

      // flies (inventory items)
      if(!db.objectStoreNames.contains("flies")){
        const f = db.createObjectStore("flies", { keyPath: "id" });
        f.createIndex("boxId", "boxId");
        f.createIndex("createdAt", "createdAt");
        f.createIndex("updatedAt", "updatedAt");
        // optional quick filters
        f.createIndex("type", "type");   // nymph/dry/wet/streamer/other
        f.createIndex("size", "size");   // "18", "14", etc
      }

      // flyevents (audit trail: lost/tied/added/etc)
      if(!db.objectStoreNames.contains("flyevents")){
        const e = db.createObjectStore("flyevents", { keyPath: "id" });
        e.createIndex("boxId", "boxId");
        e.createIndex("flyId", "flyId");
        e.createIndex("createdAt", "createdAt");
        e.createIndex("kind", "kind");   // "add" | "use" | "lost" | "tie" | "adjust"
      }
    };

    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}

function tx(db, store, mode="readonly"){
  return db.transaction(store, mode).objectStore(store);
}

export function uid(prefix="id"){
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function clampQty(n){
  n = Number(n);
  if(!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

/* =========================
   Trips
========================= */

export async function ensureDefaultTrip(){
  const trips = await listTrips();
  if(trips.length) return trips[0];

  const now = Date.now();
  const trip = {
    id: uid("trip"),
    name: new Date(now).toLocaleDateString(),
    date: "",
    location: "",
    desc: "",
    createdAt: now,
    updatedAt: now,
    flyWin: "",
    lessons: "",
    recap: ""
  };
  await saveTrip(trip);
  return trip;
}

export async function listTrips(){
  const db = await openDB();
  const store = tx(db, "trips");
  return new Promise((resolve, reject)=>{
    const req = store.getAll();
    req.onsuccess = ()=>{
      const rows = req.result || [];
      rows.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
      resolve(rows);
    };
    req.onerror = ()=> reject(req.error);
  });
}

export async function getTrip(id){
  const db = await openDB();
  const store = tx(db, "trips");
  return new Promise((resolve, reject)=>{
    const req = store.get(id);
    req.onsuccess = ()=> resolve(req.result || null);
    req.onerror = ()=> reject(req.error);
  });
}

export async function saveTrip(trip){
  const db = await openDB();
  const store = tx(db, "trips", "readwrite");
  return new Promise((resolve, reject)=>{
    const req = store.put(trip);
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });
}

export async function deleteTrip(tripId){
  const db = await openDB();

  // delete trip
  await new Promise((resolve, reject)=>{
    const req = tx(db, "trips", "readwrite").delete(tripId);
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });

  // delete catches in trip
  const catches = await listCatches(tripId);
  await Promise.all(catches.map(c=> deleteCatch(c.id)));
}

/* =========================
   Catches
========================= */

export async function listCatches(tripId){
  const db = await openDB();
  const store = tx(db, "catches");
  const idx = store.index("tripId");
  return new Promise((resolve, reject)=>{
    const req = idx.getAll(tripId);
    req.onsuccess = ()=>{
      const rows = req.result || [];
      rows.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
      resolve(rows);
    };
    req.onerror = ()=> reject(req.error);
  });
}

export async function listAllCatches(){
  const db = await openDB();
  const store = tx(db, "catches");
  return new Promise((resolve, reject)=>{
    const req = store.getAll();
    req.onsuccess = ()=>{
      const rows = req.result || [];
      rows.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
      resolve(rows);
    };
    req.onerror = ()=> reject(req.error);
  });
}

export async function getCatchById(id){
  const db = await openDB();
  const store = tx(db, "catches");
  return new Promise((resolve, reject)=>{
    const req = store.get(id);
    req.onsuccess = ()=> resolve(req.result || null);
    req.onerror = ()=> reject(req.error);
  });
}

export async function saveCatch(catchRow){
  const db = await openDB();
  const store = tx(db, "catches", "readwrite");
  return new Promise((resolve, reject)=>{
    const req = store.put(catchRow);
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });
}

export async function deleteCatch(catchId){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const req = tx(db, "catches", "readwrite").delete(catchId);
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });
}

/* =========================
   FlyBox
========================= */

export async function ensureDefaultFlyBox(){
  const boxes = await listFlyBoxes();
  if(boxes.length) return boxes[0];

  const now = Date.now();
  const box = {
    id: uid("box"),
    name: "My Fly Box",
    notes: "",
    createdAt: now,
    updatedAt: now
  };
  await saveFlyBox(box);
  return box;
}

export async function listFlyBoxes(){
  const db = await openDB();
  const store = tx(db, "flyboxes");
  return new Promise((resolve, reject)=>{
    const req = store.getAll();
    req.onsuccess = ()=>{
      const rows = req.result || [];
      rows.sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0));
      resolve(rows);
    };
    req.onerror = ()=> reject(req.error);
  });
}

export async function getFlyBox(id){
  const db = await openDB();
  const store = tx(db, "flyboxes");
  return new Promise((resolve, reject)=>{
    const req = store.get(id);
    req.onsuccess = ()=> resolve(req.result || null);
    req.onerror = ()=> reject(req.error);
  });
}

export async function saveFlyBox(box){
  const db = await openDB();
  const store = tx(db, "flyboxes", "readwrite");
  return new Promise((resolve, reject)=>{
    const req = store.put(box);
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });
}

export async function deleteFlyBox(boxId){
  const db = await openDB();

  // 1) delete flies + events in this box (best-effort, but we do it properly)
  const flies = await listFliesByBox(boxId);

  // delete flyevents by box
  try{
    const evs = await listFlyEventsByBox(boxId);
    await Promise.all(evs.map(e => deleteFlyEvent(e.id)));
  }catch(_){}

  // delete flies (each fly delete also attempts to clear its events by flyId)
  await Promise.allSettled(flies.map(f => deleteFly(f.id)));

  // 2) delete the box itself
  await new Promise((resolve, reject)=>{
    const req = tx(db, "flyboxes", "readwrite").delete(boxId);
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });

  return true;
}

export async function clearAllFlyBoxes(){
  const db = await openDB();

  // Gather boxes first, then delete them (keeps behavior consistent + simple)
  const boxes = await listFlyBoxes();
  await Promise.allSettled(boxes.map(b => deleteFlyBox(b.id)));

  // Safety: if anything survived for some reason, clear stores directly
  await new Promise((resolve, reject)=>{
    const req = tx(db, "flyboxes", "readwrite").clear();
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });

  await new Promise((resolve, reject)=>{
    const req = tx(db, "flies", "readwrite").clear();
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });

  await new Promise((resolve, reject)=>{
    const req = tx(db, "flyevents", "readwrite").clear();
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });

  return true;
}

export async function listFliesByBox(boxId){
  const db = await openDB();
  const store = tx(db, "flies");
  const idx = store.index("boxId");
  return new Promise((resolve, reject)=>{
    const req = idx.getAll(boxId);
    req.onsuccess = ()=>{
      const rows = req.result || [];
      rows.sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0));
      resolve(rows);
    };
    req.onerror = ()=> reject(req.error);
  });
}

/** Alias for sanity (older UI code will call listFlies) */
export async function listFlies(boxId){
  return listFliesByBox(boxId);
}

export async function getFly(id){
  const db = await openDB();
  const store = tx(db, "flies");
  return new Promise((resolve, reject)=>{
    const req = store.get(id);
    req.onsuccess = ()=> resolve(req.result || null);
    req.onerror = ()=> reject(req.error);
  });
}

/** Alias for sanity (older UI code will call getFlyById) */
export async function getFlyById(id){
  return getFly(id);
}

export async function saveFly(flyRow){
  const db = await openDB();
  const store = tx(db, "flies", "readwrite");
  return new Promise((resolve, reject)=>{
    const req = store.put(flyRow);
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });
}

export async function deleteFly(flyId){
  const db = await openDB();

  // delete events for this fly (best-effort)
  try{
    const evs = await listFlyEventsByFly(flyId);
    await Promise.all(evs.map(e=> deleteFlyEvent(e.id)));
  }catch(_){}

  return new Promise((resolve, reject)=>{
    const req = tx(db, "flies", "readwrite").delete(flyId);
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });
}

/**
 * Adjust qty (positive or negative) AND record an event.
 * kind: "add" | "use" | "lost" | "tie" | "adjust"
 */
export async function adjustFlyQty({ flyId, delta, kind="adjust", note="" }){
  const now = Date.now();
  const flyRow = await getFly(flyId);
  if(!flyRow) throw new Error("Fly not found");

  const before = clampQty(flyRow.qty);
  const after = clampQty(before + Number(delta || 0));

  flyRow.qty = after;
  flyRow.updatedAt = now;
  await saveFly(flyRow);

  // touch box updatedAt for sorting
  try{
    const box = await getFlyBox(flyRow.boxId);
    if(box){
      box.updatedAt = now;
      await saveFlyBox(box);
    }
  }catch(_){}

  // record event
  const ev = {
    id: uid("fev"),
    boxId: flyRow.boxId,
    flyId: flyRow.id,
    kind,
    delta: Number(delta || 0),
    qtyBefore: before,
    qtyAfter: after,
    note: String(note || "").trim(),
    createdAt: now
  };
  await saveFlyEvent(ev);

  return { before, after };
}

/** Convenience: expend one fly (−1) */
export async function expendFly(flyId, kind="use"){
  return adjustFlyQty({ flyId, delta: -1, kind });
}

/* --- Fly events --- */

export async function saveFlyEvent(ev){
  const db = await openDB();
  const store = tx(db, "flyevents", "readwrite");
  return new Promise((resolve, reject)=>{
    const req = store.put(ev);
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });
}

export async function deleteFlyEvent(evId){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const req = tx(db, "flyevents", "readwrite").delete(evId);
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });
}

export async function listFlyEventsByBox(boxId){
  const db = await openDB();
  const store = tx(db, "flyevents");
  const idx = store.index("boxId");
  return new Promise((resolve, reject)=>{
    const req = idx.getAll(boxId);
    req.onsuccess = ()=>{
      const rows = req.result || [];
      rows.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
      resolve(rows);
    };
    req.onerror = ()=> reject(req.error);
  });
}

export async function listFlyEventsByFly(flyId){
  const db = await openDB();
  const store = tx(db, "flyevents");
  const idx = store.index("flyId");
  return new Promise((resolve, reject)=>{
    const req = idx.getAll(flyId);
    req.onsuccess = ()=>{
      const rows = req.result || [];
      rows.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
      resolve(rows);
    };
    req.onerror = ()=> reject(req.error);
  });
}

/* =========================
   JSON Export (package)
========================= */

export async function exportTripPackage(tripId){
  const trip = await getTrip(tripId);
  const catches = await listCatches(tripId);

  const catchesOut = [];
  for(const c of catches){
    const out = { ...c };
    if(out.photoBlob instanceof Blob){
      out.photo = {
        mime: out.photoBlob.type || "image/jpeg",
        b64: await blobToBase64(out.photoBlob)
      };
    }
    delete out.photoBlob;
    catchesOut.push(out);
  }

  return {
    _schema: "riverlog_trip_package",
    _version: 1,
    exportedAt: Date.now(),
    trip,
    catches: catchesOut
  };
}

/* =========================
   ZIP Export / Import
   - Trip zip: riverlog.json + photos/
   - All zip : riverlog_all.json + photos/
========================= */

async function loadJSZip(){
  if(window.JSZip) return window.JSZip;
  const mod = await import("./vendor/jszip.min.js");
  return (mod && (mod.default || mod.JSZip)) || window.JSZip;
}

function guessExt(mime){
  const m = String(mime||"").toLowerCase();
  if(m.includes("png")) return "png";
  if(m.includes("webp")) return "webp";
  return "jpg";
}

export function safeTripFilename(trip){
  const t = trip || {};
  const dateStr = (t.date || "").trim() || "";
  const datePart = dateStr ? dateStr : new Date(t.createdAt||Date.now()).toISOString().slice(0,10);
  const where = (t.location || "").trim() || (t.name || "trip").trim();
  const slug = where
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/\-+/g, "-")
    .slice(0, 48) || "trip";
  return `${datePart}_${slug}_riverlog.zip`;
}

function safeAllFilename(){
  const datePart = new Date().toISOString().slice(0,10);
  return `${datePart}_riverlog_all.zip`;
}

export function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "riverlog.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 1500);
}

export async function exportTripZip(tripId){
  const trip = await getTrip(tripId);
  const catches = await listCatches(tripId);
  if(!trip) throw new Error("Trip not found");

  await loadJSZip();
  const JSZipCtor = (window.JSZip && (window.JSZip.default || window.JSZip)) || null;
  if(typeof JSZipCtor !== "function"){
    throw new Error("JSZip not loaded (expected vendor/jszip.min.js)");
  }
  const zip = new JSZipCtor();

  const photosFolder = zip.folder("photos");
  const catchesOut = [];

  for(const c of catches){
    const out = { ...c };
    if(out.photoBlob instanceof Blob){
      const ext = guessExt(out.photoBlob.type);
      const fname = `${out.id}.${ext}`;
      photosFolder.file(fname, out.photoBlob);
      out.photoFile = `photos/${fname}`;
    }
    delete out.photoBlob;
    catchesOut.push(out);
  }

  const manifest = {
    _schema: "riverlog_trip_zip",
    _version: 1,
    exportedAt: Date.now(),
    trip,
    catches: catchesOut
  };

  zip.file("riverlog.json", JSON.stringify(manifest, null, 2));
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, filename: safeTripFilename(trip) };
}

export async function exportSelectedTripZip(tripId){
  return exportTripZip(tripId);
}

export async function exportAllTripsZip(){
  const trips = await listTrips();
  const catches = await listAllCatches();

  await loadJSZip();
  const JSZipCtor = (window.JSZip && (window.JSZip.default || window.JSZip)) || null;
  if(typeof JSZipCtor !== "function"){
    throw new Error("JSZip not loaded (expected vendor/jszip.min.js)");
  }
  const zip = new JSZipCtor();
  const photosFolder = zip.folder("photos");

  const catchesOut = [];
  for(const c of catches){
    const out = { ...c };
    if(out.photoBlob instanceof Blob){
      const ext = guessExt(out.photoBlob.type);
      const fname = `${out.id}.${ext}`;
      photosFolder.file(fname, out.photoBlob);
      out.photoFile = `photos/${fname}`;
    }
    delete out.photoBlob;
    catchesOut.push(out);
  }

  const manifest = {
    _schema: "riverlog_all_zip",
    _version: 1,
    exportedAt: Date.now(),
    trips,
    catches: catchesOut
  };

  zip.file("riverlog_all.json", JSON.stringify(manifest, null, 2));
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, filename: safeAllFilename() };
}

export async function importTripZip(file){
  const JSZip = await loadJSZip();
  const ab = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(ab);

  const jsonFile = zip.file("riverlog.json");
  if(!jsonFile) throw new Error("Zip missing riverlog.json");

  const text = await jsonFile.async("string");
  const manifest = JSON.parse(text);

  if(manifest._schema !== "riverlog_trip_zip"){
    throw new Error("Not a RiverLog trip zip export");
  }

  const trip = manifest.trip;
  const catches = manifest.catches || [];

  trip.updatedAt = Date.now();
  await saveTrip(trip);

  for(const c of catches){
    const row = { ...c };
    if(row.photoFile){
      const zf = zip.file(row.photoFile);
      if(zf){
        const blob = await zf.async("blob");
        row.photoBlob = blob;
      }
    }
    delete row.photoFile;
    await saveCatch(row);
  }

  return { tripId: trip.id };
}

export async function importTripPackage(pkg){
  if(!pkg || pkg._schema !== "riverlog_trip_package"){
    throw new Error("Not a RiverLog export file");
  }

  const trip = pkg.trip;
  const catches = pkg.catches || [];

  trip.updatedAt = Date.now();
  await saveTrip(trip);

  for(const c of catches){
    const row = { ...c };
    if(row.photo && row.photo.b64){
      row.photoBlob = base64ToBlob(row.photo.b64, row.photo.mime || "image/jpeg");
    }
    delete row.photo;
    await saveCatch(row);
  }
}

/* =========================
   Base64 helpers
========================= */

export function blobToBase64(blob){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=>{
      const s = String(r.result || "");
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    r.onerror = ()=> reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function base64ToBlob(b64, mime){
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for(let i=0;i<bytes.length;i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
