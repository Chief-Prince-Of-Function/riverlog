import {
  exportSelectedTripZip,
  exportAllTripsZip,
  importTripZip,
  importAllTripsZip,
  importTripPackage
} from "../storage.js";

import { state } from "./state.js";
import { exportBtn, importInput } from "./dom.js";

function downloadBlob(blob, filename){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename || "riverlog.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(a.href), 1200);
}

export function initIO({ refreshTrips, setStatus }){
  exportBtn?.addEventListener("click", async ()=>{
    const choice = window.prompt(
      "Export options:\n1 = Selected trip\n2 = All trips\n\nEnter 1 or 2:"
    );

    if(choice !== "1" && choice !== "2"){
      setStatus("Export canceled.");
      return;
    }

    if(choice === "1" && !state.tripId){
      setStatus("No trip selected.");
      return;
    }

    setStatus("Exporting…");

    try{
      if(choice === "2"){
        const { blob, filename } = await exportAllTripsZip();
        downloadBlob(blob, filename);
        setStatus("Export complete (ALL trips). AirDrop the ZIP to your Mac and import.");
      }else{
        const { blob, filename } = await exportSelectedTripZip(state.tripId);
        downloadBlob(blob, filename);
        setStatus("Export complete (selected trip). AirDrop the ZIP to your Mac and import.");
      }
    }catch(e){
      setStatus(`Export failed: ${e.message || e}`);
    }
  });

  importInput?.addEventListener("change", async (e)=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;

    setStatus("Importing…");

    try{
      const name = (file.name || "").toLowerCase();

      if(name.endsWith(".zip")){
        // Try single-trip zip first; if it’s an ALL backup zip, fall back.
        try{
          const res = await importTripZip(file);
          await refreshTrips(res?.tripId || null);
        }catch(err){
          const msg = String(err?.message || err || "");
          if(
            msg.includes("Zip missing riverlog.json") ||
            msg.includes("Not a RiverLog trip zip export")
          ){
            await importAllTripsZip(file);
            await refreshTrips(null);
          }else{
            throw err;
          }
        }
      }else{
        // JSON package
        const text = await file.text();
        const pkg = JSON.parse(text);
        await importTripPackage(pkg);
        await refreshTrips(pkg.trip?.id || null);
      }

      setStatus("Import complete.");
    }catch(err){
      setStatus(`Import failed: ${err.message || err}`);
    }finally{
      importInput.value = "";
    }
  });
}
