# MediCare

<!-- This file documents the current user flows and local data design. -->

Dependency-free client-side PWA for CST2572 Assessment 1.

## Run

Service workers require an HTTP origin. From the project directory run `npx serve .` or use any static web server, then open the supplied local URL in Google Chrome. Do not open `index.html` directly with `file://`.

Open `index.html` for the public MediCare landing page. Patients can use `register.html` to create an account, then use `login.html` to sign in. The authenticated application is in `dashboard.html`; users who are not signed in are redirected to the login page.

On first authenticated load the app imports the supplied patient, medicine and administrator data from `seed-data.js` into IndexedDB automatically. Patients do not need to press an import button. The manual import control is available only to administrators. The data is bundled with the app, so the JSON source files are not needed at runtime and the app remains usable offline.

Doctor and medicine selectors include text search with browser suggestions. Comma-separated medicine source values are split into individual options before import. Administrators can search patients and doctors by name, then edit or delete matching records.

Administrators can add, edit and delete patient records. They can also create doctor accounts, update doctor details, change a doctor's password, or delete a doctor account. New patients are signed in automatically after registration and taken directly to their patient workspace.

The admin workspace is divided into Patient management, Doctor management and Login activity sections. Patient management lists patients and provides an **Add a new patient** button. Doctor management lists all doctors and provides an **Add a new doctor** button. These buttons open focused vertical forms containing only the required details and save action. Password and confirmation fields include show/hide controls. Login activity records successful sign-ins with the account name, role and timestamp in the local `auditLogs` store.

The patient workspace uses the same tabbed navigation style as the admin workspace. Patient tabs separate personal information, care requests, appointments, medicines, request history and medical notes, so only the selected panel is displayed at a time.

Privacy consent is collected during patient registration rather than on every sign-in. The sign-in page only asks for account credentials and displays the privacy notice for reference.

After an appointment or prescription request is saved, the patient sees an immediate confirmation message and is directed to the **My requests** tab to track its status.

Patient and doctor records use searchable selections: type into the single patient, doctor or medicine field and choose a matching suggestion. Separate search boxes are not required.

Doctor workspaces include a **My requests** tab that shows only appointment requests assigned to the signed-in doctor. Patient records remain in a separate tab.

Doctors can accept or decline their assigned appointment requests. Clinical notes and treatments shown to patients include the responsible doctor's name and the date and time they were added.

Appointments, clinical notes, treatments and request records use expandable detail cards. Patients, doctors and administrators see concise summaries first and can open a card to review the full date, time, status and record details.

## Data and offline design

IndexedDB database `carelocal` contains `patients`, `doctors`, `admins`, `medicines`, `appointments`, `notes`, `prescriptions`, and `prescriptionRequests` object stores. The service worker caches the MediCare app shell and runtime assets. The ER diagram is in [ER-DIAGRAM.md](./ER-DIAGRAM.md).

## Team contributions

- Member 1: IndexedDB, JSON import, PWA and integration.
- Member 3: front page, shared layout, patient dashboard, appointments and prescription requests.
- Member 4: admin and doctor workspaces.
- Member 2: authentication, validation, encryption, consent and audit logging.

## Patient registration

Self-registration is limited to patients. Doctors and administrators must be provisioned by the practice. New patient passwords are salted and hashed, and the patient profile fields are encrypted before they are stored in IndexedDB.

## Member 3 patient walkthrough

1. Start a local HTTP server from the project directory, for example `python -m http.server 8000`.
2. Open `http://localhost:8000` in Google Chrome.
3. Use the Patient workspace to review the demo profile, choose a doctor, book a future appointment and request a prescription.
4. The patient view filters appointments, notes and prescriptions by the current patient ID.

## Security lead notes

Demo passwords are `Patient!2026Secure`, `Doctor!2026Secure` and `Admin!2026Secure`. Passwords are salted and hashed with PBKDF2; sensitive patient fields are encrypted with AES-256-GCM before storage. A random local AES-256 data key is generated once and retained in local storage so authorised patient, doctor and administrator workspaces can decrypt the shared patient records. This is not equivalent to server-side key management: a user who controls the browser can inspect local storage and alter client-side code. A production system must move authentication, authorization, key storage and audit logs to a trusted server.

The app collects only the patient details needed for appointments and care records. Registration records consent, while changes and access are recorded in the local audit log.
