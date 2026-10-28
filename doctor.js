// Member 4 - Doctor functions
import { getAll, put } from "./db.js";

export async function showDoctor() {
  const patientSelect = document.getElementById("doctor-patient");
  const doctorSelect = document.getElementById("doctor-select");
  const medicineSelect = document.getElementById("medicine-options");
  const message = document.getElementById("doctor-message");

  const patients = await getAll("patients");
  const doctors = await getAll("doctors");
  const medicines = await getAll("medicines");

  // Put the existing patients, doctors and medicines in dropdown lists.
  addOptions(patientSelect, patients);
  addOptions(doctorSelect, doctors);
  addOptions(medicineSelect, medicines);

  patientSelect.addEventListener("change", showHistory);
  await showHistory();

  document.getElementById("note-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!patientSelect.value || !doctorSelect.value) {
      message.textContent = "Please select a patient and a doctor.";
      return;
    }
    const text = document.getElementById("note-text").value.trim();
    if (!text) return;
    await put("notes", {
      id: crypto.randomUUID(),
      patientId: patientSelect.value,
      doctorId: doctorSelect.value,
      text: text,
      createdAt: new Date().toISOString()
    });
    document.getElementById("note-form").reset();
    message.textContent = "Medical note added.";
    await showHistory();
  });

  document.getElementById("prescription-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!patientSelect.value || !doctorSelect.value || !medicineSelect.value) {
      message.textContent = "Please select a patient, doctor and medicine.";
      return;
    }
    const instructions = document.getElementById("medicine-instructions").value.trim();
    if (!instructions) return;
    await put("prescriptions", {
      id: crypto.randomUUID(),
      patientId: patientSelect.value,
      doctorId: doctorSelect.value,
      medicineId: medicineSelect.value,
      instructions: instructions,
      createdAt: new Date().toISOString()
    });
    document.getElementById("prescription-form").reset();
    message.textContent = "Prescription saved.";
    await showHistory();
  });

  // This helper makes the select boxes without using complex code.
  function addOptions(select, records) {
    select.replaceChildren();
    const first = document.createElement("option");
    first.value = "";
    first.textContent = "Choose...";
    select.appendChild(first);
    for (const record of records) {
      const option = document.createElement("option");
      option.value = record.id;
      option.textContent = record.name;
      select.appendChild(option);
    }
  }

  async function showHistory() {
    const historyList = document.getElementById("doctor-history");
    const notesList = document.getElementById("doctor-notes");
    const prescriptionList = document.getElementById("doctor-prescriptions");
    historyList.replaceChildren();
    notesList.replaceChildren();
    prescriptionList.replaceChildren();
    const patientId = patientSelect.value;
    if (!patientId) {
      historyList.textContent = "Select a patient to view their records.";
      notesList.textContent = "Select a patient.";
      prescriptionList.textContent = "Select a patient.";
      return;
    }

    const appointments = await getAll("appointments");
    const notes = await getAll("notes");
    const prescriptions = await getAll("prescriptions");

    // The original database has no separate 'history' store.
    // We display appointments, clinical notes and prescriptions as the history.
    let historyCount = 0;
    for (const appointment of appointments) {
      if (appointment.patientId === patientId) {
        addItem(historyList, "Appointment: " + appointment.scheduledAt +
          " | Doctor: " + getName(doctors, appointment.doctorId));
        historyCount++;
      }
    }
    for (const note of notes) {
      if (note.patientId === patientId) {
        addItem(historyList, "Clinical note: " + note.text + " | " + (note.createdAt || "Date unavailable"));
        historyCount++;
        addItem(notesList, note.text + " | " + getName(doctors, note.doctorId) +
          " | " + (note.createdAt || "Date unavailable"));
      }
    }
    for (const prescription of prescriptions) {
      if (prescription.patientId === patientId) {
        const medicine = getName(medicines, prescription.medicineId);
        addItem(historyList, "Treatment: " + medicine + " | " + prescription.instructions);
        addItem(prescriptionList, medicine + " - " + prescription.instructions +
          " | " + getName(doctors, prescription.doctorId));
        historyCount++;
      }
    }
    if (historyCount === 0) historyList.textContent = "No medical history saved.";
    if (notesList.children.length === 0) notesList.textContent = "No notes saved.";
    if (prescriptionList.children.length === 0) prescriptionList.textContent = "No prescriptions saved.";
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
}
