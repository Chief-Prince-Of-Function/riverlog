import { uid, listTrips, getTrip, saveTrip, deleteTrip } from "../storage.js";
import { safeText } from "./utils.js";
import { state } from "./state.js";
import {
  tripSelect,
  newTripBtn,
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
  editTripBtn,
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
========================= */

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

function setTripDrawerOpen(open){
  if(!tripDrawer) return;
  tripDrawer.style.display = open ? "block" : "none";
  tripDrawer.setAttribute("aria-hidden", open ? "false" : "true");
}

async function refreshTripSelect(selectedId){
  const trips = await listTrips();
  if(!tripSelect) return trips;

  tripSelect.innerHTML = "";
  for(const t of trips){
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = safeText(t.location) !== "-" ? t.location : (t.name || "Trip");
    tripSelect.appendChild(opt);
  }

  // choose selected
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

async function loadTripIntoDrawer(tripId){
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

async function saveDrawerTrip(tripId, setStatus){
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

export function initTrips({ refreshCatches, setStatus }){
  // Open “New Trip” modal
  newTripBtn?.addEventListener("click", ()=>{
    if(newTripLocation) newTripLocation.value = "";
    if(newTripDate) newTripDate.value = "";
    if(newTripDesc) newTripDesc.value = "";
    openNewTripSheet();
  });

  // Overlay click closes
  tripSheetOverlay?.addEventListener("click", (e)=>{
    if(e.target === tripSheetOverlay) closeNewTripSheet();
  });

  cancelTripBtn?.addEventListener("click", closeNewTripSheet);

  // Create trip
  createTripBtn?.addEventListener("click", async ()=>{
    const now = Date.now();

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

    await refreshTrips(trip.id);
    setStatus?.("Trip created.");
  });

  // Trip select changes active trip
  tripSelect?.addEventListener("change", async ()=>{
    const id = tripSelect.value;
    if(!id) return;
    await setActiveTrip(id, refreshCatches);
    setStatus?.("Trip loaded.");
  });

  // Drawer open/close
  editTripBtn?.addEventListener("click", async ()=>{
    if(!state.tripId) return;
    await loadTripIntoDrawer(state.tripId);
    setTripDrawerOpen(true);
  });

  closeTripDrawer?.addEventListener("click", ()=>{
    setTripDrawerOpen(false);
  });

  saveTripBtn?.addEventListener("click", async ()=>{
    if(!state.tripId) return;
    await saveDrawerTrip(state.tripId, setStatus);
    await refreshTrips(state.tripId);
  });

  // ✅ DELETE TRIP
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

      // delete from DB
      await deleteTrip(deletingId);

      // pick next trip
      const remaining = (await listTrips()) || [];
      const nextId = remaining[0]?.id || null;

      // refresh UI
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
