import { photoOverlay, photoModal, photoModalImg, photoModalClose } from "./dom.js";

let activeCleanup = null;

function closePhotoViewer(){
  if(!photoOverlay || !photoModal || !photoModalImg) return;
  photoOverlay.classList.add("hidden");
  photoModal.classList.add("hidden");
  document.body.classList.remove("modalOpen");
  photoModalImg.src = "";
  if(activeCleanup){
    activeCleanup();
    activeCleanup = null;
  }
}

export function openPhotoViewer({ src, alt, cleanup }){
  if(!photoOverlay || !photoModal || !photoModalImg) return;
  if(activeCleanup){
    activeCleanup();
    activeCleanup = null;
  }
  photoModalImg.src = src;
  photoModalImg.alt = alt || "Photo preview";
  photoOverlay.classList.remove("hidden");
  photoModal.classList.remove("hidden");
  document.body.classList.add("modalOpen");
  if(typeof cleanup === "function"){
    activeCleanup = cleanup;
  }
}

export function initPhotoViewer(){
  photoOverlay?.addEventListener("click", closePhotoViewer);
  photoModalClose?.addEventListener("click", closePhotoViewer);
  document.addEventListener("keydown", (event)=>{
    if(event.key === "Escape"){
      closePhotoViewer();
    }
  });
}
