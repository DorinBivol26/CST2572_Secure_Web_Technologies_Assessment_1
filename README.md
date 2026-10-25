# CareLocal

Dependency-free client-side PWA starter for CST2572 Assessment 1.

## Run

Service workers require an HTTP origin. From the project directory run `npx serve .` or use any static web server, then open the supplied local URL in Google Chrome. Do not open `index.html` directly with `file://`.

On first load the app imports the four prescribed JSON feeds into IndexedDB. The current URLs return HTTP 404, so the app visibly falls back to local seed data and remains usable offline. Replace the URLs in `app.js` when working endpoints are supplied.

## Data and offline design

IndexedDB database `carelocal` contains `patients`, `doctors`, `admins`, `medicines`, `appointments`, `notes`, and `prescriptions` object stores. The service worker caches the app shell and runtime assets. The ER diagram is in [ER-DIAGRAM.md](./ER-DIAGRAM.md).

This is a foundation for the team integration. Authentication, AES-256 field encryption, and full role authorization must be added before submission; client-side demo controls alone are not a security boundary.
