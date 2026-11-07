import { clearStores, getAll, importRecords, put } from "./db.js";
import { showAdmin } from "./admin.js?v=20261107-patient-form";
import { showDoctor } from "./doctor.js?v=20261107-record-details";
import { getSession, logout, requireRole, audit } from "./auth.js?v=20261107";
import { decryptStoredFields, encryptStoredFields } from "./crypto.js?v=2";
import { isValidDateOfBirth, isValidNhsNumber, sanitise } from "./validate.js";
import { BUNDLED_DATA } from "./seed-data.js?v=20261107-split-medicines";
import { escapeHtml, formatDateTime } from "./ui.js?v=20261107";

const BUNDLED_DATA_VERSION = "2026-11-07-split-medicines";
const $ = selector => document.querySelector(selector);
const getCurrentPatientId = () => getSession()?.patientId || "p-001";

// Load bundled reference records before rendering the current workspace.
async function loadData() {
  const records = {};
  // Refresh only bundled reference data; keep local patient activity intact.
  const needsBundledImport = localStorage.getItem("medicare.bundledDataVersion") !== BUNDLED_DATA_VERSION;
  if (needsBundledImport) await clearStores(["doctors", "medicines"]);

  // Keep existing patient activity while refreshing demo reference data.
  for (const store of Object.keys(BUNDLED_DATA)) {
    const existing = await getAll(store);
    if (store === "patients") {
      const existingIds = new Set(existing.map(item => item.id));
      const missingPatients = BUNDLED_DATA.patients.filter(patient => !existingIds.has(patient.id));
      if (missingPatients.length > 0) {
        records[store] = await Promise.all(missingPatients.map(patient =>
          encryptStoredFields(patient, ["name", "address", "telephone", "dateOfBirth", "nhsNumber"])
        ));
      }
      const bundledPatients = new Map(BUNDLED_DATA.patients.map(patient => [patient.id, patient]));
      const repairedPatients = [];
      for (const patient of existing) {
        const bundledPatient = bundledPatients.get(patient.id);
        if (!bundledPatient) continue;
        const visiblePatient = await decryptStoredFields(patient, ["name", "address", "telephone", "dateOfBirth", "nhsNumber"]);
        const encryptedFields = ["name", "address", "telephone", "dateOfBirth", "nhsNumber"];
        if (encryptedFields.some(field => visiblePatient[field] === patient[field] && typeof patient[field] === "string" && patient[field].includes("."))) {
          repairedPatients.push(await encryptStoredFields(bundledPatient, encryptedFields));
        }
      }
      if (repairedPatients.length > 0) records[store] = [...(records[store] || []), ...repairedPatients];
    } else if (existing.length === 0 || (needsBundledImport && ["doctors", "medicines"].includes(store))) {
      records[store] = BUNDLED_DATA[store];
    }
  }

  // Write all pending imports together after the migration checks finish.
  if (Object.keys(records).length > 0) {
    await importRecords(records);
  }
  localStorage.setItem("medicare.bundledDataVersion", BUNDLED_DATA_VERSION);
  await renderRole(getSession().role);
}

async function renderRole(role) {
  // Clone only the template that belongs to the authenticated role.
  requireRole(role);
  // Each role gets its own template, so unrelated controls never appear.
  const template = document.getElementById(`${role}-template`);
  $("#workspace").replaceChildren(template.content.cloneNode(true));
  if (role === "patient") {
    $("#workspace-card").classList.remove("card");
    $("#workspace-card").classList.add("patient-dashboard");
    $("#workspace-card > .section-heading").hidden = true;
    setupPatientTabs();
  } else {
    $("#workspace-card").classList.remove("patient-dashboard");
    $("#workspace-card").classList.add("card");
    $("#workspace-card > .section-heading").hidden = false;
  }
  if (role === "patient") await showPatient();
  if (role === "admin") await showAdmin();
  if (role === "doctor") await showDoctor();
  await updateCount();
}

function setupPatientTabs() {
  // Show one patient panel at a time when a tab is selected.
  document.querySelectorAll(".patient-tabs .admin-tab").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".patient-tabs .admin-tab").forEach(item => {
        item.classList.toggle("active", item === button);
      });
      document.querySelectorAll(".patient-panel").forEach(panel => {
        panel.hidden = panel.dataset.patientPanel !== button.dataset.patientSection;
      });
    });
  });
}

