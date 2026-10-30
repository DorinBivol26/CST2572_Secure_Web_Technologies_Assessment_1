# CareLocal

Dependency-free client-side PWA for CST2572 Assessment 1.

## Run

Service workers require an HTTP origin. From the project directory run `npx serve .` or use any static web server, then open the supplied local URL in Google Chrome. Do not open `index.html` directly with `file://`.

On first load the app imports the four prescribed JSON feeds into IndexedDB. If a feed is unavailable, the app visibly falls back to local seed data and remains usable offline.

## Data and offline design

IndexedDB database `carelocal` contains `patients`, `doctors`, `admins`, `medicines`, `appointments`, `notes`, `prescriptions`, and `prescriptionRequests` object stores. The service worker caches the app shell and runtime assets. The ER diagram is in [ER-DIAGRAM.md](./ER-DIAGRAM.md).

## Team contributions

- Member 1: IndexedDB, JSON import, PWA and integration.
- Member 3: front page, shared layout, patient dashboard, appointments and prescription requests.
- Member 4: admin and doctor workspaces.
- Member 2: authentication, validation and encryption (to be integrated).

## Member 3 patient walkthrough

1. Start a local HTTP server from the project directory, for example `python -m http.server 8000`.
2. Open `http://localhost:8000` in Google Chrome.
3. Use the Patient workspace to review the demo profile, choose a doctor, book a future appointment and request a prescription.
4. The patient view filters appointments, notes and prescriptions by the current patient ID.

Authentication, AES-256 field encryption and full role authorization must be integrated before submission; client-side demo controls alone are not a security boundary.
