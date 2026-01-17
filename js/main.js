import { ensureDefaultTrip } from "../storage.js";
import { syncStatus, tripDrawer } from "./dom.js";
import { initPWA } from "./pwa.js";
import { initTrips } from "./trips.js";
import { initCatches } from "./catches.js";
import { initCollage } from "./collage.js";
import { initIO } from "./io.js";

function setStatus(msg){
  if(syncStatus) syncStatus.textContent = msg;
}

(async function boot(){
  try{
    initPWA();

    // init catches first so trips can call refreshCatches
    const { refreshCatches } = initCatches({ setStatus });
    const { refreshTrips } = initTrips({ refreshCatches, setStatus });

    // collage buttons + modal wiring
    initCollage({ setStatus });

    // export/import wiring
    initIO({ refreshTrips, setStatus });

    const t = await ensureDefaultTrip();
    await refreshTrips(t.id);

    if(tripDrawer) tripDrawer.style.display = "none";

    setStatus("Ready (offline-first)." + (navigator.onLine ? " Online." : " Offline."));
  }catch(e){
    setStatus(`Boot error: ${e.message || e}`);
  }
})();

window.addEventListener("online", ()=> setStatus("Online."));
window.addEventListener("offline", ()=> setStatus("Offline."));
