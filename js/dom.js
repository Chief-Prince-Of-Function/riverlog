import { $ } from "./utils.js";

/* =========================
   DOM helpers (exports)
========================= */

/* ===== Collapsible sections ===== */
export const catchesCollapse = $("catchesCollapse");
export const flyBoxCollapse = $("flyBoxCollapse");
export const badgesCollapse = $("badgesCollapse");
export const tripRecapCollapse = $("tripRecapCollapse");

export const catchesSummaryMeta = $("catchesSummaryMeta");

/* ===== Trips (top section) ===== */
export const tripSelect = $("tripSelect");
export const newTripBtn = $("newTripBtn");
export const editTripBtn = $("editTripBtn");
export const deleteTripBtn = $("deleteTripBtn");

/* New Trip Overlay (modal) */
export const tripSheetOverlay = $("tripSheetOverlay");
export const newTripForm = $("newTripForm");

export const newTripName = $("newTripName");         // exists in HTML
export const newTripLocation = $("newTripLocation");
export const newTripDate = $("newTripDate");
export const newTripDesc = $("newTripDesc");

export const createTripBtn = $("createTripBtn");
export const cancelTripBtn = $("cancelTripBtn");

/* ===== Catch inputs + actions ===== */
export const saveCatchBtn = $("saveCatchBtn");
export const gpsBtn = $("gpsBtn");
export const photoInput = $("photoInput");

export const species = $("species");
export const fly = $("fly");
export const length = $("length");
export const notes = $("notes");
export const gpsHint = $("gpsHint");
export const photoHint = $("photoHint");

/* ===== Import / Export / Install ===== */
export const exportBtn = $("exportBtn");
export const importInput = $("importInput");
export const installBtn = $("installBtn");

/* ===== Catches list + meta ===== */
export const catchList = $("catchList");
export const emptyState = $("emptyState");
export const catchCount = $("catchCount");
export const syncStatus = $("syncStatus");

/* ===== Quiver (FlyBox) ===== */
export const flyBoxMeta = $("flyBoxMeta");

export const flyBoxSelect = $("flyBoxSelect");
export const newFlyBoxBtn = $("newFlyBoxBtn");
export const deleteFlyBoxBtn = $("deleteFlyBoxBtn");
export const clearFlyBoxesBtn = $("clearFlyBoxesBtn");

export const flyType = $("flyType");
export const flyPattern = $("flyPattern");
export const flySize = $("flySize");
export const flyQty = $("flyQty");
export const flyColors = $("flyColors");
export const addFlyBtn = $("addFlyBtn");

export const flyList = $("flyList");
export const flyEmpty = $("flyEmpty");

export const flyPhoto = $("flyPhoto");
export const flyPhotoPreview = $("flyPhotoPreview");

/* ===== Badges + Insights ===== */
export const badgeGrid = $("badgeGrid");

export const prTile = $("prTile");
export const prSub = $("prSub");
export const topFlyTile = $("topFlyTile");
export const topFlySub = $("topFlySub");
export const topSpeciesTile = $("topSpeciesTile");
export const topSpeciesSub = $("topSpeciesSub");

/* Toast (badge unlock) */
export const badgeToast = $("badgeToast");
export const badgeToastTitle = $("badgeToastTitle");
export const badgeToastSub = $("badgeToastSub");
export const badgeToastClose = $("badgeToastClose");

/* ===== Trip Recap section (collapsible) ===== */
export const collageBtn = $("collageBtn");

export const saveTripBtn = $("saveTripBtn");
export const tripName = $("tripName");
export const tripDate = $("tripDate");
export const tripLocation = $("tripLocation");
export const tripDesc = $("tripDesc");
export const tripFlyWin = $("tripFlyWin");
export const tripLessons = $("tripLessons");
export const tripRecap = $("tripRecap");

/* ===== Collage modal ===== */
export const collageOverlay = $("collageOverlay");
export const collageModal = $("collageModal");
export const collageClose = $("collageClose");
export const collageMeta = $("collageMeta");
export const collagePreview = $("collagePreview");
export const collageDownload = $("collageDownload");
export const collageShare = $("collageShare");
export const collageCanvas = $("collageCanvas");
