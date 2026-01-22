import { listTrips, listCatches } from "../storage.js";
import { state } from "./state.js";
import { badgeGrid } from "./dom.js";

const KEY = "riverlog_badges_v1";

/* Badge definitions */
const BADGES = [
  { id:"first_trip", icon:"🗺️", title:"First Trip", desc:"Created your first trip" },
  { id:"three_trips", icon:"📍", title:"3 Trips", desc:"Created 3 trips" },

  { id:"first_catch", icon:"🎣", title:"First Catch", desc:"Logged your first catch" },
  { id:"ten_catches", icon:"🔟", title:"10 Catches", desc:"Logged 10 catches" },
  { id:"twentyfive_catches", icon:"🏁", title:"25 Catches", desc:"Logged 25 catches" },

  { id:"first_photo", icon:"📸", title:"First Photo", desc:"Logged a catch photo" },
  { id:"first_gps", icon:"📍", title:"First GPS", desc:"Logged GPS for a catch" },

  { id:"first_collage", icon:"🧩", title:"First Collage", desc:"Built your first trip collage" },

  { id:"big_fish", icon:"🐟", title:"Big Fish", desc:"Logged a fish 18\" or longer" },
  { id:"fly_box_builder", icon:"🧰", title:"Fly Box Builder", desc:"Built your first fly box" },
  { id:"knot_maestro", icon:"🪢", title:"Knot Maestro", desc:"Tied a rock-solid knot" },
  { id:"dawn_patrol", icon:"🌅", title:"Dawn Patrol", desc:"Hit the water at sunrise" },
];

/* local state */
function loadUnlocked(){
  try{
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(_){
    return {};
  }
}
function saveUnlocked(map){
  try{
    localStorage.setItem(KEY, JSON.stringify(map || {}));
  }catch(_){}
}

/* toast UI */
function ensureToast(){
  let t = document.getElementById("badgeToast");
  if(t) return t;

  t = document.createElement("div");
  t.id = "badgeToast";
  t.className = "toast hidden";
  t.innerHTML = `
    <div class="toastTitle" id="badgeToastTitle"></div>
    <div class="toastSub" id="badgeToastSub"></div>
  `;
  document.body.appendChild(t);
  return t;
}

function showToast(title, sub){
  const t = ensureToast();
  const tt = document.getElementById("badgeToastTitle");
  const ts = document.getElementById("badgeToastSub");
  if(tt) tt.textContent = title;
  if(ts) ts.textContent = sub;

  t.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(()=> t.classList.add("hidden"), 2600);
}

/* render */
function renderBadges(unlocked){
  if(!badgeGrid) return;

  badgeGrid.innerHTML = "";
  for(const b of BADGES){
    const isOn = !!unlocked[b.id];

    const el = document.createElement("div");
    el.className = "badge" + (isOn ? "" : " badgeLocked");

    const icon = document.createElement("div");
    icon.className = "badgeIcon";
    icon.textContent = b.icon;

    const text = document.createElement("div");
    const title = document.createElement("div");
    title.className = "badgeTitle";
    title.textContent = b.title;

    text.appendChild(title);

    el.appendChild(icon);
    el.appendChild(text);

    badgeGrid.appendChild(el);
  }
}

/* evaluate rules */
function parseLen(val){
  const n = parseFloat(String(val || "").replace(/[^\d.]+/g, ""));
  return Number.isFinite(n) ? n : 0;
}

async function evaluateAndUnlock({ tripId, event } = {}){
  const unlocked = loadUnlocked();
  const beforeCount = Object.keys(unlocked).length;

  // trips
  const trips = await listTrips();
  const tripCount = trips.length;

  if(tripCount >= 1) unlocked.first_trip = true;
  if(tripCount >= 3) unlocked.three_trips = true;

  // catches (scoped to current trip for some, but totals across all trips for milestones)
  let allCatches = [];
  for(const t of trips){
    const rows = await listCatches(t.id);
    allCatches = allCatches.concat(rows);
  }

  const catchCount = allCatches.length;
  if(catchCount >= 1) unlocked.first_catch = true;
  if(catchCount >= 10) unlocked.ten_catches = true;
  if(catchCount >= 25) unlocked.twentyfive_catches = true;

  // photo/gps/big fish
  if(allCatches.some(c => c.photoBlob instanceof Blob)) unlocked.first_photo = true;
  if(allCatches.some(c => c.gps && typeof c.gps.lat === "number")) unlocked.first_gps = true;
  if(allCatches.some(c => parseLen(c.length) >= 18)) unlocked.big_fish = true;

  // collage badge set by event
  if(event === "collage_built") unlocked.first_collage = true;

  // save + render
  saveUnlocked(unlocked);
  renderBadges(unlocked);

  // toast newly unlocked
  const afterCount = Object.keys(unlocked).length;
  if(afterCount > beforeCount){
    // find which badge(s) are new
    const newly = BADGES.filter(b => unlocked[b.id] && !loadUnlocked._prev?.[b.id]);
    if(newly.length){
      const b = newly[0];
      showToast(`🏆 Badge unlocked: ${b.title}`, b.desc);
    }
  }

  loadUnlocked._prev = { ...unlocked };
  return unlocked;
}

/* public API */
export function initBadges(){
  const unlocked = loadUnlocked();
  loadUnlocked._prev = { ...unlocked };
  renderBadges(unlocked);

  // initial evaluation on boot
  evaluateAndUnlock().catch(()=>{});

  return {
    evaluateBadges: evaluateAndUnlock,
    unlockCollageBadge: ()=> evaluateAndUnlock({ event: "collage_built" })
  };
}
