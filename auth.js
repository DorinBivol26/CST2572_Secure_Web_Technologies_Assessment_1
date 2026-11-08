import { deriveEncryptionKey, encryptStoredFields, hashPassword, verifyPassword } from "./crypto.js?v=20261107";
import { getPasswordValidationError, isValidDateOfBirth, isValidEmail, isValidNhsNumber, sanitise } from "./validate.js";
import { getAll, put } from "./db.js";
import { BUNDLED_DATA } from "./seed-data.js";

const SESSION_KEY = "medicare.session";
const TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_USERS = [
  { id: "u-patient", name: "Alex Morgan", email: "patient@example.test", role: "patient", password: "Patient!2026Secure" },
  { id: "u-doctor", name: "Dr. Aisha Khan", email: "doctor@example.test", role: "doctor", password: "Doctor!2026Secure" },
  { id: "u-admin", name: "Practice administrator", email: "admin@example.test", role: "admin", password: "Admin!2026Secure" }
];
const ADMIN_USERS = BUNDLED_DATA.admins.map(admin => ({
  id: `u-${admin.id}`,
  name: admin.name,
  username: admin.username,
  email: admin.email,
  role: "admin",
  password: admin.password
}));

let timeoutId;

// Add bundled demo accounts without replacing accounts already created locally.
async function ensureUsers() {
  const users = await getAll("users");
  const knownIds = new Set(users.map(user => user.id));
  const records = await Promise.all([...DEFAULT_USERS, ...ADMIN_USERS]
    .filter(user => !knownIds.has(user.id))
    .map(async user => {
    const password = await hashPassword(user.password);
    return { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role, password };
  }));
  for (const user of records) await put("users", user);
}

export async function login(identifier, password) {
  // Resolve either an email address or an administrator username.
  const normalizedIdentifier = identifier.trim().toLowerCase();
  if (!normalizedIdentifier) throw new Error("Enter your email or admin username.");
  await ensureUsers();
  const user = (await getAll("users")).find(item =>
    item.email === normalizedIdentifier || item.username?.toLowerCase() === normalizedIdentifier
  );
  if (!user || !(await verifyPassword(password, user.password))) throw new Error("Username, email or password is incorrect.");
  // Store only the identity and role needed by the dashboard.
  const session = {
    id: user.id,
    name: user.name,
    role: user.role,
    patientId: user.patientId || (user.role === "patient" ? "p-001" : null),
    doctorId: user.doctorId || null,
    lastActivity: Date.now()
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  await audit("login", "users", user.id);
  const encryptionSalt = user.encryptionSalt || btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const key = await deriveEncryptionKey(password, encryptionSalt);
  sessionStorage.setItem("medicare.encryptionKey", btoa(String.fromCharCode(...new Uint8Array(key))));
  startInactivityTimeout();
  return session;
}

export function getSession() {
  // Expired or malformed browser sessions are treated as signed out.
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    return session && Date.now() - session.lastActivity < TIMEOUT_MS ? session : null;
  } catch {
    return null;
  }
}

export function logout() {
  // Remove both identity and temporary encryption material.
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem("medicare.encryptionKey");
  clearTimeout(timeoutId);
}

export function requireRole(role) {
  // Guard each workspace before it reads or changes role-specific records.
  const session = getSession();
  if (!session || session.role !== role) throw new Error(`This workspace requires the ${role} role.`);
  return session;
}

export async function audit(action, store, recordId) {
  // Record successful access and changes in the local audit store.
  const session = getSession();
  if (!session) return;
  await put("auditLogs", {
    id: crypto.randomUUID(),
    userId: session.id,
    role: session.role,
    action,
    store,
    recordId,
    createdAt: new Date().toISOString()
  });
}

function startInactivityTimeout() {
  // User activity keeps the local session alive.
  clearTimeout(timeoutId);
  const refresh = () => {
    const session = getSession();
    if (!session) return;
    session.lastActivity = Date.now();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      logout();
      window.dispatchEvent(new CustomEvent("auth-expired"));
    }, TIMEOUT_MS);
  };
  ["click", "keydown", "pointermove"].forEach(eventName => {
    window.addEventListener(eventName, refresh, { passive: true });
  });
  timeoutId = setTimeout(() => {
    logout();
    window.dispatchEvent(new CustomEvent("auth-expired"));
  }, TIMEOUT_MS);
}

export function initialiseAuth(onAuthenticated) {
  // Connect the sign-in form to the shared login workflow.
  const form = document.getElementById("login-form");
  const message = document.getElementById("login-message");
  const password = form.querySelector("input[name='password']");
  const showPassword = document.getElementById("login-show-password");
  showPassword.addEventListener("change", () => {
    password.type = showPassword.checked ? "text" : "password";
  });
  const session = getSession();
  if (session) onAuthenticated(session);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      const loggedIn = await login(sanitise(data.email, 120), data.password);
      message.textContent = "";
      onAuthenticated(loggedIn);
    } catch (error) {
      message.textContent = error.message;
    }
  });
}

export function initialiseRegistration() {
  // Connect the patient registration form to validation and storage.
  const form = document.getElementById("register-form");
  const message = document.getElementById("register-message");
  const password = document.getElementById("register-password");
  const confirmPassword = document.getElementById("register-confirm-password");
  const showPassword = document.getElementById("register-show-password");
  const passwordRequirements = document.getElementById("password-requirements");
  const showPasswordRequirements = () => {
    passwordRequirements.hidden = false;
  };
  password.addEventListener("focus", showPasswordRequirements);
  password.addEventListener("input", showPasswordRequirements);
  showPassword.addEventListener("change", () => {
    const type = showPassword.checked ? "text" : "password";
    password.type = type;
    confirmPassword.type = type;
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      if (data.password !== data.confirmPassword) throw new Error("Passwords do not match.");
      const passwordError = getPasswordValidationError(data.password);
      if (passwordError) throw new Error(passwordError);
      if (!data.consent || !isValidEmail(data.email)) throw new Error("Check your email and consent.");
      if (!isValidNhsNumber(data.nhsNumber) || !isValidDateOfBirth(data.dateOfBirth)) {
        throw new Error("Enter a valid NHS number and date of birth.");
      }
      await ensureUsers();
      const users = await getAll("users");
      const email = sanitise(data.email, 120).toLowerCase();
      if (users.some(user => user.email === email)) throw new Error("An account already exists for this email.");
      const patientId = crypto.randomUUID();
      const password = await hashPassword(data.password);
      const encryptionSalt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
      await put("users", { id: crypto.randomUUID(), name: sanitise(data.name, 80), email, role: "patient", patientId, password, encryptionSalt, consentGiven: true });
      const patient = {
        id: patientId,
        name: sanitise(data.name, 80),
        address: sanitise(data.address, 160),
        telephone: sanitise(data.telephone, 20),
        dateOfBirth: data.dateOfBirth,
        nhsNumber: sanitise(data.nhsNumber, 10)
      };
      await login(email, data.password);
      await put("patients", await encryptStoredFields(patient, ["name", "address", "telephone", "dateOfBirth", "nhsNumber"]));
      window.location.href = "dashboard.html";
    } catch (error) {
      message.textContent = error.message;
    }
  });
}
