import { uid, listTrips, getTrip, saveTrip, deleteTrip } from "../storage.js";
import { safeText } from "./utils.js";
import { state } from "./state.js";
import {
  tripSelect,
  newTripBtn,
  editTripBtn,
  deleteTripBtn,

  newTripForm,
  tripSheetOverlay,
  newTripLocation,
  newTripDate,
  newTripDesc,
  createTripBtn,
  cancelTripBtn,

  // Trip Recap (collapsible <details>)
  tripRecapCollapse,

  // Trip Recap fields
  saveTripBtn,
  tripName,
  tripDate,
  tripLocation,
  tripDesc,
  tripFlyWin,
  tripLessons,
  tripRecap
} from "./dom.js";

/* =========================
   Trips module
   - New Trip modal (fast create)
   - Edit Trip (same modal reused)
   - Trip Recap is collapsible (<details>)
========================= */

/* ===== New/Edit Trip Modal ===== */

// Your HTML has this input, but it wasn’t wired in the original trips.js
const newTripName = document.getElementById("newTripName");

function openTripSheet(){
  if(tripSheetOverlay) tripSheetOverlay.hidden = false;
  if(newTripForm) newTripForm.hidden = false;
  document.body.classList.add("tripSheetOpen");
}

function closeTripSheet(){
  if(tripSheetOverlay) tripSheetOverlay.hidden = true;
  if(newTripForm) newTripForm.hidden = true;
  document.body.classList.remove("tripSheetOpen");
}

/* ===== Helpers ===== */

function fmtTripDate(d){
  const raw = String(d || "").trim();
  if(!raw) return "";
  try{
    const dt = new Date(raw);
    if(!isNaN(dt)) return dt.toLocaleDateString();
  }catch(_){}
  return raw;
}

function tripSelectLabel(t){
  // Primary: Trip name
  const name = String(t?.name || "").trim() || "Trip";

  // Meta: date + where (optional)
  const date = fmtTripDate(t?.date);
  const where = String(t?.location || "").trim();

  // Example: "BBM 26 — 1/19/2026 · Keuka Lake"
  const meta = [];
  if(date) meta.push(date);
  if(where) meta.push(where);

  return meta.length ? `${name} — ${meta.join(" · ")}` : name;
}

async function refreshTripSelect(selectedId){
  const trips = await listTrips();
  if(!tripSelect) return trips;

  tripSelect.innerHTML = "";

  for(const t of trips){
    const opt = document.createElement("option");
    opt.value = t.id;

    // Dropdown: Trip Name — Date · Where
    opt.textContent = tripSelectLabel(t);
    tripSelect.appendChild(opt);
  }

  const target = selectedId || (trips[0] ? trips[0].id : "");
  if(target) tripSelect.value = target;

  return trips;
}

async function setActiveTrip(tripId, refreshCatches){
  state.tripId = tripId;
  await refreshCatches?.();

  // close recap collapse when switching trips (optional UX)
  if(tripRecapCollapse) tripRecapCollapse.open = false;
}

async function maybeDisableDeleteButton(){
  if(!deleteTripBtn) return;
  const trips = await listTrips();
  deleteTripBtn.disabled = trips.length <= 1;
  deleteTripBtn.style.opacity = deleteTripBtn.disabled ? ".55" : "1";
  deleteTripBtn.title = deleteTripBtn.disabled
    ? "You must have at least 1 trip"
    : "Delete this trip";
}

/* ===== Trip Recap load/save ===== */

async function loadTripIntoRecap(tripId){
  const t = await getTrip(tripId);
  if(!t) return;

  if(tripName) tripName.value = t.name || "";
  if(tripDate) tripDate.value = t.date || "";
  if(tripLocation) tripLocation.value = t.location || "";
  if(tripDesc) tripDesc.value = t.desc || "";
  if(tripFlyWin) tripFlyWin.value = t.flyWin || "";
  if(tripLessons) tripLessons.value = t.lessons || "";
  if(tripRecap) tripRecap.value = t.recap || "";
}

async function saveRecap(tripId, setStatus){
  const t = await getTrip(tripId);
  if(!t){
    setStatus?.("Trip not found.");
    return;
  }

  const now = Date.now();
  const next = {
    ...t,
    updatedAt: now,
    name: (tripName?.value || "").trim(),
    date: (tripDate?.value || "").trim(),
    location: (tripLocation?.value || "").trim(),
    desc: (tripDesc?.value || "").trim(),
    flyWin: (tripFlyWin?.value || "").trim(),
    lessons: (tripLessons?.value || "").trim(),
    recap: (tripRecap?.value || "").trim()
  };

  await saveTrip(next);
  setStatus?.("Trip recap saved.");
}

/* ===== Edit Trip (reuse New Trip modal) ===== */

let editingTripId = null;

function resetTripSheetToCreateMode(){
  editingTripId = null;
  if(createTripBtn) createTripBtn.textContent = "Save new trip";
}

