# RiverLog 🎣

**RiverLog** is a fast, offline-first fishing log built for real-world use on the water.
Log trips, track catches, manage your fly boxes, and recap each outing in a clean, mobile-first interface.

> **Status:** ✅ Stable MVP, actively used in the field

---

## ✨ Features

### Trips

* Create and manage fishing trips
* Track location, date, notes, and full trip recap
* Clean, collapsible “Trip” section for quick edits

### Catches

* Log catches to a specific trip
* Store key details (species, length, notes, etc.)
* Attach photos per catch *(if enabled in your build)*

### Quiver (Fly Boxes)

* Organize flies by box
* Track patterns, sizes, and quantities
* Quick use (+ / −) while fishing
* Modal add/edit flow optimized for speed on mobile

### Mobile-First

* Designed to work great on a phone
* App-like layout with stable forms
* No accidental scrolling or layout shifts

### Offline-First

* Works without service (ideal for remote water)
* All data stored locally on the device
* No accounts, logins, or servers required

---

## 🧠 Why RiverLog Exists

Most fishing apps are bloated, slow, or require accounts and constant connectivity.
RiverLog is built to be **quick, simple, and reliable**, so you can log the moment and get back to fishing.

This is a tool for anglers who value:

* Speed over social features
* Ownership of their data
* A calm interface that works in bad conditions

---

## 🚀 Getting Started

### Run locally

1. Clone or download the repository
2. Start a local server (choose one):

**Option A: VS Code Live Server**

* Open the folder in VS Code
* Right-click `index.html` → **Open with Live Server**

**Option B: Python**

```bash
python -m http.server 5500
```

Then open:

```
http://127.0.0.1:5500
```

---

## 💾 Data & Backups

RiverLog stores data locally on your device (offline-first).

✅ Export your data regularly (recommended after trips)
✅ Keep one copy on your computer and one in cloud storage

> Export/Import is your safety rope—use it.

---

## 🧩 Tech Stack

* Vanilla **HTML / CSS / JavaScript**
* Mobile-first responsive layout
* Device-local storage (IndexedDB)
* Optional PWA support (installable app feel)

---

## 🛣️ Roadmap (Parking Lot)

Ideas for future versions (not required for MVP):

* Trip photo collage recap
* Search and filters (species, location, date)
* “Top flies” and usage stats
* Shareable trip summary screen
* Multi-device sync via export/import workflow

---

## 📸 Screenshots

*Add screenshots once you capture a few good field examples.*

```md
![RiverLog Home](./assets/screenshots/home.png)
![Quiver](./assets/screenshots/quiver.png)
```

---

## 🙌 Credits

Built by **Mike Fusco**
Field-tested with priorities: **speed, simplicity, reliability.**

---

## 🧾 License

MIT
