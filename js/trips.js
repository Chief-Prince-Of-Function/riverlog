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
  tripMeta
} from "./dom.js";

/* =========================
   Trips module (Top card only)
   - Trip select
   - New Trip modal
   - Delete Trip
   - Updates trip meta line + refreshCatches callback
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

async function refreshTripSelect(selectedId){
  const trips = await listTrips();
  if(!tripSelect) return trips;

  tripSelect.innerHTML = "";
  for(const t of trips){
    const opt = document.createElement("option");
    opt.value = t.id;

    // Prefer location; fall back to name; never show empty
    const loc = String(t.location || "").trim();
    const name = String(t.name || "").trim();
    opt.textContent = (loc && safeText(loc) !== "-") ? loc : (name || "Trip");

    tripSelect.appendChild(opt);
  }

  const target = selectedId || (trips[0]?.id || "");
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
  const loc  = String(t.location || "").trim();
  const desc = String(t.desc || "").trim();

  if(loc) parts.push(loc);
  if(date) parts.push(date);
  if(desc) parts.push(desc);

  tripMeta.textContent = parts.length ? parts.join(" • ") : "—";
}

async function setActiveTrip(tripId, refreshCatches){
  state.tripId = tripId;
  await refreshTripMeta(tripId);
  await refreshCatches?.();
}

async function maybeDisableDeleteButton(){
  if(!deleteTripBtn) return;
  const trips = await listTrips();
  const disabled = trips.length <= 1;
  deleteTripBtn.disabled = disabled;
  deleteTripBtn.style.opacity = disabled ? ".55" : "1";
  deleteTripBtn.title = disabled ? "You must have at least 1 trip" : "Delete this trip";
}

export function initTrips({ refreshCatches, setStatus }){
  // iOS/Android: make sure selecting doesn’t instantly “cancel” via some outer tap handler
  // (safe no-op on desktop)
  tripSelect?.addEventListener("touchstart", (e)=> {
    e.stopPropagation();
  }, { passive: true });

  // Open “New Trip” modal
  newTripBtn?.addEventListener("click", ()=>{
    if(newTripLocation) newTripLocation.value = "";
    if(newTripDate) newTripDate.value = "";
    if(newTripDesc) newTripDesc.value = "";
    openNewTripSheet();
  });

  // Overlay click closes (only when tapping the dark backdrop)
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

      // keep fields for later features (harmless if unused)
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

      const remaining = await listTrips();
      const nextId = remaining[0]?.id || null;

      await refreshTrips(nextId);
      setStatus?.("Trip deleted.");
    }catch(e){
      setStatus?.(`Delete failed: ${e?.message || e}`);
    }
  });

  async function refreshTrips(selectedId){
    const trips = await refreshTripSelect(selectedId);
    const active = tripSelect?.value || trips[0]?.id || "";

    if(active){
      await setActiveTrip(active, refreshCatches);
    }else{
      state.tripId = null;
      if(tripMeta) tripMeta.textContent = "—";
      await refreshCatches?.();
    }

    await maybeDisableDeleteButton();
  }

  return { refreshTrips };
}
