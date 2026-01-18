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
   Trips module
   - New Trip modal (existing)
   - Edit Trip (re-uses same modal + save button)
   - Delete Trip (keeps at least 1)
========================= */

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

async function refreshTripSelect(selectedId){
  const trips = await listTrips();
  if(!tripSelect) return trips;

  tripSelect.innerHTML = "";
  for(const t of trips){
    const opt = document.createElement("option");
    opt.value = t.id;

    // Prefer location if set; else name; else "Trip"
    const loc = safeText(t.location);
    opt.textContent = (loc && loc !== "-") ? t.location : (t.name || "Trip");
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
  const loc = String(t.location || "").trim();
  const desc = String(t.desc || "").trim();

  if(loc) parts.push(loc);
  if(date) parts.push(date);
  if(desc) parts.push(desc);

  tripMeta.textContent = parts.length ? parts.join(" • ") : "—";
}

function clearTripSheetFields(){
  if(newTripLocation) newTripLocation.value = "";
  if(newTripDate) newTripDate.value = "";
  if(newTripDesc) newTripDesc.value = "";
}

function fillTripSheetFromTrip(t){
  if(newTripLocation) newTripLocation.value = t?.location || "";
  if(newTripDate) newTripDate.value = t?.date || "";
  if(newTripDesc) newTripDesc.value = t?.desc || "";
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
  // Are we editing an existing trip in the sheet?
  let editingTripId = null;

  function setSheetMode(mode){
    // mode: "new" | "edit"
    const isEdit = mode === "edit";
    editingTripId = isEdit ? (state.tripId || null) : null;

    if(createTripBtn){
      createTripBtn.textContent = isEdit ? "Save changes" : "Save new trip";
      createTripBtn.classList.toggle("isEditing", isEdit);
    }
  }

  // Open sheet for NEW trip
  newTripBtn?.addEventListener("click", ()=>{
    setSheetMode("new");
    clearTripSheetFields();
    openTripSheet();
  });

  // Overlay click closes
  tripSheetOverlay?.addEventListener("click", (e)=>{
    if(e.target === tripSheetOverlay) closeTripSheet();
  });

  cancelTripBtn?.addEventListener("click", closeTripSheet);

  // Trip select changes active trip
  tripSelect?.addEventListener("change", async ()=>{
    const id = tripSelect.value;
    if(!id) return;
    await setActiveTrip(id, refreshCatches);
    setStatus?.("Trip loaded.");
  });

  // ✅ New: Edit current trip using same sheet (prompt-based, no HTML changes)
  // If you add a real Edit button in HTML later, we can wire it by id.
  tripSelect?.addEventListener("dblclick", async ()=>{
    // desktop-only convenience: double click trip dropdown to edit
    if(!state.tripId) return;
    const t = await getTrip(state.tripId);
    if(!t) return;

    setSheetMode("edit");
    fillTripSheetFromTrip(t);
    openTripSheet();
    setStatus?.("Editing trip…");
  });

  // Save (create new OR update existing)
  createTripBtn?.addEventListener("click", async ()=>{
    const now = Date.now();

    // === UPDATE EXISTING ===
    if(editingTripId){
      const existing = await getTrip(editingTripId);
      if(!existing){
        setStatus?.("Trip not found.");
        setSheetMode("new");
        return;
      }

      const next = {
        ...existing,
        updatedAt: now,
        date: (newTripDate?.value || "").trim(),
        location: (newTripLocation?.value || "").trim(),
        desc: (newTripDesc?.value || "").trim()
      };

      // Keep a sensible name if blank
      if(!String(next.name || "").trim()){
        next.name = new Date(existing.createdAt || now).toLocaleDateString();
      }

      await saveTrip(next);
      closeTripSheet();

      await refreshTrips(next.id);
      setStatus?.("Trip updated.");
      setSheetMode("new");
      return;
    }

    // === CREATE NEW ===
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
    closeTripSheet();

    await refreshTrips(trip.id);
    setStatus?.("Trip created.");
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

    const active = tripSelect?.value || (trips[0]?.id || "");
    if(active){
      await setActiveTrip(active, refreshCatches);
    }

    await maybeDisableDeleteButton();

    // Reset sheet mode to "new" after refresh
    setSheetMode("new");
  }

  // Public API
  return {
    refreshTrips,

    // ✅ Call this from anywhere (e.g., a future Edit button)
    openEditTrip: async ()=>{
      if(!state.tripId) return;
      const t = await getTrip(state.tripId);
      if(!t) return;

      setSheetMode("edit");
      fillTripSheetFromTrip(t);
      openTripSheet();
      setStatus?.("Editing trip…");
    }
  };
}
