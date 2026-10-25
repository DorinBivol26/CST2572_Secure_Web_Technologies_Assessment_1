# CareLocal Video Demonstration Script

## Recommended length

Aim for approximately 5–7 minutes. Demonstrate the Data, PWA and integration work only.

## Before recording

1. Start the project using VS Code Live Server.
2. Open CareLocal in Google Chrome.
3. Make sure Chrome is online.
4. Open Developer Tools with `Ctrl + Shift + I`.
5. Keep the evidence screenshots available as backup.

## 1. Introduction

Show the CareLocal homepage and say:

> My name is [your name] and my role in this project was Data, PWA and integration lead. My contribution covers the IndexedDB database, JSON data processing, CRUD operations, service-worker caching, offline functionality and the ER diagram.

## 2. Explain the data setup

Show the local data setup message and say:

> This is the CareLocal client-side application running through VS Code Live Server. The application attempts to fetch the doctor, patient, administrator and medicine JSON feeds. During testing, the supplied feeds returned HTTP 404 errors and some requests were affected by cross-origin restrictions. The application therefore uses clearly labelled local seed data so the database and interface can still be demonstrated.

Show:

> 4 feed(s) unavailable; local seed data is active.

Do not describe the fallback records as live server data.

## 3. Show IndexedDB

Open `Application → IndexedDB → carelocal`, expand the database and show:

* `patients`
* `doctors`
* `admins`
* `medicines`
* `appointments`
* `notes`
* `prescriptions`

Say:

> The database is called carelocal and is stored in the browser using IndexedDB. It contains seven object stores. IndexedDB is suitable because it provides persistent structured local storage for this client-side application.

## 4. Show a patient record

Open the `patients` store and show a record.

Say:

> The patients store contains information such as the patient ID, name, address, telephone number, date of birth and NHS number. The records use an ID key path so they can be retrieved and updated consistently.

## 5. Demonstrate CRUD

Open the Admin tab and add a temporary patient:

* Name: `Video Test Patient`
* Address: `10 Test Street`
* Telephone: `07123456789`
* Date of birth: `01/01/1995`
* NHS number: `1234567890`

Save it, edit the address to `20 Updated Street`, save again, then delete the test patient.

Say:

> The Admin view demonstrates the database CRUD operations. I have added, updated and deleted a test patient. These actions use the shared put and remove functions from db.js. The changes can also be confirmed in the patients object store in IndexedDB.

## 6. Demonstrate an appointment

Open the Patient tab and use:

* Patient ID: `p-001`
* Doctor ID: `d-001`

Choose a date and time, save the appointment, and show it in the `appointments` store.

Say:

> The Patient view stores appointments in the appointments object store. The appointment is saved locally and remains available after refreshing the page.

## 7. Demonstrate notes and prescriptions

Open the Doctor tab. Add the note:

> Patient attended routine consultation.

Save it. Add prescription instructions:

> Take one tablet twice daily after food.

Save the prescription and show the `notes` and `prescriptions` stores.

Say:

> The Doctor view stores clinical notes in the notes store and prescriptions in the prescriptions store. These records can be viewed through the interface and inspected directly in IndexedDB.

## 8. Show the service worker and cache

Open `Application → Service Workers`.

Say:

> The service worker caches the application shell so that the static files can be used when the network is unavailable.

Then open `Application → Cache Storage → carelocal-v2`.

Say:

> Cache Storage contains the application files, including the HTML, CSS, JavaScript and database module.

## 9. Demonstrate offline mode

Open the Network tab, change `No throttling` to `Offline`, and refresh the page.

Say:

> I am now switching Chrome to Offline mode. The application shell still loads because it is being served from the service-worker cache. The locally stored IndexedDB records are also available without a network connection.

Show the application still working and show a saved local record if possible.

If a Live Server WebSocket error appears, say:

> This Live Server WebSocket message is expected because live reload requires a network connection. It does not prevent the cached application from working offline.

After recording, change the setting back to `No throttling`.

## 10. Explain the ER diagram

Open `ER-DIAGRAM.md` and say:

> The ER diagram shows the relationships between patients, doctors, medicines, appointments, notes and prescriptions. Patients can have appointments, notes and prescriptions. Doctors are linked to appointments, notes and prescriptions, while medicines are referenced by prescriptions.

## 11. Closing statement

Say:

> My contribution provides the shared data and offline foundation for the rest of the team’s work. The other team members can integrate authentication, permissions, encryption and their interface features using this common database layer. The implementation and testing evidence have been committed to the shared GitHub repository.

## Evidence to show

Include the following where possible:

* CareLocal homepage and fallback-data message
* `carelocal` IndexedDB database
* All seven object stores
* A patient record
* Admin add, update and delete
* An appointment record
* A clinical note
* A prescription
* Active service worker
* Cache Storage
* Application operating offline
* ER diagram

## Accuracy reminders

Do not claim that the remote JSON server worked successfully, that complete authentication or role-based security is included in this contribution, that AES-256 encryption was implemented here, or that you completed the entire project alone.
