// Member 4 - Admin functions
// We use the database functions made by Member 1.
import { getAll, put, remove } from "./db.js";

export async function showAdmin() {
  const form = document.getElementById("patient-form");
  const list = document.getElementById("admin-patients");
  const message = document.getElementById("admin-message");

  // Show the patients when the admin page opens.
  await showPatients();

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const patients = await getAll("patients");
    const nhs = data.nhsNumber.trim();

    // Do not allow two different patients to have the same NHS number.
    const duplicate = patients.find(function (patient) {
      return patient.nhsNumber === nhs && patient.id !== data.id;
    });
    if (duplicate) {
      message.textContent = "This NHS number is already registered.";
      return;
    }
    if (data.dateOfBirth > new Date().toISOString().slice(0, 10)) {
      message.textContent = "Date of birth cannot be in the future.";
      return;
    }

    data.name = data.name.trim();
    data.address = data.address.trim();
    data.telephone = data.telephone.trim();
    data.nhsNumber = nhs;
    data.id = data.id || crypto.randomUUID();

    await put("patients", data);
    form.reset();
    message.textContent = "Patient saved successfully.";
    await showPatients();
  });

  document.getElementById("clear-patient").addEventListener("click", function () {
    form.reset();
    message.textContent = "Form cleared.";
  });

  async function showPatients() {
    const patients = await getAll("patients");
    list.replaceChildren();

    if (patients.length === 0) {
      list.textContent = "No patients found.";
      return;
    }

    for (const patient of patients) {
      const item = document.createElement("div");
      item.className = "list-item";

      // textContent is used so patient details are not treated as HTML.
      const title = document.createElement("strong");
      title.textContent = patient.name;
      const details = document.createElement("p");
      details.textContent = patient.address + " | " + patient.telephone +
        " | DOB: " + patient.dateOfBirth + " | NHS: " + patient.nhsNumber;
      const editButton = document.createElement("button");
      editButton.textContent = "Edit";
      editButton.type = "button";
      editButton.addEventListener("click", function () {
        form.elements.id.value = patient.id;
        form.elements.name.value = patient.name;
        form.elements.address.value = patient.address;
        form.elements.telephone.value = patient.telephone;
        form.elements.dateOfBirth.value = patient.dateOfBirth;
        form.elements.nhsNumber.value = patient.nhsNumber;
        message.textContent = "Editing " + patient.name;
        form.scrollIntoView({ behavior: "smooth" });
      });

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Delete";
      deleteButton.type = "button";
      deleteButton.className = "secondary";
      deleteButton.addEventListener("click", async function () {
        // The database plan does not define automatic deletion of medical data.
        const appointments = await getAll("appointments");
        const notes = await getAll("notes");
        const prescriptions = await getAll("prescriptions");
        const hasRecords = appointments.some(x => x.patientId === patient.id) ||
          notes.some(x => x.patientId === patient.id) ||
          prescriptions.some(x => x.patientId === patient.id);
        if (hasRecords) {
          message.textContent = "Cannot delete this patient while medical records or appointments exist.";
          return;
        }
        if (confirm("Delete " + patient.name + "?")) {
          await remove("patients", patient.id);
          form.reset();
          message.textContent = "Patient deleted.";
          await showPatients();
        }
      });

      item.append(title, details, editButton, document.createTextNode(" "), deleteButton);
      list.appendChild(item);
    }
  }
}
