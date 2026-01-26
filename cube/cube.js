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
   Back: Trip Recap
   Right: Log Catch
   Left: Catches
   Top: Quiver
   Bottom: Badges + Insights
========================= */

const faceNames = {
  front: "Trip",
  back: "Trip Recap",
  right: "Log Catch",
  left: "Catches",
  top: "Quiver",
  bottom: "Badges + Insights"
};

const faceNormals = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  right: [1, 0, 0],
  left: [-1, 0, 0],
  top: [0, -1, 0],
  bottom: [0, 1, 0]
};

const directionSteps = {
  left: { rotX: 0, rotY: 90 },
  right: { rotX: 0, rotY: -90 },
  up: { rotX: -90, rotY: 0 },
  down: { rotX: 90, rotY: 0 }
};

function setStatus(msg){
  if(statusEl) statusEl.textContent = msg;
}

function rotateX([x, y, z], deg){
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [x, y * cos - z * sin, y * sin + z * cos];
}

function rotateY([x, y, z], deg){
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [x * cos + z * sin, y, -x * sin + z * cos];
}

function getFrontFace(rotX, rotY){
  let best = null;
  for(const [key, normal] of Object.entries(faceNormals)){
    let next = rotateX(normal, rotX);
    next = rotateY(next, rotY);
    if(!best || next[2] > best.z){
      best = { key, z: next[2] };
    }
  }
  return faceNames[best?.key || "front"];
}

function normalizeDeg(deg){
  let value = deg % 360;
  if(value > 180) value -= 360;
  if(value < -180) value += 360;
  return value;
}

const baseRotX = -7;
const baseRotY = 30;
let spinX = 0;
let spinY = 0;
let renderFrame = null;
let snapFrame = null;

function getRenderRotation(){
  return {
    rotX: normalizeDeg(baseRotX + spinX),
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
    updateTips(rotX, rotY);
  });
}

function animateTo(targetSpinX, targetSpinY){
  const goalX = normalizeDeg(targetSpinX);
  const goalY = normalizeDeg(targetSpinY);

  if(snapFrame) window.cancelAnimationFrame(snapFrame);

  const step = () => {
    const dx = goalX - spinX;
    const dy = goalY - spinY;

    if(Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5){
      spinX = goalX;
      spinY = goalY;
      requestRender();
      snapFrame = null;
      return;
    }

    spinX += dx * 0.15;
    spinY += dy * 0.15;
    requestRender();
    snapFrame = window.requestAnimationFrame(step);
  };

  snapFrame = window.requestAnimationFrame(step);
}

function snapToNearest(){
  const snappedX = Math.round(spinX / 90) * 90;
  const snappedY = Math.round(spinY / 90) * 90;
  animateTo(snappedX, snappedY);
}

function updateTips(rotX, rotY){
  for(const [direction, delta] of Object.entries(directionSteps)){
    const tip = document.querySelector(`[data-tip="${direction}"]`);
    if(!tip) continue;
    const next = getFrontFace(rotX + delta.rotX, rotY + delta.rotY);
    tip.textContent = `Next: ${next}`;
  }
}

function canStartDrag(target){
  return !target.closest("input, textarea, select, button, label, a");
}

let isDragging = false;
let startX = 0;
let startY = 0;
let startSpinX = 0;
let startSpinY = 0;

cubeScene?.addEventListener("pointerdown", (event) => {
  if(!canStartDrag(event.target)) return;
  isDragging = true;
  startX = event.clientX;
  startY = event.clientY;
  startSpinX = spinX;
  startSpinY = spinY;
  cubeScene.setPointerCapture(event.pointerId);
  if(snapFrame) window.cancelAnimationFrame(snapFrame);
});

cubeScene?.addEventListener("pointermove", (event) => {
  if(!isDragging) return;
  const dx = event.clientX - startX;
  const dy = event.clientY - startY;
  spinY = normalizeDeg(startSpinY + dx * 0.3);
  spinX = normalizeDeg(startSpinX - dy * 0.3);
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
    const baseX = Math.round(spinX / 90) * 90;
    const baseY = Math.round(spinY / 90) * 90;
    animateTo(baseX + delta.rotX, baseY + delta.rotY);
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
