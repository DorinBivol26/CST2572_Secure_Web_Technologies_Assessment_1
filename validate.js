const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/;

// Keep validation rules in one place so forms and storage agree.
export function sanitise(value, maxLength = 500) {
  return String(value ?? "").replace(/[<>]/g, "").trim().slice(0, maxLength);
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

export function isValidNhsNumber(value) {
  return /^\d{10}$/.test(String(value).trim());
}

export function isValidDateOfBirth(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.valueOf()) && date <= new Date();
}

export function isValidPassword(value) {
  return PASSWORD_POLICY.test(String(value));
}

export const PASSWORD_POLICY_TEXT = "At least 12 characters with upper- and lower-case letters, a number and a symbol.";

export function getPasswordValidationError(value) {
  const password = String(value);
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/\d/.test(password)) return "Password must include a number.";
  if (!/[^A-Za-z\d]/.test(password)) return "Password must include a symbol.";
  return "";
}