async function openEditTripSheet(tripId){
  const t = await getTrip(tripId);
  if(!t) return;

  editingTripId = t.id;

  // ✅ Now we also fill the Trip Name input in the sheet
  if(newTripName) newTripName.value = t.name || "";
  if(newTripLocation) newTripLocation.value = t.location || "";
  if(newTripDate) newTripDate.value = t.date || "";
  if(newTripDesc) newTripDesc.value = t.desc || "";

  if(createTripBtn) createTripBtn.textContent = "Save changes";
  openTripSheet();
}

/* =========================
   init
========================= */

export function initTrips({ refreshCatches, setStatus }){
  // New Trip
  newTripBtn?.addEventListener("click", ()=>{
    resetTripSheetToCreateMode();

    if(newTripName) newTripName.value = "";
    if(newTripLocation) newTripLocation.value = "";
    if(newTripDate) newTripDate.value = "";
    if(newTripDesc) newTripDesc.value = "";

    openTripSheet();
  });

  // Edit Trip
  editTripBtn?.addEventListener("click", async ()=>{
    if(!state.tripId) return;
    await openEditTripSheet(state.tripId);
  });

  // Overlay click closes
  tripSheetOverlay?.addEventListener("click", (e)=>{
    if(e.target === tripSheetOverlay){
      closeTripSheet();
      resetTripSheetToCreateMode();
    }
  });

  cancelTripBtn?.addEventListener("click", ()=>{
    closeTripSheet();
    resetTripSheetToCreateMode();
  });

  // Save trip (create OR edit)
  createTripBtn?.addEventListener("click", async ()=>{
    const now = Date.now();

    // EDIT MODE
    if(editingTripId){
      const existing = await getTrip(editingTripId);
      if(!existing){
        setStatus?.("Trip not found.");
        closeTripSheet();
        resetTripSheetToCreateMode();
        return;
      }

      const updated = {
        ...existing,
        updatedAt: now,
        name: (newTripName?.value || "").trim() || existing.name || "Trip",
        date: (newTripDate?.value || "").trim(),
        location: (newTripLocation?.value || "").trim(),
        desc: (newTripDesc?.value || "").trim()
      };

      await saveTrip(updated);

      closeTripSheet();
      resetTripSheetToCreateMode();

      await refreshTrips(updated.id);
      setStatus?.("Trip updated.");
      return;
    }

    // CREATE MODE
    const trip = {
      id: uid("trip"),
      updatedAt: now,
      createdAt: now,

      // ✅ Use the Trip Name field if set, otherwise a sensible default
      name: (newTripName?.value || "").trim() || "New Trip",
      date: (newTripDate?.value || "").trim(),
      location: (newTripLocation?.value || "").trim(),
      desc: (newTripDesc?.value || "").trim(),

      flyWin: "",
      lessons: "",
      recap: ""
    };

    await saveTrip(trip);

    closeTripSheet();
    resetTripSheetToCreateMode();

    await refreshTrips(trip.id);
    setStatus?.("Trip created.");
  });

  // Trip selection
  tripSelect?.addEventListener("change", async ()=>{
    const id = tripSelect.value;
    if(!id) return;
    await setActiveTrip(id, refreshCatches);
    setStatus?.("Trip loaded.");
  });

  // Trip Recap collapse: load fields when opened
  if(tripRecapCollapse){
    tripRecapCollapse.addEventListener("toggle", async ()=>{
      if(!tripRecapCollapse.open) return;
      if(!state.tripId) return;
      await loadTripIntoRecap(state.tripId);
    });
  }

  // Save recap
  saveTripBtn?.addEventListener("click", async ()=>{
    if(!state.tripId) return;
    await saveRecap(state.tripId, setStatus);
    await refreshTrips(state.tripId);
  });

  // Delete trip
  deleteTripBtn?.addEventListener("click", async ()=>{
    if(!state.tripId) return;

    const trips = await listTrips();
    if(trips.length <= 1){
      setStatus?.("You must keep at least 1 trip.");
      return;
    }

    const current = await getTrip(state.tripId);
    const label = (current?.name || current?.location || "this trip").trim();

    const ok = confirm(
      `Delete "${label}"?\n\nThis deletes the trip AND all catches/photos inside it.\nThis cannot be undone.`
    );
    if(!ok) return;

    setStatus?.("Deleting trip…");

    try{
      const deletingId = state.tripId;
      await deleteTrip(deletingId);

      const remaining = (await listTrips()) || [];
      const nextId = remaining[0]?.id || null;

      await refreshTrips(nextId);
      setStatus?.("Trip deleted.");
    }catch(e){
      setStatus?.(`Delete failed: ${e?.message || e}`);
    }
  });

  async function refreshTrips(selectedId){
    const trips = await refreshTripSelect(selectedId);

    const active = tripSelect?.value || (trips[0] ? trips[0].id : "");
    if(active){
      await setActiveTrip(active, refreshCatches);
    }

    await maybeDisableDeleteButton();
  }

  return { refreshTrips };
}