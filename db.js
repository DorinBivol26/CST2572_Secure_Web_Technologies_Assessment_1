const DB_NAME = "carelocal";
const DB_VERSION = 3;
const STORES = ["patients", "doctors", "admins", "users", "medicines", "appointments", "notes", "prescriptions", "prescriptionRequests", "auditLogs"];

// Open the shared local database and create any missing stores.
// Small IndexedDB helpers keep database access consistent across roles.
export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      STORES.forEach(store => {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll(storeName) {
  // Read every record from one role's data store.
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function put(storeName, value) {
  // Insert a new record or replace the record with the same id.
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readwrite").objectStore(storeName).put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

export async function remove(storeName, id) {
  // Delete one record by its object-store key.
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readwrite").objectStore(storeName).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function importRecords(records) {
  // Import related records in one transaction so the seed stays consistent.
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(Object.keys(records), "readwrite");
    Object.entries(records).forEach(([storeName, values]) => {
      const store = transaction.objectStore(storeName);
      values.forEach(value => store.put(value));
    });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearStores(storeNames) {
  // Remove stale reference data before loading the current bundled version.
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, "readwrite");
    storeNames.forEach(storeName => transaction.objectStore(storeName).clear());
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}
