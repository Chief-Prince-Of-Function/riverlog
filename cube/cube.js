import { initTrips } from "../js/trips.js";
import { initCatches } from "../js/catches.js";
import { initCollage } from "../js/collage.js";
import { initBadges } from "../js/badges.js";
import { initFlyBox } from "../js/ui/flybox.js";
import { initPhotoViewer } from "../js/photo-viewer.js";
import { initTheme } from "../js/theme.js";
import { initIO } from "../js/io.js";

const cube = document.getElementById("cube");
const cubeScene = document.getElementById("cubeScene");
const statusEl = document.getElementById("syncStatus");
const offlineBadge = document.getElementById("offlineBadge");
const lastSavedEl = document.getElementById("lastSaved");
const toastStack = document.getElementById("toastStack");
const cubeTripMeta = document.getElementById("cubeTripMeta");
const cubeTripMetaHeader = document.getElementById("cubeTripMetaHeader");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  up: { rotY: 120 },
  down: { rotY: -120 }
};

function setStatus(msg){
  if(statusEl) statusEl.textContent = msg;
}

function normalizeDeg(deg){
  let value = deg % 360;
  if(value < 0) value += 360;
  return value;
}

function normalizeSignedDeg(deg){
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
    const distance = Math.abs(normalizeSignedDeg(normalized - face.angle));
    if(distance < bestDistance){
      bestDistance = distance;
      best = face;
    }
  }
  return best.label;
}

function getVisibleFrontFace(rotY){
  return getFrontFace(-rotY);
}

const baseRotX = 0;
const baseRotY = 0;
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
    updateActiveMode(rotY);
    updateCompass(rotY);
  });
}

function animateTo(targetSpinY){
  if(snapFrame) window.cancelAnimationFrame(snapFrame);

  if(prefersReducedMotion){
    spinY = targetSpinY;
    requestRender();
    snapFrame = null;
    return;
  }

  const startY = spinY;
  const delta = targetSpinY - startY;
  const duration = 520;
  const startTime = performance.now();

  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const step = (now) => {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    spinY = startY + delta * easeOut(t);
    requestRender();
    if(t < 1){
      snapFrame = window.requestAnimationFrame(step);
    }else{
      snapFrame = null;
    }
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
    const next = getVisibleFrontFace(rotY + delta.rotY);
    tip.textContent = `Next: ${next}`;
  }
}

function updateActiveMode(rotY){
  const active = getVisibleFrontFace(rotY);
  for(const button of document.querySelectorAll(".mode-btn")){
    const isActive = button.dataset.face === active;
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function updateCompass(rotY){
  const active = getVisibleFrontFace(rotY);
  for(const dot of document.querySelectorAll(".cube-compass-dot")){
    dot.classList.toggle("is-active", dot.dataset.face === active);
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
  spinY = startSpinY + dx * 0.3;
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

for(const button of document.querySelectorAll(".mode-btn")){
  button.addEventListener("click", () => {
    const target = faceRing.find((face) => face.label === button.dataset.face);
    if(!target) return;
    animateTo(-target.angle);
  });
}

const quickActions = {
  "new-trip": () => {
    document.getElementById("openTripModalBtn")?.click();
    window.setTimeout(() => document.getElementById("newTripBtn")?.click(), 0);
  },
  "log-catch": () => document.getElementById("openLogCatchModalBtn")?.click()
};

for(const button of document.querySelectorAll("[data-quick-action]")){
  button.addEventListener("click", () => {
    const action = quickActions[button.dataset.quickAction];
    action?.();
  });
}

function updateOnlineBadge(){
  if(!offlineBadge) return;
  const online = navigator.onLine;
  offlineBadge.textContent = online ? "Online" : "Offline";
  offlineBadge.dataset.state = online ? "online" : "offline";
}

function updateLastSaved(){
  if(!lastSavedEl) return;
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  lastSavedEl.textContent = `Last saved: ${time}`;
}

function showToast({ title, message, tone = "default" }){
  if(!toastStack) return;
  const toast = document.createElement("div");
  toast.className = "toast-item";
  toast.dataset.tone = tone;
  toast.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
  toastStack.appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(6px)";
    window.setTimeout(() => toast.remove(), 200);
  }, 3200);
}

const toastActions = [
  { selector: "#saveCatchBtn", title: "Saved", message: "Catch logged." },
  { selector: "#createTripBtn", title: "Saved", message: "Trip created." },
  { selector: "#deleteTripBtn", title: "Deleted", message: "Trip removed.", tone: "danger" },
  { selector: "#addFlyBtn", title: "Saved", message: "Fly added." },
  { selector: "#exportBtn", title: "Exported", message: "Data export ready." },
  { selector: "#collageDownload", title: "Exported", message: "Collage downloaded." }
];

for(const action of toastActions){
  const el = document.querySelector(action.selector);
  el?.addEventListener("click", () => {
    showToast(action);
    if(action.title === "Saved" || action.title === "Deleted"){
      updateLastSaved();
    }
  });
}

document.getElementById("importInput")?.addEventListener("change", () => {
  showToast({ title: "Imported", message: "Data import queued." });
});

document.getElementById("collageShare")?.addEventListener("click", () => {
  showToast({ title: "Share", message: "Share sheet opened." });
});

if(cubeTripMeta && cubeTripMetaHeader){
  cubeTripMetaHeader.textContent = cubeTripMeta.textContent;
  const observer = new MutationObserver(() => {
    cubeTripMetaHeader.textContent = cubeTripMeta.textContent;
  });
  observer.observe(cubeTripMeta, { childList: true, subtree: true });
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
    initIO({ refreshTrips, setStatus });

    await refreshTrips();

    initCollage({ setStatus });

    try{
      await evaluateBadges();
    }catch(_){
      // ignore badge boot errors
    }

    updateOnlineBadge();
    setStatus("Ready (offline-first)." + (navigator.onLine ? " Online." : " Offline."));
  }catch(e){
    setStatus(`Boot error: ${e?.message || e}`);
    showToast({ title: "Error", message: "Boot failed. Check console.", tone: "danger" });
    console.error(e);
  }
})();

window.addEventListener("online", () => {
  updateOnlineBadge();
  setStatus("Online.");
  showToast({ title: "Online", message: "Connection restored." });
});
window.addEventListener("offline", () => {
  updateOnlineBadge();
  setStatus("Offline.");
  showToast({ title: "Offline", message: "Working locally." });
});

requestRender();

const modalConfigs = [
  { triggerId: "openTripModalBtn", modalId: "tripModal", overlayId: "tripModalOverlay" },
  { triggerId: "openLogCatchModalBtn", modalId: "logCatchModal", overlayId: "logCatchModalOverlay" },
  { triggerId: "openLogCatchEmblemBtn", modalId: "logCatchModal", overlayId: "logCatchModalOverlay" },
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
    document.body.classList.add("modalOpen");
    for(const details of modal.querySelectorAll("details.collapse")){
      details.open = true;
    }
  };

  const close = () => {
    modal.classList.add("hidden");
    overlay.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modalOpen");
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
