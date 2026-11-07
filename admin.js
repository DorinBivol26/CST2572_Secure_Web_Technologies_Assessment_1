import { getAll, put, remove } from "./db.js";
import { audit, requireRole } from "./auth.js?v=20261107";
import { encryptStoredFields, decryptStoredFields, hashPassword } from "./crypto.js?v=20261107";
import { getPasswordValidationError, isValidDateOfBirth, isValidEmail, isValidNhsNumber, sanitise } from "./validate.js";

export async function showAdmin() {
  requireRole("admin");
  const form = document.getElementById("patient-form");
  const list = document.getElementById("admin-patients");
  const message = document.getElementById("admin-message");
  const patientListView = document.getElementById("patient-list-view");
  const patientFormHeading = document.getElementById("patient-form-heading");
  const addPatient = document.getElementById("add-patient");
  const doctorForm = document.getElementById("doctor-form");
  const doctorMessage = document.getElementById("doctor-message");
  const doctorList = document.getElementById("admin-doctors");
  const patientSearch = document.getElementById("admin-patient-search");
  const doctorSearch = document.getElementById("admin-doctor-search");
  const addDoctor = document.getElementById("add-doctor");
  const doctorListView = document.getElementById("doctor-list-view");
  const doctorFormHeading = document.getElementById("doctor-form-heading");
  const doctorPassword = document.getElementById("doctor-password");
  const doctorConfirmPassword = document.getElementById("doctor-confirm-password");
  const doctorShowPassword = document.getElementById("doctor-show-password");
  const activityList = document.getElementById("admin-login-activity");

  doctorForm.hidden = true;
  doctorListView.hidden = false;
  form.hidden = true;
  patientListView.hidden = false;

  doctorShowPassword.addEventListener("click", () => {
    const visible = doctorPassword.type === "text";
    doctorPassword.type = visible ? "password" : "text";
    doctorConfirmPassword.type = visible ? "password" : "text";
    doctorShowPassword.textContent = visible ? "Show password" : "Hide password";
  });

  document.querySelectorAll(".admin-tab").forEach(button => {
    button.addEventListener("click", async () => {
      document.querySelectorAll(".admin-tab").forEach(item => item.classList.toggle("active", item === button));
      document.querySelectorAll(".admin-panel").forEach(panel => {
        panel.hidden = panel.dataset.adminPanel !== button.dataset.adminSection;
      });
      if (button.dataset.adminSection === "doctors") {
        doctorForm.reset();
        doctorForm.hidden = true;
        doctorListView.hidden = false;
        doctorMessage.textContent = "";
      }
      if (button.dataset.adminSection === "patients") {
        form.reset();
        form.hidden = true;
        patientListView.hidden = false;
        message.textContent = "";
      }
      if (button.dataset.adminSection === "activity") await showLoginActivity();
    });
  });

  // Show the patients when the admin page opens.
  await showPatients();
  await showDoctors();

  doctorForm.addEventListener("submit", async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(doctorForm));
    const doctorId = data.id || crypto.randomUUID();
    const name = sanitise(data.name, 80);
    const email = sanitise(data.email, 120).toLowerCase();
    const specialty = sanitise(data.specialty, 80);
    if (!name || !specialty || !isValidEmail(email)) {
      doctorMessage.textContent = "Enter a valid doctor name, email and specialty.";
      return;
    }
    if (!data.id && !data.password) {
      doctorMessage.textContent = "Enter a password for the new doctor.";
      return;
    }
    const passwordError = data.password ? getPasswordValidationError(data.password) : "";
    if (passwordError) {
      doctorMessage.textContent = passwordError;
      return;
    }
    if (data.password && data.password !== data.confirmPassword) {
      doctorMessage.textContent = "Passwords do not match.";
      return;
    }
    const users = await getAll("users");
    if (users.some(user => user.email === email && user.doctorId !== doctorId)) {
      doctorMessage.textContent = "An account already exists for this email.";
      return;
    }
    await put("doctors", { id: doctorId, name, email, specialty });
    const existingUser = users.find(user => user.doctorId === doctorId || user.email === email);
    if (data.id && !existingUser && !data.password) {
      doctorMessage.textContent = "Enter a password to create this doctor's login.";
      return;
    }
    const user = {
      ...(existingUser || { id: `u-${doctorId}`, role: "doctor" }),
      name, email, doctorId
    };
    if (data.password) user.password = await hashPassword(data.password);
    await put("users", user);
    await audit(data.id ? "update" : "create", "doctors", doctorId);
    doctorForm.reset();
    doctorPassword.type = "password";
    doctorConfirmPassword.type = "password";
    doctorShowPassword.textContent = "Show password";
    doctorForm.hidden = true;
    doctorListView.hidden = false;
    doctorMessage.textContent = data.id ? "Doctor updated successfully." : "Doctor added successfully.";
    await showDoctors();
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const patients = await Promise.all((await getAll("patients")).map(patient =>
      decryptStoredFields(patient, ["name", "address", "telephone", "dateOfBirth", "nhsNumber"])
    ));
    const nhs = sanitise(data.nhsNumber, 10);

    // Do not allow two different patients to have the same NHS number.
    const duplicate = patients.find(function (patient) {
      return patient.nhsNumber === nhs && patient.id !== data.id;
    });
    if (duplicate) {
      message.textContent = "This NHS number is already registered.";
      return;
    }
    if (!isValidNhsNumber(nhs) || !isValidDateOfBirth(data.dateOfBirth)) {
      message.textContent = "Enter a valid NHS number and date of birth.";
      return;
    }
    if (!data.name.trim() || !data.address.trim() || !data.telephone.trim()) {
      message.textContent = "Complete all patient fields.";
      return;
    }
    if (data.dateOfBirth > new Date().toISOString().slice(0, 10)) {
      message.textContent = "Date of birth cannot be in the future.";
      return;
    }

    data.name = sanitise(data.name, 80);
    data.address = sanitise(data.address, 160);
    data.telephone = sanitise(data.telephone, 20);
    data.nhsNumber = nhs;
    const patientId = data.id || crypto.randomUUID();
    const action = data.id ? "update" : "create";
    data.id = patientId;

    const protectedData = await encryptStoredFields(data, ["name", "address", "telephone", "dateOfBirth", "nhsNumber"]);
    await put("patients", protectedData);
    await audit(action, "patients", data.id);
    form.reset();
    form.hidden = true;
    patientListView.hidden = false;
    message.textContent = "Patient saved successfully.";
    await showPatients();
  });

  addPatient.addEventListener("click", function () {
    form.reset();
    patientFormHeading.textContent = "Add a new patient";
    patientListView.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
    message.textContent = "";
  });
  addDoctor.addEventListener("click", () => {
    doctorForm.reset();
    doctorFormHeading.textContent = "Add a new doctor";
    doctorForm.elements.password.removeAttribute("required");
    doctorListView.hidden = true;
    doctorForm.hidden = false;
    doctorForm.elements.name.focus();
    doctorMessage.textContent = "";
  });
  patientSearch.addEventListener("input", showPatients);
  doctorSearch.addEventListener("input", showDoctors);

  async function showPatients() {
    const patients = await getAll("patients");
    list.replaceChildren();

    if (patients.length === 0) {
      list.textContent = "No patients found.";
      return;
    }

    const query = patientSearch.value.trim().toLowerCase();
    const visiblePatients = [];
    for (const patient of patients) {
      const visiblePatient = await decryptStoredFields(patient, ["name", "address", "telephone", "dateOfBirth", "nhsNumber"]);
      if (visiblePatient.name.toLowerCase().includes(query)) visiblePatients.push({ patient, visiblePatient });
    }
    const suggestions = document.getElementById("admin-patient-suggestions");
    suggestions.replaceChildren(...visiblePatients.map(({ visiblePatient }) => {
      const option = document.createElement("option");
      option.value = visiblePatient.name || "";
      return option;
    }));
    for (const { patient, visiblePatient } of visiblePatients) {
      const item = document.createElement("div");
      item.className = "list-item";

      // textContent is used so patient details are not treated as HTML.
      const title = document.createElement("strong");
      title.textContent = visiblePatient.name;
      const details = document.createElement("p");
      details.textContent = `${visiblePatient.address} · ${visiblePatient.telephone}`;
      const identity = document.createElement("small");
      identity.className = "muted";
      identity.textContent = `Date of birth: ${visiblePatient.dateOfBirth} · NHS number: ${visiblePatient.nhsNumber}`;
      const editButton = document.createElement("button");
      editButton.textContent = "Edit";
      editButton.type = "button";
      editButton.addEventListener("click", function () {
        form.elements.id.value = patient.id;
        form.elements.name.value = visiblePatient.name;
        form.elements.address.value = visiblePatient.address;
        form.elements.telephone.value = visiblePatient.telephone;
        form.elements.dateOfBirth.value = visiblePatient.dateOfBirth;
        form.elements.nhsNumber.value = visiblePatient.nhsNumber;
        patientFormHeading.textContent = "Edit patient";
        patientListView.hidden = true;
        form.hidden = false;
        message.textContent = "Editing " + visiblePatient.name;
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
        if (confirm("Delete " + visiblePatient.name + "?")) {
          await remove("patients", patient.id);
          await audit("delete", "patients", patient.id);
          form.reset();
          message.textContent = "Patient deleted.";
          await showPatients();
        }
      });

      item.append(title, details, identity, editButton, document.createTextNode(" "), deleteButton);
      list.appendChild(item);
    }
  }

  async function showDoctors() {
    const doctors = await getAll("doctors");
    doctorList.replaceChildren();
    const query = doctorSearch.value.trim().toLowerCase();
    const suggestions = document.getElementById("admin-doctor-suggestions");
    suggestions.replaceChildren(...doctors.map(doctor => {
      const option = document.createElement("option");
      option.value = doctor.name || "";
      return option;
    }));
    doctors.filter(doctor => `${doctor.name} ${doctor.email} ${doctor.specialty}`.toLowerCase().includes(query)).forEach(doctor => {
      const item = document.createElement("div");
      item.className = "list-item";
      const summary = document.createElement("strong");
      summary.textContent = doctor.name;
      const doctorDetails = document.createElement("p");
      doctorDetails.textContent = `${doctor.specialty || "General practice"} · ${doctor.email}`;
      item.append(summary, doctorDetails);
      const editButton = document.createElement("button");
      editButton.textContent = "Edit";
      editButton.type = "button";
      editButton.addEventListener("click", () => {
        doctorForm.elements.id.value = doctor.id;
        doctorForm.elements.name.value = doctor.name;
        doctorForm.elements.email.value = doctor.email;
        doctorForm.elements.specialty.value = doctor.specialty || "";
        doctorForm.elements.password.value = "";
        doctorForm.elements.password.removeAttribute("required");
        doctorFormHeading.textContent = "Edit doctor";
        doctorListView.hidden = true;
        doctorForm.hidden = false;
        doctorMessage.textContent = `Editing ${doctor.name}. Enter a new password to change it.`;
        doctorForm.scrollIntoView({ behavior: "smooth" });
      });
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Delete";
      deleteButton.type = "button";
      deleteButton.className = "secondary";
      deleteButton.addEventListener("click", async () => {
        if (!confirm(`Delete doctor account for ${doctor.name}?`)) return;
        await remove("doctors", doctor.id);
        const user = (await getAll("users")).find(item => item.doctorId === doctor.id);
        if (user) await remove("users", user.id);
        await audit("delete", "doctors", doctor.id);
        doctorMessage.textContent = "Doctor account deleted.";
        await showDoctors();
      });
      item.append(editButton, document.createTextNode(" "), deleteButton);
      doctorList.appendChild(item);
    });
  }

  async function showLoginActivity() {
    const [logs, users] = await Promise.all([getAll("auditLogs"), getAll("users")]);
    const logins = logs.filter(log => log.action === "login")
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    activityList.replaceChildren();
    if (logins.length === 0) {
      activityList.textContent = "No login activity recorded yet.";
      return;
    }
    logins.forEach(log => {
      const user = users.find(item => item.id === log.userId);
      const item = document.createElement("div");
      item.className = "list-item";
      const summary = document.createElement("strong");
      summary.textContent = user?.name || log.userId;
      const details = document.createElement("p");
      details.textContent = `${user?.role || log.role} · ${new Date(log.createdAt).toLocaleString()}`;
      item.append(summary, details);
      activityList.appendChild(item);
    });
  }
}
