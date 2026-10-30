// Shared application setup by Member 1, with patient, admin and doctor pages connected.
import { getAll, importRecords, put } from "./db.js";
import { showAdmin } from "./admin.js";
import { showDoctor } from "./doctor.js";

const FEEDS = {
  doctors: "https://simulacra.uk/CST2572/doctor.json",
  patients: "https://simulacra.uk/CST2572/people.json",
  admins: "https://simulacra.uk/CST2572/admin.json",
  medicines: "https://simulacra.uk/CST2572/medicine.json"
};

const FALLBACK = {
  doctors: [{ id: "d-001", name: "Dr. Aisha Khan", email: "doctor@example.test" }],
  patients: [{ id: "p-001", name: "Alex Morgan", address: "1 Example Street", telephone: "07123456789", dateOfBirth: "1990-01-01", nhsNumber: "1234567890" }],
  admins: [{ id: "a-001", name: "Practice administrator", email: "admin@example.test" }],
  medicines: [
    { id: "m-001", name: "Amoxicillin", instructions: "Take as directed by your doctor." },
    { id: "m-002", name: "Paracetamol", instructions: "Take one tablet when required." }
  ]
};

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[char]));
const getCurrentPatientId = () => sessionStorage.getItem("carelocal.patientId") || "p-001";

async function loadData() {
  const records = {};
  let fallbackCount = 0;

  for (const store of Object.keys(FEEDS)) {
    const existing = await getAll(store);
    if (existing.length > 0) continue;

    try {
      const response = await fetch(FEEDS[store]);
      if (!response.ok) throw new Error("JSON not available");
      const json = await response.json();
      records[store] = Array.isArray(json) ? json : Object.values(json);
    } catch (error) {
      records[store] = FALLBACK[store];
      fallbackCount++;
    }
  }

  if (Object.keys(records).length > 0) await importRecords(records);
  $("#setup-message").textContent = fallbackCount
    ? "Some JSON feeds are unavailable; example data is being used."
    : "Local data is ready. Existing records have been kept.";
  await renderRole(document.querySelector(".role-tab.active").dataset.role);
}

async function renderRole(role) {
  const template = document.getElementById(`${role}-template`);
  $("#workspace").replaceChildren(template.content.cloneNode(true));
  if (role === "patient") await showPatient();
  if (role === "admin") await showAdmin();
  if (role === "doctor") await showDoctor();
  await updateCount();
}

async function showPatient() {
  const patientId = getCurrentPatientId();
  const [patients, doctors, medicines, appointments, notes, prescriptions] = await Promise.all([
    getAll("patients"),
    getAll("doctors"),
    getAll("medicines"),
    getAll("appointments"),
    getAll("notes"),
    getAll("prescriptions")
  ]);
  const patient = patients.find(item => item.id === patientId);

  if (!patient) {
    $("#patient-welcome").textContent = "Patient profile not found";
    $("#patient-details").innerHTML = "<p class=\"muted\">No patient is signed in.</p>";
    return;
  }

  $("#patient-welcome").textContent = `Welcome, ${escapeHtml(patient.name)}`;
  $("#patient-details").innerHTML = [
    ["Name", patient.name],
    ["Address", patient.address],
    ["Telephone", patient.telephone],
    ["Date of birth", patient.dateOfBirth],
    ["NHS number", patient.nhsNumber]
  ].map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");

  $("#patient-doctor").innerHTML = doctors.map(item =>
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
  ).join("");
  $("#request-medicine").innerHTML = medicines.map(item =>
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
  ).join("");

  const patientAppointments = appointments.filter(item => item.patientId === patientId);
  $("#patient-appointments").innerHTML = patientAppointments.map(item => {
    const doctor = doctors.find(doctorItem => doctorItem.id === item.doctorId);
    return `<div class="list-item"><strong>${escapeHtml(doctor?.name || item.doctorId)}</strong><p>${escapeHtml(item.scheduledAt)}</p></div>`;
  }).join("") || "<p class=\"muted\">No appointments saved.</p>";

  const patientPrescriptions = prescriptions.filter(item => item.patientId === patientId);
  $("#patient-medicines").innerHTML = patientPrescriptions.map(item => {
    const medicine = medicines.find(medicineItem => medicineItem.id === item.medicineId);
    return `<div class="list-item"><strong>${escapeHtml(medicine?.name || item.medicineId)}</strong><p>${escapeHtml(item.instructions)}</p></div>`;
  }).join("") || "<p class=\"muted\">No prescriptions saved.</p>";

  const patientNotes = notes.filter(item => item.patientId === patientId);
  $("#patient-notes").innerHTML = patientNotes.map(item =>
    `<div class="list-item"><p>${escapeHtml(item.text)}</p><small class="muted">${escapeHtml(item.createdAt)}</small></div>`
  ).join("") || "<p class=\"muted\">No medical notes saved.</p>";

  $("#appointment-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (new Date(data.scheduledAt) <= new Date()) {
      alert("Please choose a future appointment time.");
      return;
    }
    await put("appointments", { ...data, patientId, id: crypto.randomUUID() });
    form.reset();
    await showPatient();
  });

  $("#prescription-request-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const reason = data.reason.trim();
    if (reason.length < 5) {
      alert("Please provide a little more detail about the request.");
      return;
    }
    await put("prescriptionRequests", {
      ...data,
      reason,
      patientId,
      status: "requested",
      createdAt: new Date().toISOString(),
      id: crypto.randomUUID()
    });
    form.reset();
    alert("Prescription request sent.");
  });
}

async function updateCount() {
  const stores = ["patients", "doctors", "medicines", "appointments", "notes", "prescriptions", "prescriptionRequests"];
  const counts = await Promise.all(stores.map(store => getAll(store).then(items => items.length)));
  $("#record-count").textContent = `${counts.reduce((sum, count) => sum + count, 0)} local records`;
}

document.querySelectorAll(".role-tab").forEach(button => button.addEventListener("click", async () => {
  document.querySelectorAll(".role-tab").forEach(item => item.classList.remove("active"));
  button.classList.add("active");
  await renderRole(button.dataset.role);
}));

$("#refresh-data").addEventListener("click", loadData);

function updateConnection() {
  const status = $("#connection-status");
  status.textContent = navigator.onLine ? "Online" : "Offline";
  status.classList.toggle("offline", !navigator.onLine);
}

window.addEventListener("online", updateConnection);
window.addEventListener("offline", updateConnection);
updateConnection();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(error => console.error(error));
}

loadData().catch(error => {
  $("#setup-message").textContent = `Database error: ${error.message}`;
  console.error(error);
});
