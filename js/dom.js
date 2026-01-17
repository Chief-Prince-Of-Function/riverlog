import { $ } from "./utils.js";

/* =========================
   DOM helpers (exports)
========================= */

// Trips (top section)
export const tripSelect = $("tripSelect");
export const newTripBtn = $("newTripBtn");
export const newTripForm = $("newTripForm");
export const newTripLocation = $("newTripLocation");
export const newTripDate = $("newTripDate");
export const newTripDesc = $("newTripDesc");
export const createTripBtn = $("createTripBtn");
export const cancelTripBtn = $("cancelTripBtn");

// Catch inputs + actions
export const saveCatchBtn = $("saveCatchBtn");
export const gpsBtn = $("gpsBtn");
export const photoInput = $("photoInput");

export const species = $("species");
export const fly = $("fly");
export const length = $("length");
export const notes = $("notes");
export const gpsHint = $("gpsHint");
export const photoHint = $("photoHint");

// Import / Export
export const exportBtn = $("exportBtn");
export const importInput = $("importInput");

// Catches list + meta
export const catchList = $("catchList");
export const emptyState = $("emptyState");
export const catchCount = $("catchCount");
export const tripMeta = $("tripMeta");
export const syncStatus = $("syncStatus");

// Trip recap drawer
export const tripDrawer = $("tripDrawer");
export const editTripBtn = $("editTripBtn");
export const closeTripDrawer = $("closeTripDrawer");
export const saveTripBtn = $("saveTripBtn");
export const tripName = $("tripName");
export const tripDate = $("tripDate");
export const tripLocation = $("tripLocation");
export const tripDesc = $("tripDesc");
export const tripFlyWin = $("tripFlyWin");
export const tripLessons = $("tripLessons");
export const tripRecap = $("tripRecap");

// Collage buttons (drawer + top)
export const collageBtn = $("collageBtn");
export const collageBtnTop = $("collageBtnTop");

// Collage modal bits
export const collageOverlay = $("collageOverlay");
export const collageModal = $("collageModal");
export const collageClose = $("collageClose");
export const collageMeta = $("collageMeta");
export const collagePreview = $("collagePreview");
export const collageDownload = $("collageDownload");
export const collageCanvas = $("collageCanvas");

/* =========================
   Badges UI (optional)
   These are safe even if elements aren't present yet.
========================= */
export const badgeGrid = $("badgeGrid");

// Toast (small pop-up when a badge unlocks)
export const badgeToast = $("badgeToast");
export const badgeToastTitle = $("badgeToastTitle");
export const badgeToastSub = $("badgeToastSub");
export const badgeToastClose = $("badgeToastClose");
