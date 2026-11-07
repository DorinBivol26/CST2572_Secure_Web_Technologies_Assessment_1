const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const DATA_KEY_STORAGE = "medicare.dataKey";

// Convert binary encryption values to strings that IndexedDB can store.
function toBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

// Derive a repeatable password hash while keeping a unique salt per account.
export async function hashPassword(password, salt = crypto.getRandomValues(new Uint8Array(16))) {
  // PBKDF2 makes password guessing deliberately expensive.
  const keyMaterial = await crypto.subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" }, keyMaterial, 256);
  return { salt: toBase64(salt), hash: toBase64(bits) };
}

export async function verifyPassword(password, storedHash) {
  const result = await hashPassword(password, fromBase64(storedHash.salt));
  return result.hash === storedHash.hash;
}

// Create the temporary session key used for account-specific encryption.
export async function deriveEncryptionKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt: fromBase64(salt),
    iterations: 210000,
    hash: "SHA-256"
  }, keyMaterial, 256);
}

async function getSessionKey() {
  // The key exists only while the signed-in browser session is active.
  const encodedKey = sessionStorage.getItem("medicare.encryptionKey");
  if (!encodedKey) throw new Error("Encryption key is not available for this session.");
  return crypto.subtle.importKey("raw", fromBase64(encodedKey), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

// Get the browser-local key used to protect shared patient records.
async function getDataKey() {
  let encodedKey = localStorage.getItem(DATA_KEY_STORAGE);
  if (!encodedKey) {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const rawKey = await crypto.subtle.exportKey("raw", key);
    encodedKey = toBase64(rawKey);
    localStorage.setItem(DATA_KEY_STORAGE, encodedKey);
  }
  return crypto.subtle.importKey("raw", fromBase64(encodedKey), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptValue(value) {
  const key = await getSessionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(String(value ?? "")));
  return `${toBase64(iv)}.${toBase64(encrypted)}`;
}

// Return the original value when it is not encrypted or cannot be opened.
export async function decryptValue(value) {
  if (typeof value !== "string" || !value.includes(".")) return value;
  try {
    const [iv, encrypted] = value.split(".");
    const key = await getSessionKey();
    const plainText = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, fromBase64(encrypted));
    return textDecoder.decode(plainText);
  } catch {
    return value;
  }
}

export async function encryptFields(record, fields) {
  const encrypted = { ...record };
  for (const field of fields) encrypted[field] = await encryptValue(record[field]);
  return encrypted;
}

export async function decryptFields(record, fields) {
  const decrypted = { ...record };
  for (const field of fields) decrypted[field] = await decryptValue(record[field]);
  return decrypted;
}

// Encrypt selected fields while preserving the rest of the record unchanged.
export async function encryptStoredFields(record, fields) {
  const key = await getDataKey();
  const encrypted = { ...record };
  for (const field of fields) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const value = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(String(record[field] ?? "")));
    encrypted[field] = `${toBase64(iv)}.${toBase64(value)}`;
  }
  return encrypted;
}

export async function decryptStoredFields(record, fields) {
  const key = await getDataKey();
  const decrypted = { ...record };
  for (const field of fields) {
    if (typeof record[field] !== "string" || !record[field].includes(".")) continue;
    try {
      const [iv, value] = record[field].split(".");
      const plainText = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, fromBase64(value));
      decrypted[field] = textDecoder.decode(plainText);
    } catch {
      decrypted[field] = await decryptValue(record[field]);
    }
  }
  return decrypted;
}
