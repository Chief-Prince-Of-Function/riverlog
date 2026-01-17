import { exportTripZip, importTripZip, importTripPackage } from "../storage.js";
import { state } from "./state.js";
import { exportBtn, importInput } from "./dom.js";

export function initIO({ refreshTrips, setStatus }){
  exportBtn?.addEventListener("click", async ()=>{
    if(!state.tripId) return;
    setStatus("Exporting…");
    try{
      const { blob, filename } = await exportTripZip(state.tripId);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=> URL.revokeObjectURL(a.href), 1200);
      setStatus("Export complete. AirDrop the ZIP to your Mac and import.");
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
        const res = await importTripZip(file);
        await refreshTrips(res.tripId || null);
      }else{
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
