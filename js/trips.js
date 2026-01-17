import { uid, listTrips, getTrip, saveTrip } from "../storage.js";
import { fmtTime } from "./utils.js";
import { state } from "./state.js";
import {
  tripSelect,
  newTripBtn,
  newTripForm,
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
  tripRecap,
} from "./dom.js";

export function initTrips({ refreshCatches, setStatus }){
  const overlay = document.getElementById("tripSheetOverlay");

  // Stop overlay-close logic from seeing taps inside the sheet
  let formArmored = false;
  function armorFormOnce(){
    if(!newTripForm || formArmored) return;
    formArmored = true;

    const stop = (e)=> e.stopPropagation();

    // pointer events cover iOS Safari 13+ and modern browsers
    newTripForm.addEventListener("pointerdown", stop);
    newTripForm.addEventListener("pointerup", stop);
    newTripForm.addEventListener("click", stop);
  }

  function toggleNewTrip(show){
    if(!newTripForm) return;

    armorFormOnce();

    newTripForm.hidden = !show;
    if(overlay) overlay.hidden = !show;

    document.body.classList.toggle("tripSheetOpen", show);

    if(show){
      // focus after paint so iOS doesn't “ghost tap”
      setTimeout(()=> newTripLocation?.focus?.(), 60);
    }
  }

  function closeNewTripIfOpen(){
    if(!newTripForm || newTripForm.hidden) return;
    toggleNewTrip(false);
  }

  // Close ONLY when the overlay background itself is tapped
  if(overlay){
    const closeIfBackdrop = (e)=>{
      if(e.target === overlay) toggleNewTrip(false);
    };

    // Prefer pointerup so it doesn't fight with focus on inputs
    overlay.addEventListener("pointerup", closeIfBackdrop);

    // Fallback for older browsers
    overlay.addEventListener("click", closeIfBackdrop);
  }

  // ESC closes (desktop)
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape") closeNewTripIfOpen();
  });

  async function refreshTripMeta(){
    const t = state.tripId ? await getTrip(state.tripId) : null;
    if(!t){
      if(tripMeta) tripMeta.textContent = "—";
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

    if(tripMeta) tripMeta.textContent = bits.join(" • ");

    // Fill recap drawer fields
    if(tripName) tripName.value = t.name || "";
    if(tripDate) tripDate.value = t.date || "";
    if(tripLocation) tripLocation.value = t.location || "";
    if(tripDesc) tripDesc.value = t.desc || "";
    if(tripFlyWin) tripFlyWin.value = t.flyWin || "";
    if(tripLessons) tripLessons.value = t.lessons || "";
    if(tripRecap) tripRecap.value = t.recap || "";
  }

  async function refreshTrips(selectedId=null){
    const trips = await listTrips();

    if(tripSelect) tripSelect.innerHTML = "";
    for(const t of trips){
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name || "(Unnamed trip)";
      tripSelect?.appendChild(opt);
    }

    if(selectedId) tripSelect.value = selectedId;
    if(!tripSelect.value && trips[0]) tripSelect.value = trips[0].id;

    state.tripId = tripSelect.value || null;

    await refreshTripMeta();
    await refreshCatches();
  }

  // expose for main.js
  initTrips.refreshTrips = refreshTrips;
  initTrips.refreshTripMeta = refreshTripMeta;

  // Use pointerup for buttons (single reliable tap), fallback click
  function onTap(el, fn){
    if(!el) return;

    const handler = async (e)=>{
      e.stopPropagation();
      // Important: prevent “ghost click” follow-up on iOS
      if(e.type === "pointerup") e.preventDefault?.();
      await fn(e);
    };

    el.addEventListener("pointerup", handler);
    el.addEventListener("click", handler);
  }

  onTap(newTripBtn, ()=> toggleNewTrip(true));
  onTap(cancelTripBtn, ()=> toggleNewTrip(false));

  onTap(createTripBtn, async ()=>{
    const now = Date.now();
    const location = (newTripLocation?.value || "").trim();
    const date = (newTripDate?.value || "").trim();
    const desc = (newTripDesc?.value || "").trim();

    const labelDate = date
      ? new Date(date + "T00:00:00").toLocaleDateString()
      : new Date(now).toLocaleDateString();

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

  tripSelect?.addEventListener("change", async ()=>{
    state.tripId = tripSelect.value;
    await refreshTripMeta();
    await refreshCatches();
  });

  editTripBtn?.addEventListener("click", ()=>{
    if(!tripDrawer) return;
    tripDrawer.style.display = "block";
    tripDrawer.setAttribute("aria-hidden", "false");
    tripDrawer.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  closeTripDrawer?.addEventListener("click", ()=>{
    if(!tripDrawer) return;
    tripDrawer.style.display = "none";
    tripDrawer.setAttribute("aria-hidden", "true");
  });

  saveTripBtn?.addEventListener("click", async ()=>{
    if(!state.tripId) return;
    const t = await getTrip(state.tripId);
    if(!t) return;

    t.name = (tripName?.value || "").trim() || t.name;
    t.date = (tripDate?.value || "").trim();
    t.location = (tripLocation?.value || "").trim();
    t.desc = (tripDesc?.value || "").trim();
    t.flyWin = (tripFlyWin?.value || "").trim();
    t.lessons = (tripLessons?.value || "").trim();
    t.recap = (tripRecap?.value || "").trim();
    t.updatedAt = Date.now();

    await saveTrip(t);
    await refreshTrips(t.id);
    setStatus("Trip recap saved.");
  });

  return { refreshTrips, refreshTripMeta };
}
