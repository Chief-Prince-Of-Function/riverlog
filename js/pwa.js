export function initPWA(){
  /* =========================
     PWA install + SW
  ========================= */
  let deferredPrompt = null;
  const installBtn = document.getElementById("installBtn");

  window.addEventListener("beforeinstallprompt", (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    if(installBtn) installBtn.hidden = false;
  });

  installBtn?.addEventListener("click", async ()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });

  if("serviceWorker" in navigator){
    window.addEventListener("load", ()=>{
      navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
    });
  }
}
