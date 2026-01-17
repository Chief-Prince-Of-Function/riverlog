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
  function isMobileSheetMode(){
    return window.matchMedia && window.matchMedia("(max-width:720px)").matches;
  }

  function toggleNewTrip(show){
    if(!newTripForm) return;

    newTripForm.hidden = !show;
    document.body.classList.toggle("tripSheetOpen", !!show);

    if(show){
      try{ newTripDate.value = new Date().toISOString().slice(0,10); }catch(_){}
      // Let layout settle before focusing (helps iOS keyboard)
      setTimeout(()=> newTripLocation?.focus(), 0);
    }else{
      if(newTripLocation) newTripLocation.value = "";
      if(newTripDesc) newTripDesc.value = "";
      // optional: clear date too, but usually you want it to keep today's default
      // if(newTripDate) newTripDate.value = "";
    }
  }

  function closeNewTripIfOpen(){
    if(!newTripForm) return;
    if(newTripForm.hidden) return;
    toggleNewTrip(false);
  }

  // Close sheet when tapping the dimmed overlay area (mobile)
  document.addEventListener("click", (e)=>{
    // Only when the sheet is open and only on mobile mode
    if(!document.body.classList.contains("tripSheetOpen")) return;
    if(!isMobileSheetMode()) return;

    // If click is inside the sheet, ignore
    if(newTripForm && newTripForm.contains(e.target)) return;

    // If click is the New button itself, ignore (prevents immediate close)
    if(newTripBtn && (e.target === newTripBtn || newTripBtn.contains(e.target))) return;

    // Otherwise, user tapped the dim area
    closeNewTripIfOpen();
  }, { passive: true });

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

  newTripBtn?.addEventListener("click", ()=> toggleNewTrip(true));
  cancelTripBtn?.addEventListener("click", ()=> toggleNewTrip(false));

  createTripBtn?.addEventListener("click", async ()=>{
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