async function showPatient() {
  // Build the patient workspace from linked local records.
  const patientId = getCurrentPatientId();
  const [patients, doctors, medicines, appointments, notes, prescriptions, prescriptionRequests] = await Promise.all([
    getAll("patients"),
    getAll("doctors"),
    getAll("medicines"),
    getAll("appointments"),
    getAll("notes"),
    getAll("prescriptions"),
    getAll("prescriptionRequests")
  ]);
  const patientRecord = patients.find(item => item.id === patientId);

  if (!patientRecord) {
    $("#patient-welcome").textContent = "Patient profile not found";
    $("#patient-details").innerHTML = "<p class=\"muted\">No patient is signed in.</p>";
    return;
  }
  const patient = await decryptStoredFields(patientRecord, ["name", "address", "telephone", "dateOfBirth", "nhsNumber"]);
  await audit("read", "patients", patientId);

  function setupCombobox(inputId, listId, hiddenInput, records, getLabel) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    const hidden = document.querySelector(hiddenInput);
    list.replaceChildren(...records.map(record => {
      const option = document.createElement("option");
      option.value = getLabel(record);
      return option;
    }));
    // The visible name is friendly; the hidden value is the database ID.
    input.oninput = () => {
      const selected = records.find(record => getLabel(record) === input.value.trim());
      hidden.value = selected?.id || "";
    };
  }

  $("#patient-welcome").textContent = `Personal information for ${escapeHtml(patient.name)}`;
  $("#patient-details").innerHTML = [
    ["Name", patient.name],
    ["Address", patient.address],
    ["Telephone", patient.telephone],
    ["Date of birth", patient.dateOfBirth],
    ["NHS number", patient.nhsNumber]
  ].map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");

  setupCombobox("patient-doctor", "patient-doctor-options", "#appointment-form input[name='doctorId']", doctors, item => item.name);
  setupCombobox("request-medicine", "request-medicine-options", "#prescription-request-form input[name='medicineId']", medicines, item => item.name);

  // Limit every patient view to records owned by the signed-in patient.
  const patientAppointments = appointments.filter(item => item.patientId === patientId);
  // Summaries stay short while details remain available on demand.
  $("#patient-appointments").innerHTML = patientAppointments.map(item => {
    const doctor = doctors.find(doctorItem => doctorItem.id === item.doctorId);
    return `<details class="list-item record-details"><summary>Appointment with ${escapeHtml(doctor?.name || item.doctorId)}</summary><p><strong>Date and time:</strong> ${escapeHtml(formatDateTime(item.scheduledAt))}</p><small class="muted">Status: ${escapeHtml(item.status || "requested")}</small></details>`;
  }).join("") || "<p class=\"muted\">No appointments saved.</p>";

  const patientPrescriptions = prescriptions.filter(item => item.patientId === patientId);
  $("#patient-medicines").innerHTML = patientPrescriptions.map(item => {
    const medicine = medicines.find(medicineItem => medicineItem.id === item.medicineId);
    const doctor = doctors.find(doctorItem => doctorItem.id === item.doctorId);
    return `<details class="list-item record-details"><summary>${escapeHtml(medicine?.name || item.medicineId)}</summary><p><strong>Instructions:</strong> ${escapeHtml(item.instructions)}</p><small class="muted">By ${escapeHtml(doctor?.name || item.doctorId)} · ${escapeHtml(formatDateTime(item.createdAt))}</small></details>`;
  }).join("") || "<p class=\"muted\">No prescriptions saved.</p>";

  $("#patient-appointment-requests").innerHTML = patientAppointments.map(item => {
    const doctor = doctors.find(doctorItem => doctorItem.id === item.doctorId);
    return `<details class="list-item record-details"><summary>Appointment with ${escapeHtml(doctor?.name || item.doctorId)}</summary><p><strong>Date and time:</strong> ${escapeHtml(formatDateTime(item.scheduledAt))}</p><small class="muted">Status: ${escapeHtml(item.status || "requested")}</small></details>`;
  }).join("") || "<p class=\"muted\">No appointment requests yet.</p>";

  const patientPrescriptionRequests = prescriptionRequests.filter(item => item.patientId === patientId);
  $("#patient-prescription-requests").innerHTML = patientPrescriptionRequests.map(item => {
    const medicine = medicines.find(medicineItem => medicineItem.id === item.medicineId);
    return `<details class="list-item record-details"><summary>Prescription request: ${escapeHtml(medicine?.name || item.medicineId)}</summary><p><strong>Reason:</strong> ${escapeHtml(item.reason)}</p><small class="muted">Status: ${escapeHtml(item.status || "requested")}</small></details>`;
  }).join("") || "<p class=\"muted\">No prescription requests yet.</p>";

  const patientNotes = notes.filter(item => item.patientId === patientId);
  $("#patient-notes").innerHTML = patientNotes.map(item =>
    `<details class="list-item record-details"><summary>Clinical note from ${escapeHtml(doctors.find(doctor => doctor.id === item.doctorId)?.name || item.doctorId)}</summary><p>${escapeHtml(item.text)}</p><small class="muted">Added ${escapeHtml(formatDateTime(item.createdAt))}</small></details>`
  ).join("") || "<p class=\"muted\">No medical notes saved.</p>";

  $("#appointment-form").onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (!data.doctorId) {
      $("#patient-request-message").textContent = "Choose a doctor from the suggestions.";
      return;
    }
    if (new Date(data.scheduledAt) <= new Date()) {
      alert("Please choose a future appointment time.");
      return;
    }

    const appointment = { doctorId: sanitise(data.doctorId, 50), scheduledAt: data.scheduledAt, patientId, status: "requested", id: crypto.randomUUID() };
    await put("appointments", appointment);
    await audit("create", "appointments", appointment.id);
    form.reset();
    await showPatient();
    $("#patient-request-message").textContent = "Appointment request sent successfully. You can track it in My requests.";
  };

  // Assign handlers instead of adding listeners so refreshes cannot duplicate submissions.
  $("#prescription-request-form").onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (!data.medicineId) {
      $("#patient-request-message").textContent = "Choose a medicine from the suggestions.";
      return;
    }
    const reason = sanitise(data.reason, 300);
    if (reason.length < 5) {
      alert("Please provide a little more detail about the request.");
      return;
    }
    const request = {
      ...data,
      reason,
      patientId,
      status: "requested",
      createdAt: new Date().toISOString(),
      id: crypto.randomUUID()
    };
    await put("prescriptionRequests", request);
    await audit("create", "prescriptionRequests", request.id);
    form.reset();
    $("#patient-request-message").textContent = "Prescription request sent successfully. You can track it in My requests.";
  };
}

