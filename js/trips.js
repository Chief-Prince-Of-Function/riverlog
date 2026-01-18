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
  tripMeta,
  tripDrawer,
  closeTripDrawer,
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
   - Trip Recap collapsible (drawer)
========================= */

/* ===== New Trip Modal ===== */

function openNewTripSheet(){
  if(tripSheetOverlay) tripSheetOverlay.hidden = false;
  if(newTripForm) newTripForm.hidden = false;
  document.body.classList.add("tripSheetOpen");
}

function closeNewTripSheet(){
  if(tripSheetOverlay) tripSheetOverlay.hidden = true;
  if(newTripForm) newTripForm.hidden = true;
  document.body.classList.remove("tripSheetOpen");
}

/* ===== Trip Recap (collapsible) ===== */

function setTripDrawerOpen(open){
  if(!tripDrawer) return;
  tripDrawer.hidden = !open;
  tripDrawer.setAttribute("aria-hidden", open ? "false" : "true");
}

/* ===== Helpers ===== */

async function refreshTripSelect(selectedId){
  const trips = await listTrips();
  if(!tripSelect) return trips;

  tripSelect.innerHTML = "";
  for(const t of trips){
    const opt = document.createElement("option");
    opt.value = t.id;

    // show location if set, else fallback to name/date
    const loc = safeText(t.location);
    opt.textContent = (loc && loc !== "-") ? loc : (t.name || "Trip");

    tripSelect.appendChild(opt);
  }

  const target = selectedId || (trips[0] ? trips[0].id : "");
  if(target) tripSelect.value = target;

  return trips;
}

async function refreshTripMeta(tripId){
  if(!tripMeta) return;
  const t = await getTrip(tripId);
  if(!t){
    tripMeta.textContent = "—";
    return;
  }

  const parts = [];
  const date = String(t.date || "").trim();
  const loc = String(t.location || "").trim();
  const desc = String(t.desc || "").trim();

  if(loc) parts.push(loc);
  if(date) parts.push(date);
  if(desc) parts.push(desc);

  tripMeta.textContent = parts.length ? parts.join(" • ") : "—";
}

async function loadTripIntoRecapDrawer(tripId){
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

async function saveRecapDrawerTrip(tripId, setStatus){
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

/* ===== Trip editing in the SAME modal as New Trip ===== */

let editingTripId = null;

async function openEditTripSheet(tripId){
  const t = await getTrip(tripId);
  if(!t) return;

  editingTripId = t.id;

  // Fill modal fields (reuse “new trip” modal)
  if(newTripLocation) newTripLocation.value = t.location || "";
  if(newTripDate) newTripDate.value = t.date || "";
  if(newTripDesc) newTripDesc.value = t.desc || "";

  // Button label changes
  if(createTripBtn) createTripBtn.textContent = "Save changes";

  openNewTripSheet();
}

function resetTripSheetToCreateMode(){
  editingTripId = null;
  if(createTripBtn) createTripBtn.textContent = "Save new trip";
}

async function setActiveTrip(tripId, refreshCatches){
  state.tripId = tripId;
  await refreshTripMeta(tripId);
  await refreshCatches?.();
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

/* =========================
   init
========================= */

export function initTrips({ refreshCatches, setStatus }){

  // New Trip
  newTripBtn?.addEventListener("click", ()=>{
    resetTripSheetToCreateMode();

    if(newTripLocation) newTripLocation.value = "";
    if(newTripDate) newTripDate.value = "";
    if(newTripDesc) newTripDesc.value = "";

    openNewTripSheet();
  });

  // Edit Trip (NEW)
  editTripBtn?.addEventListener("click", async ()=>{
    if(!state.tripId) return;
    await openEditTripSheet(state.tripId);
  });

  // Overlay click closes
  tripSheetOverlay?.addEventListener("click", (e)=>{
    if(e.target === tripSheetOverlay){
      closeNewTripSheet();
      resetTripSheetToCreateMode();
    }
  });

  cancelTripBtn?.addEventListener("click", ()=>{
    closeNewTripSheet();
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
        closeNewTripSheet();
        resetTripSheetToCreateMode();
        return;
      }

      const updated = {
        ...existing,
        updatedAt: now,
        date: (newTripDate?.value || "").trim(),
        location: (newTripLocation?.value || "").trim(),
        desc: (newTripDesc?.value || "").trim()
      };

      await saveTrip(updated);

      closeNewTripSheet();
      resetTripSheetToCreateMode();

      await refreshTrips(updated.id);
      setStatus?.("Trip updated.");
      return;
    }

    // CREATE MODE
    const trip = {
      id: uid("trip"),
      name: new Date(now).toLocaleDateString(),
      date: (newTripDate?.value || "").trim(),
      location: (newTripLocation?.value || "").trim(),
      desc: (newTripDesc?.value || "").trim(),
      createdAt: now,
      updatedAt: now,
      flyWin: "",
      lessons: "",
      recap: ""
    };

    await saveTrip(trip);

    closeNewTripSheet();
    resetTripSheetToCreateMode();

    await refreshTrips(trip.id);
    setStatus?.("Trip created.");
  });

  // Trip selection
  tripSelect?.addEventListener("change", async ()=>{
    const id = tripSelect.value;
    if(!id) return;

    // close recap drawer on trip switch
    setTripDrawerOpen(false);

    await setActiveTrip(id, refreshCatches);
    setStatus?.("Trip loaded.");
  });

  /* ===== Trip Recap collapsible wiring ===== */

  // If your recap has a close button
  closeTripDrawer?.addEventListener("click", ()=>{
    setTripDrawerOpen(false);
  });

  // Save recap
  saveTripBtn?.addEventListener("click", async ()=>{
    if(!state.tripId) return;
    await saveRecapDrawerTrip(state.tripId, setStatus);
    await refreshTrips(state.tripId);
  });

  // Make recap drawer open when you click the meta line (nice UX)
  tripMeta?.addEventListener("click", async ()=>{
    if(!state.tripId) return;

    const isOpen = !tripDrawer?.hidden;
    if(isOpen){
      setTripDrawerOpen(false);
      return;
    }

    await loadTripIntoRecapDrawer(state.tripId);
    setTripDrawerOpen(true);
    setStatus?.("Trip recap opened.");
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
    const label = (current?.location || current?.name || "this trip").trim();

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
      setTripDrawerOpen(false);

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
