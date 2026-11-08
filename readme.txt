MEDICARE
========

Local patient-care portal for CST2572 Assessment 1.

What is included
----------------
MediCare is a dependency-free browser application for patient, doctor and
administrator workflows. It uses:

- HTML, CSS and JavaScript ES modules.
- IndexedDB database "carelocal" for local application records.
- Web Crypto API for password hashing and patient-data encryption.
- A service worker for application-shell caching.

All demonstration data is synthetic. Do not use the supplied accounts or this
application for real patient information.

How to run
----------
Requirements: Python 3 and a current browser supporting ES modules, IndexedDB,
Web Crypto and service workers.

1. Open a terminal in this project folder.
2. Run:

       python -m http.server 8000

3. Open http://localhost:8000/index.html.
4. Do not open the HTML files with file://. The application requires HTTP or
   HTTPS for modules and service workers.

No package installation, build step or external data source is required.
Bundled synthetic data is imported automatically on the first authenticated
load.

Demo accounts
-------------
These accounts are for local demonstration only:

Role             Email or username          Password
---------------------------------------------------------------
Patient          patient@example.test       Patient!2026Secure
Doctor           doctor@example.test        Doctor!2026Secure
Administrator    admin@example.test         Admin!2026Secure

The bundled administrator usernames in seed-data.js can also be used with
their corresponding development passwords.

Required features
-----------------
Patient:
- View their own profile, medical notes and medication instructions.
- Request an appointment.
- Request a prescription.
- Track request status.

Doctor:
- View assigned appointment requests.
- Accept or decline requests.
- Review patient history, notes and medicines.
- Add clinical notes and prescriptions.

Administrator:
- Add, update and delete patient records.
- Add, update and delete doctor accounts.
- Review successful sign-in activity.

Database and data model
-----------------------
IndexedDB database "carelocal" contains these object stores:

- users: account identity, role, links to patient or doctor records, consent
  status and salted password hash.
- patients: name, address, telephone, date of birth and NHS number.
- doctors and admins: staff records.
- medicines: medicine reference data.
- appointments: patient ID, doctor ID, scheduled time and status.
- notes: patient ID, doctor ID, clinical text and creation time.
- prescriptions: patient ID, doctor ID, medicine ID, instructions and time.
- prescriptionRequests: patient ID, medicine ID, reason, status and time.
- auditLogs: user ID, role, action, store, record ID and timestamp.

Each record has a string id key. Related records store IDs such as patientId,
doctorId, medicineId and userId. The relationships are shown in
ER-DIAGRAM.md. Seed data is loaded from seed-data.js.

How to test
-----------
Use the running application and synthetic data. To repeat the test from a
clean state, clear the site's IndexedDB, localStorage and sessionStorage in
the browser's developer tools, then reload.

1. Open the landing page. Confirm that Sign in and Create account work.
2. Open registration. Submit an invalid email, weak password, invalid NHS
   number or invalid date of birth. Confirm that validation rejects it.
3. Focus the password field. Confirm that the password requirements appear.
   Use Show password and confirm that both password fields are revealed or
   hidden together.
4. Submit registration without consent. Confirm that it is rejected.
5. Register with valid synthetic data and consent. Confirm that the account
   and patient profile are created.
6. Submit an incorrect login password. Confirm that a generic error appears.
   Sign in with each demo account and confirm that the correct workspace loads.
7. As a patient, create an appointment request and prescription request.
   Confirm that both appear in My requests and that the patient sees only
   their own profile and related records.
8. As a doctor, accept or decline an assigned appointment request and add a
   clinical note or prescription. Confirm that the changes persist.
9. As an administrator, add, update and delete a patient. Add, update and
   delete a doctor. Reload and confirm the changes persist.
10. As an administrator, open Login activity. Confirm that successful
    sign-ins show the account, role and timestamp.
11. Sign out and open dashboard.html directly. Confirm that access is refused
    or redirected to login.
12. Before and after authorized login, inspect Application > IndexedDB >
    carelocal > patients in browser developer tools. Confirm that protected
    patient fields are ciphertext in storage and readable only in the
    authorized application workspace.

Security behaviour
------------------
Passwords are not stored as plaintext. They are salted and hashed with
PBKDF2, SHA-256 and 210,000 iterations. Password verification is separate
from data decryption.

The patient fields name, address, telephone, dateOfBirth and nhsNumber are
encrypted before storage with AES-256-GCM. Each field uses a new random
12-byte initialization vector. The AES-256 data key is generated locally and
retained in localStorage for this demonstration. Authorized workspaces use
the key to recover the fields after authentication.

Role checks run before role-specific workspaces are loaded. Patient records
are additionally filtered by the signed-in patient's patientId. Successful
sign-ins, reads and changes are written to the auditLogs store.

This is a client-side prototype, not production security. A person controlling
the browser can inspect or modify localStorage, IndexedDB and JavaScript.
Production deployment must use trusted server-side authentication and
authorization, protected key management, HTTPS and server-side audit logs.

Relevant files
--------------
- auth.js: login, registration, sessions, role checks and audit events.
- validate.js: email, password, NHS number and date validation.
- crypto.js: PBKDF2, AES-GCM encryption and decryption.
- db.js: IndexedDB database and object-store operations.
- seed-data.js: synthetic development records.
- app.js: authenticated routing and patient workflows.
- admin.js: administrator operations and login activity.
- doctor.js: doctor operations.
- ER-DIAGRAM.md: data model.