async function updateCount() {
  // Give staff a quick summary of the records currently stored locally.
  const stores = ["patients", "doctors", "medicines", "appointments", "notes", "prescriptions", "prescriptionRequests"];
  const counts = await Promise.all(stores.map(store => getAll(store).then(items => items.length)));
  $("#record-count").textContent = `${counts.reduce((sum, count) => sum + count, 0)} local records`;
}

if ("serviceWorker" in navigator) {
  // Register the offline worker for the application shell.
  // The versioned URL makes browsers check for a new offline cache.
  navigator.serviceWorker.register("./sw.js?v=20261107-v42").catch(error => console.error(error));
}

const session = getSession();
if (!session) {
  // Unauthenticated visitors must use the sign-in page first.
  window.location.href = "login.html";
} else {
  // Populate shared header details and start the role-specific app.
  document.querySelector(".site-header").hidden = false;
  document.querySelector("main").hidden = false;
  document.getElementById("signed-in-as").textContent = session.role === "admin"
    ? `${session.name} (admin)`
    : session.name;
  document.getElementById("dashboard-welcome").textContent = `Welcome, ${session.name || "there"}`;
  document.getElementById("logout-button").onclick = () => {
    logout();
    window.location.href = "index.html";
  };
  loadData().catch(error => {
    $("#workspace").textContent = `Database error: ${error.message}`;
    console.error(error);
  });
}
window.addEventListener("auth-expired", () => window.location.reload());
