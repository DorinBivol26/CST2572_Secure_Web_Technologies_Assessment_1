import { getAll, put } from "./db.js";
import { audit, getSession, requireRole } from "./auth.js?v=20261107";
import { decryptStoredFields } from "./crypto.js?v=20261107";
import { sanitise } from "./validate.js";
import { escapeHtml, formatDateTime } from "./ui.js?v=20261107";

export async function showDoctor() {
  // Initialise the doctor workspace and load its searchable records.
  requireRole("doctor");
  const patientSelect = document.getElementById("doctor-patient");
  const medicineSelect = document.getElementById("medicine-options");
  const patientIdInput = document.getElementById("doctor-patient-id");
  const medicineIdInput = document.getElementById("medicine-id");
  const message = document.getElementById("doctor-message");
  const session = getSession();

  const patients = await Promise.all((await getAll("patients")).map(patient =>
    decryptStoredFields(patient, ["name", "address", "telephone", "dateOfBirth", "nhsNumber"])
  ));
  const doctors = await getAll("doctors");
  const medicines = await getAll("medicines");
  const doctorId = session.doctorId || doctors.find(doctor => doctor.name === session.name)?.id;

  // Keep requests and clinical records in separate panels.
  document.querySelectorAll(".doctor-tabs .admin-tab").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".doctor-tabs .admin-tab").forEach(item => item.classList.toggle("active", item === button));
      document.querySelectorAll(".doctor-panel").forEach(panel => {
        panel.hidden = panel.dataset.doctorPanel !== button.dataset.doctorSection;
      });
    });
  });
  await showRequests();

  setupCombobox(patientSelect, "doctor-patient-options", patientIdInput, patients, record => record.name);
  setupCombobox(medicineSelect, "doctor-medicine-options", medicineIdInput, medicines, record => record.name);

  patientSelect.addEventListener("input", showHistory);
  await showHistory();

  // Save a clinical note for the selected patient.
  document.getElementById("note-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!patientIdInput.value || !doctorId) {
      message.textContent = "Choose a patient.";
      return;
    }
    const text = sanitise(document.getElementById("note-text").value, 500);
    if (!text) return;
    const note = {
      id: crypto.randomUUID(),
      patientId: patientIdInput.value,
      doctorId,
      text: text,
      createdAt: new Date().toISOString()
    };
    await put("notes", note);
    await audit("create", "notes", note.id);
    document.getElementById("note-form").reset();
    message.textContent = "Medical note added.";
    await showHistory();
  });

  // Save a treatment linked to the selected patient and medicine.
  document.getElementById("prescription-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!patientIdInput.value || !doctorId || !medicineIdInput.value) {
      message.textContent = "Choose a patient and medicine.";
      return;
    }
    const instructions = sanitise(document.getElementById("medicine-instructions").value, 200);
    if (!instructions) return;
    const prescription = {
      id: crypto.randomUUID(),
      patientId: patientIdInput.value,
      doctorId,
      medicineId: medicineIdInput.value,
      instructions: instructions,
      createdAt: new Date().toISOString()
    };
    await put("prescriptions", prescription);
    await audit("create", "prescriptions", prescription.id);
    document.getElementById("prescription-form").reset();
    message.textContent = "Prescription saved.";
    await showHistory();
  });

  function setupCombobox(input, listId, hiddenInput, records, getLabel) {
    // Show friendly names while keeping database IDs in hidden fields.
    const list = document.getElementById(listId);
    list.replaceChildren(...records.map(record => {
      const option = document.createElement("option");
      option.value = getLabel(record);
      return option;
    }));
    input.addEventListener("input", () => {
      const selected = records.find(record => getLabel(record) === input.value.trim());
      hiddenInput.value = selected?.id || "";
    });
  }

  async function showHistory() {
    // Combine related appointments, notes, and treatments for one patient.
    const historyList = document.getElementById("doctor-history");
    const notesList = document.getElementById("doctor-notes");
    const prescriptionList = document.getElementById("doctor-prescriptions");
    historyList.replaceChildren();
    notesList.replaceChildren();
    prescriptionList.replaceChildren();
    const patientId = patientIdInput.value;
    if (!patientId) {
      historyList.textContent = "Select a patient to view their records.";
      notesList.textContent = "Select a patient.";
      prescriptionList.textContent = "Select a patient.";
      return;
    }

    const appointments = await getAll("appointments");
    await audit("read", "patient-history", patientId);
    const notes = await getAll("notes");
    const prescriptions = await getAll("prescriptions");

    // History is assembled from the linked record stores.
    let historyCount = 0;
    for (const appointment of appointments) {
      if (appointment.patientId === patientId) {
        addDetails(historyList, "Appointment", [
          ["Date and time", formatDateTime(appointment.scheduledAt)],
          ["Doctor", getName(doctors, appointment.doctorId)],
          ["Status", appointment.status || "requested"]
        ]);
        historyCount++;
      }
    }
    for (const note of notes) {
      if (note.patientId === patientId) {
        addDetails(historyList, "Clinical note", [
          ["Note", note.text],
          ["Doctor", getName(doctors, note.doctorId)],
          ["Added", formatDateTime(note.createdAt)]
        ]);
        historyCount++;
        addDetails(notesList, "Clinical note", [
          ["Note", note.text],
          ["Doctor", getName(doctors, note.doctorId)],
          ["Added", formatDateTime(note.createdAt)]
        ]);
      }
    }
    for (const prescription of prescriptions) {
      if (prescription.patientId === patientId) {
        const medicine = getName(medicines, prescription.medicineId);
        addDetails(historyList, "Treatment", [
          ["Medicine", medicine],
          ["Instructions", prescription.instructions],
          ["Doctor", getName(doctors, prescription.doctorId)],
          ["Added", formatDateTime(prescription.createdAt)]
        ]);
        addDetails(prescriptionList, "Treatment", [
          ["Medicine", medicine],
          ["Instructions", prescription.instructions],
          ["Doctor", getName(doctors, prescription.doctorId)],
          ["Added", formatDateTime(prescription.createdAt)]
        ]);
        historyCount++;
      }
    }
    if (historyCount === 0) historyList.textContent = "No medical history saved.";
    if (notesList.children.length === 0) notesList.textContent = "No notes saved.";
    if (prescriptionList.children.length === 0) prescriptionList.textContent = "No prescriptions saved.";
  }

  async function showRequests() {
    // Show only appointments assigned to the signed-in doctor.
    const requestList = document.getElementById("doctor-appointment-requests");
    const appointments = await getAll("appointments");
    const assigned = appointments.filter(appointment => appointment.doctorId === doctorId);
    requestList.replaceChildren();
    for (const appointment of assigned) {
      const patient = patients.find(item => item.id === appointment.patientId);
      const item = document.createElement("div");
      item.className = "list-item record-details";
      item.innerHTML = `<details><summary>${escapeHtml(patient?.name || appointment.patientId)}</summary><p class="appointment-time">${formatDateTime(appointment.scheduledAt)}</p><small class="muted">Status: ${escapeHtml(appointment.status || "requested")}</small></details>`;
      if (!["accepted", "declined"].includes(appointment.status)) {
        const accept = document.createElement("button");
        accept.type = "button";
        accept.textContent = "Accept";
        accept.addEventListener("click", () => updateRequest(appointment, "accepted"));
        const decline = document.createElement("button");
        decline.type = "button";
        decline.className = "secondary";
        decline.textContent = "Decline";
        decline.addEventListener("click", () => updateRequest(appointment, "declined"));
        item.querySelector("details").append(accept, decline);
      }
      requestList.appendChild(item);
    }
    if (assigned.length === 0) requestList.textContent = "No appointment requests for you.";
  }

  async function updateRequest(appointment, status) {
    await put("appointments", { ...appointment, status });
    await audit("update", "appointments", appointment.id);
    await showRequests();
  }

  function getName(records, id) {
    const record = records.find(item => item.id === id);
    return record ? record.name : (id || "Unknown");
  }

  function addItem(list, text) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = text;
    list.appendChild(item);
  }

  function addDetails(list, title, fields) {
    const details = document.createElement("details");
    details.className = "record-details";
    const summary = document.createElement("summary");
    summary.textContent = title;
    details.appendChild(summary);
    for (const [label, value] of fields) {
      const line = document.createElement("p");
      line.innerHTML = `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}`;
      details.appendChild(line);
    }
    list.appendChild(details);
  }
}
