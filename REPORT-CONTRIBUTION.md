# Report contribution: Data, PWA and integration

## Contribution overview

As the Data, PWA and integration lead, I designed and implemented the client-side data layer and offline application foundation. The implementation uses browser IndexedDB rather than relying on a server-side database, because the assessment specifies a client-side application that should work in Google Chrome and continue to provide access to locally stored records when the device is offline. I also produced the entity-relationship model, connected the data layer to the demonstration role views, and documented how the remaining team features can integrate with the shared stores.

## IndexedDB design

The database is named `carelocal` and is created by `db.js`. Its version is currently 1 and it contains seven object stores: `patients`, `doctors`, `admins`, `medicines`, `appointments`, `notes`, and `prescriptions`. Each store uses an `id` key path so records can be inserted or replaced consistently.

The patient store contains identity and contact information, including name, address, telephone number, date of birth and NHS number. The doctor, admin and medicine stores contain the reference data imported from JSON. Appointments connect a patient and doctor through their identifiers and store the scheduled date and time. Notes connect clinical information to a patient, while prescriptions connect a patient, doctor and medicine with instructions and a creation timestamp.

The database module provides reusable asynchronous functions for opening the database, reading all records, inserting or updating records, deleting records, and importing groups of records in a single read/write transaction. This allows the patient, admin and doctor interfaces to use one shared data layer rather than maintaining separate in-memory collections. It also means that records remain available after a page refresh.

## JSON processing

The application attempts to fetch the four assessment data feeds for doctors, people/patients, administrators and medicines. Each response is converted into an array and passed to the IndexedDB import function. The import process therefore separates data acquisition from storage and makes the data available to all application views.

During testing, all four supplied URLs returned HTTP 404 responses and the browser also reported cross-origin restrictions for some requests. To keep the application demonstrable, the implementation uses clearly labelled local seed records when a feed cannot be retrieved. The interface reports that the feeds are unavailable and that local seed data is active; it does not silently present the fallback as live server data. When working feed URLs are supplied, the URLs in `app.js` can be replaced and the same import path will store the retrieved records.

## CRUD and integration behaviour

The Admin demonstration view supports adding, editing and deleting patient records. These operations use the shared `put` and `remove` database functions. The Patient view stores appointments, while the Doctor view stores clinical notes and prescriptions. The records can be inspected in Chrome DevTools under Application, IndexedDB and the `carelocal` database.

The demonstration views are intended to prove that the data layer works and to provide integration points for the team’s final authentication and role-specific interfaces. They are not a claim that the data layer alone provides secure authorization. Authentication, authorization, password protection and encryption must be integrated by the team before final submission.

## PWA and offline design

The application includes a web app manifest defining its name, start URL, display mode, background colour and theme colour. The service worker in `sw.js` precaches the application shell, including the HTML, CSS, JavaScript, database module and manifest. It also caches successful runtime GET requests and falls back to the cached application shell when a network request fails.

The interface displays the current online/offline state. During testing, Chrome DevTools was switched to Offline mode and the application shell continued to load from the service worker cache. IndexedDB provides the separate persistent storage layer for records, so previously imported or user-created records can be read without a network connection. The cache version was increased to `carelocal-v2` after the service-worker files were updated, ensuring that Chrome installs the corrected application shell.

## ER diagram

The ER diagram in `ER-DIAGRAM.md` documents the relationships between patients, doctors, medicines, appointments, notes and prescriptions. A patient can have multiple appointments, notes and prescriptions. Doctors can attend appointments, write notes and issue prescriptions. Medicines can be referenced by multiple prescriptions. Administrators are represented as a separate reference entity because they manage patient information rather than participating in clinical relationships.

## Verification

I tested the application through VS Code Live Server in Google Chrome. The tests confirmed that:

* the `carelocal` IndexedDB database is created;
* all seven object stores are present;
* fallback patient, doctor, administrator and medicine records are imported;
* patient records can be added, edited and deleted;
* appointments are stored;
* clinical notes and prescriptions are stored;
* the service worker is registered;
* application assets are placed in Cache Storage; and
* the application shell remains available when Chrome is placed in Offline mode.

The JSON endpoint failure is an external limitation and should be reported transparently in the final submission. The fallback data makes local testing possible, but it should not be described as successful retrieval from the assessment server.

## Files delivered

The implementation is contained in `db.js`, `app.js`, `sw.js`, `manifest.json`, `index.html`, `styles.css`, `ER-DIAGRAM.md` and `README.md`. These files were committed to the shared `main` branch so that other team members can integrate their authentication, permissions, encryption and final interface work.
