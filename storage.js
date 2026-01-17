// storage.js — IndexedDB wrapper (Trips + Catches + Attachments)

const DB_NAME = "riverlog";
const DB_VERSION = 1;

function openDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e)=>{
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

export async function ensureDefaultTrip(){
  const db = await openDB();
  const trips = await listTrips();
  if(trips.length) return trips[0];

  const now = Date.now();
  const trip = {
    id: uid("trip"),
    name: new Date(now).toLocaleDateString(),
    location: "",
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

export async function getCatch(id){
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

export async function exportTripPackage(tripId){
  const trip = await getTrip(tripId);
  const catches = await listCatches(tripId);

  // Convert photo blobs -> base64 strings (compressed blobs are stored already)
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
   - Produces a .zip with:
       riverlog.json
       photos/<catchId>.jpg
   - Keeps JSON clean (no embedded base64)
========================= */

async function loadJSZip(){
  // Lazy-load JSZip so the main app stays light.
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

export async function exportTripZip(tripId){
  const trip = await getTrip(tripId);
  const catches = await listCatches(tripId);
  if(!trip) throw new Error("Trip not found");

  const JSZip = await loadJSZip();
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

export async function importTripZip(file){
  const JSZip = await loadJSZip();
  const ab = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(ab);

  const jsonFile = zip.file("riverlog.json");
  if(!jsonFile) throw new Error("Zip missing riverlog.json");
  const text = await jsonFile.async("string");
  const manifest = JSON.parse(text);
  if(manifest._schema !== "riverlog_trip_zip") throw new Error("Not a RiverLog zip export");

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
  if(!pkg || pkg._schema !== "riverlog_trip_package") throw new Error("Not a RiverLog export file");

  const trip = pkg.trip;
  const catches = pkg.catches || [];

  // Upsert trip
  trip.updatedAt = Date.now();
  await saveTrip(trip);

  // Upsert catches
  for(const c of catches){
    const row = { ...c };
    if(row.photo && row.photo.b64){
      row.photoBlob = base64ToBlob(row.photo.b64, row.photo.mime || "image/jpeg");
    }
    delete row.photo;
    await saveCatch(row);
  }
}

export function blobToBase64(blob){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=>{
      // result: data:mime;base64,xxxx
      const s = String(r.result || "");
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma+1) : s);
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
