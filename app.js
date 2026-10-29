import { getAll, importRecords, put, remove } from "./db.js";

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
  medicines: [{ id: "m-001", name: "Amoxicillin", instructions: "Take as directed by your doctor." }, { id: "m-002", name: "Paracetamol", instructions: "Take one tablet when required." }]
};

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const getCurrentPatientId = () => sessionStorage.getItem("carelocal.patientId") || "p-001";

async function loadData() {
  const records = {};
  let fallbackCount = 0;
  for (const [store, url] of Object.entries(FEEDS)) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      records[store] = Array.isArray(json) ? json : Object.values(json);
    } catch {
      records[store] = FALLBACK[store];
      fallbackCount += 1;
    }
  }
  await importRecords(records);
  $("#setup-message").textContent = fallbackCount ? `${fallbackCount} feed(s) unavailable; local seed data is active.` : "JSON data imported successfully.";
  await renderRole("patient");
}

async function renderRole(role) {
  const template = document.getElementById(`${role}-template`);
  $("#workspace").replaceChildren(template.content.cloneNode(true));
  if (role === "patient") await renderPatient();
  if (role === "admin") await renderAdmin();
  if (role === "doctor") await renderDoctor();
  await updateCount();
}

async function renderPatient() {
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
    await renderPatient();
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

async function renderAdmin() {
  const list = $("#admin-patients");
  const patients = await getAll("patients");
  list.innerHTML = patients.map(patient => `<div class="list-item"><strong>${escapeHtml(patient.name)}</strong><p>${escapeHtml(patient.address)} · NHS ${escapeHtml(patient.nhsNumber)}</p><button data-edit="${escapeHtml(patient.id)}">Edit</button> <button class="secondary" data-delete="${escapeHtml(patient.id)}">Delete</button></div>`).join("");
  list.querySelectorAll("[data-edit]").forEach(button => button.addEventListener("click", () => {
    const patient = patients.find(item => item.id === button.dataset.edit);
    Object.entries(patient).forEach(([key, value]) => { const input = $(`#patient-form [name="${key}"]`); if (input) input.value = value; });
  }));
  list.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", async () => { await remove("patients", button.dataset.delete); await renderAdmin(); }));
  $("#patient-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    await put("patients", { ...data, id: data.id || crypto.randomUUID() });
    form.reset();
    await renderAdmin();
  });
  $("#clear-patient").addEventListener("click", () => $("#patient-form").reset());
}

async function renderDoctor() {
  const medicines = await getAll("medicines");
  $("#medicine-options").innerHTML = medicines.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
  const notes = await getAll("notes");
  $("#doctor-notes").innerHTML = notes.map(item => `<div class="list-item"><strong>${escapeHtml(item.patientId)}</strong><p>${escapeHtml(item.text)}</p></div>`).join("") || "<p class=\"muted\">No notes saved.</p>";
  $("#note-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    await put("notes", { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
    await renderDoctor();
  });
  $("#prescription-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    await put("prescriptions", { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
    form.reset();
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
window.addEventListener("online", () => $("#connection-status").classList.remove("offline"));
window.addEventListener("offline", () => $("#connection-status").classList.add("offline"));
$("#connection-status").textContent = navigator.onLine ? "Online" : "Offline";
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(error => console.error("Service worker registration failed", error));
loadData().catch(error => { $("#setup-message").textContent = `Database error: ${error.message}`; console.error(error); });
