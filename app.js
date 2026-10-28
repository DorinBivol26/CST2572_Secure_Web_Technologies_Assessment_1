// Shared application setup by Member 1, with Member 4's pages connected.
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
  medicines: [{ id: "m-001", name: "Amoxicillin", instructions: "Take as directed by your doctor." }, { id: "m-002", name: "Paracetamol", instructions: "Take one tablet when required." }]
};

async function loadData() {
  const records = {};
  let fallbackCount = 0;
  for (const store of Object.keys(FEEDS)) {
    const existing = await getAll(store);
    // Do not replace a patient's edits every time the page is refreshed.
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
  document.getElementById("setup-message").textContent = fallbackCount ?
    "Some JSON feeds are unavailable; example data is being used." :
    "Local data is ready. Existing records have been kept.";
  await renderRole(document.querySelector(".role-tab.active").dataset.role);
}

async function renderRole(role) {
  const template = document.getElementById(role + "-template");
  document.getElementById("workspace").replaceChildren(template.content.cloneNode(true));
  if (role === "patient") await showPatient();
  if (role === "admin") await showAdmin();
  if (role === "doctor") await showDoctor();
  await updateCount();
}

async function showPatient() {
  const medicines = await getAll("medicines");
  const medicineList = document.getElementById("patient-medicines");
  for (const medicine of medicines) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = medicine.name + " - " + medicine.instructions;
    medicineList.appendChild(item);
  }
  const appointments = await getAll("appointments");
  const list = document.getElementById("patient-appointments");
  for (const appointment of appointments) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = appointment.scheduledAt + " with " + appointment.doctorId;
    list.appendChild(item);
  }
  if (appointments.length === 0) list.textContent = "No appointments saved.";
  document.getElementById("appointment-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await put("appointments", { ...data, id: crypto.randomUUID() });
    await renderRole("patient");
  });
}

async function updateCount() {
  const stores = ["patients", "doctors", "medicines", "appointments", "notes", "prescriptions"];
  let total = 0;
  for (const store of stores) total += (await getAll(store)).length;
  document.getElementById("record-count").textContent = total + " local records";
}

document.querySelectorAll(".role-tab").forEach(function (button) {
  button.addEventListener("click", async function () {
    document.querySelectorAll(".role-tab").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    await renderRole(button.dataset.role);
  });
});
document.getElementById("refresh-data").addEventListener("click", loadData);
window.addEventListener("online", updateConnection);
window.addEventListener("offline", updateConnection);
function updateConnection() {
  const status = document.getElementById("connection-status");
  status.textContent = navigator.onLine ? "Online" : "Offline";
  status.classList.toggle("offline", !navigator.onLine);
}
updateConnection();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(error => console.error(error));
}
loadData().catch(function (error) {
  document.getElementById("setup-message").textContent = "Database error: " + error.message;
  console.error(error);
});
