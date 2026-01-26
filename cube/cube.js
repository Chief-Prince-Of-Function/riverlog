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

let rotX = 0;
let rotY = 0;
let renderFrame = null;
let snapFrame = null;

function requestRender(){
  if(renderFrame) return;
  renderFrame = window.requestAnimationFrame(() => {
    renderFrame = null;
    if(!cube) return;
    // Rotation order: rotateX first, then rotateY (matches math above).
    cube.style.transform = `rotateY(${rotY}deg) rotateX(${rotX}deg)`;
    updateTips();
  });
}

function animateTo(targetX, targetY){
  const goalX = normalizeDeg(targetX);
  const goalY = normalizeDeg(targetY);

  if(snapFrame) window.cancelAnimationFrame(snapFrame);

  const step = () => {
    const dx = goalX - rotX;
    const dy = goalY - rotY;

    if(Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5){
      rotX = goalX;
      rotY = goalY;
      requestRender();
      snapFrame = null;
      return;
    }

    rotX += dx * 0.15;
    rotY += dy * 0.15;
    requestRender();
    snapFrame = window.requestAnimationFrame(step);
  };

  snapFrame = window.requestAnimationFrame(step);
}

function snapToNearest(){
  const snappedX = Math.round(rotX / 90) * 90;
  const snappedY = Math.round(rotY / 90) * 90;
  animateTo(snappedX, snappedY);
}

function updateTips(){
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
let startRotX = 0;
let startRotY = 0;

cubeScene?.addEventListener("pointerdown", (event) => {
  if(!canStartDrag(event.target)) return;
  isDragging = true;
  startX = event.clientX;
  startY = event.clientY;
  startRotX = rotX;
  startRotY = rotY;
  cubeScene.setPointerCapture(event.pointerId);
  if(snapFrame) window.cancelAnimationFrame(snapFrame);
});

cubeScene?.addEventListener("pointermove", (event) => {
  if(!isDragging) return;
  const dx = event.clientX - startX;
  const dy = event.clientY - startY;
  rotY = normalizeDeg(startRotY + dx * 0.3);
  rotX = normalizeDeg(startRotX - dy * 0.3);
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
    const baseX = Math.round(rotX / 90) * 90;
    const baseY = Math.round(rotY / 90) * 90;
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
