import { initTrips } from "../js/trips.js";
import { initCatches } from "../js/catches.js";
import { initCollage } from "../js/collage.js";
import { initBadges } from "../js/badges.js";
import { initFlyBox } from "../js/ui/flybox.js";
import { initPhotoViewer } from "../js/photo-viewer.js";
import { initTheme } from "../js/theme.js";

const cube = document.getElementById("cube");
const cubeScene = document.getElementById("cubeScene");
const statusEl = document.getElementById("syncStatus");

/* =========================
   Face mapping
   Front: Trip
   Front-right: Log Catch
   Back-right: Trip Recap
   Back: Badges + Insights
   Back-left: Quiver
   Front-left: Catches
========================= */

const faceRing = [
  { label: "Trip", angle: 0 },
  { label: "Log Catch", angle: 60 },
  { label: "Trip Recap", angle: 120 },
  { label: "Badges + Insights", angle: 180 },
  { label: "Quiver", angle: 240 },
  { label: "Catches", angle: 300 }
];

const directionSteps = {
  left: { rotY: 60 },
  right: { rotY: -60 },
  up: { rotY: -60 },
  down: { rotY: 60 }
};

function setStatus(msg){
  if(statusEl) statusEl.textContent = msg;
}

function normalizeDeg(deg){
  let value = deg % 360;
  if(value > 180) value -= 360;
  if(value < -180) value += 360;
  return value;
}

function getFrontFace(rotY){
  const normalized = normalizeDeg(rotY);
  let best = faceRing[0];
  let bestDistance = Infinity;
  for(const face of faceRing){
    const distance = Math.abs(normalizeDeg(normalized - face.angle));
    if(distance < bestDistance){
      bestDistance = distance;
      best = face;
    }
  }
  return best.label;
}

const baseRotX = -6;
const baseRotY = 30;
let spinY = 0;
let renderFrame = null;
let snapFrame = null;

function getRenderRotation(){
  return {
    rotX: baseRotX,
    rotY: normalizeDeg(baseRotY + spinY)
  };
}

function requestRender(){
  if(renderFrame) return;
  renderFrame = window.requestAnimationFrame(() => {
    renderFrame = null;
    if(!cube) return;
    const { rotX, rotY } = getRenderRotation();
    // Rotation order: rotateX first, then rotateY (matches math above).
    cube.style.transform = `rotateY(${rotY}deg) rotateX(${rotX}deg)`;
    updateTips(rotY);
  });
}

function animateTo(targetSpinY){
  const goalY = normalizeDeg(targetSpinY);

  if(snapFrame) window.cancelAnimationFrame(snapFrame);

  const step = () => {
    const dy = goalY - spinY;

    if(Math.abs(dy) < 0.5){
      spinY = goalY;
      requestRender();
      snapFrame = null;
      return;
    }

    spinY += dy * 0.15;
    requestRender();
    snapFrame = window.requestAnimationFrame(step);
  };

  snapFrame = window.requestAnimationFrame(step);
}

function snapToNearest(){
  const snappedY = Math.round(spinY / 60) * 60;
  animateTo(snappedY);
}

function updateTips(rotY){
  for(const [direction, delta] of Object.entries(directionSteps)){
    const tip = document.querySelector(`[data-tip="${direction}"]`);
    if(!tip) continue;
    const next = getFrontFace(rotY + delta.rotY);
    tip.textContent = `Next: ${next}`;
  }
}

function canStartDrag(target){
  return !target.closest("input, textarea, select, button, label, a");
}

let isDragging = false;
let startX = 0;
let startSpinY = 0;

cubeScene?.addEventListener("pointerdown", (event) => {
  if(!canStartDrag(event.target)) return;
  isDragging = true;
  startX = event.clientX;
  startSpinY = spinY;
  cubeScene.setPointerCapture(event.pointerId);
  if(snapFrame) window.cancelAnimationFrame(snapFrame);
});

cubeScene?.addEventListener("pointermove", (event) => {
  if(!isDragging) return;
  const dx = event.clientX - startX;
  spinY = normalizeDeg(startSpinY + dx * 0.3);
  requestRender();
});

function endDrag(){
  if(!isDragging) return;
  isDragging = false;
  snapToNearest();
}

cubeScene?.addEventListener("pointerup", endDrag);
cubeScene?.addEventListener("pointercancel", endDrag);

for(const button of document.querySelectorAll(".cube-control")){
  button.addEventListener("click", () => {
    const direction = button.dataset.direction;
    const delta = directionSteps[direction];
    if(!delta) return;
    const baseY = Math.round(spinY / 60) * 60;
    animateTo(baseY + delta.rotY);
  });
}

/* =========================
   RiverLog logic wiring
   (imports from existing /js modules, DOM IDs mirror core app)
========================= */

(async function boot(){
  try{
    initTheme();
    setStatus("Booting…");

    const { evaluateBadges } = initBadges();

    initPhotoViewer();
    initFlyBox({ setStatus });

    const { refreshCatches } = initCatches({ setStatus });
    const { refreshTrips } = initTrips({ refreshCatches, setStatus });

    await refreshTrips();

    initCollage({ setStatus });

    try{
      await evaluateBadges();
    }catch(_){
      // ignore badge boot errors
    }

    setStatus("Ready (offline-first)." + (navigator.onLine ? " Online." : " Offline."));
  }catch(e){
    setStatus(`Boot error: ${e?.message || e}`);
    console.error(e);
  }
})();

window.addEventListener("online", () => setStatus("Online."));
window.addEventListener("offline", () => setStatus("Offline."));

requestRender();

const modalConfigs = [
  { triggerId: "openTripModalBtn", modalId: "tripModal", overlayId: "tripModalOverlay" },
  { triggerId: "openLogCatchModalBtn", modalId: "logCatchModal", overlayId: "logCatchModalOverlay" },
  { triggerId: "openCatchesModalBtn", modalId: "catchesModal", overlayId: "catchesModalOverlay" },
  { triggerId: "openQuiverModalBtn", modalId: "quiverModal", overlayId: "quiverModalOverlay" },
  { triggerId: "openBadgesModalBtn", modalId: "badgesModal", overlayId: "badgesModalOverlay" },
  { triggerId: "openTripRecapModalBtn", modalId: "tripRecapModal", overlayId: "tripRecapModalOverlay" }
];

function setupModal({ triggerId, modalId, overlayId }){
  const trigger = document.getElementById(triggerId);
  const modal = document.getElementById(modalId);
  const overlay = document.getElementById(overlayId);
  const closeBtn = modal?.querySelector("[data-modal-close]");
  if(!trigger || !modal || !overlay) return;

  const open = () => {
    modal.classList.remove("hidden");
    overlay.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    overlay.setAttribute("aria-hidden", "false");
  };

  const close = () => {
    modal.classList.add("hidden");
    overlay.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    overlay.setAttribute("aria-hidden", "true");
  };

  trigger.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if(event.key === "Escape" && !modal.classList.contains("hidden")){
      close();
    }
  });
}

for(const config of modalConfigs){
  setupModal(config);
}
