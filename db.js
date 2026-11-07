// The database name and version are kept in one place so they are easy to update.
const DB_NAME = "carelocal";
const DB_VERSION = 1;

// Each store holds one type of information used by the application.
const STORES = ["patients", "doctors", "admins", "medicines", "appointments", "notes", "prescriptions"];

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Create a store the first time the database is opened.
      STORES.forEach(store => {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    // Reading all records lets each role display the latest local data.
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function put(storeName, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    // IndexedDB.put creates a new record or updates one with the same id.
    const request = db.transaction(storeName, "readwrite").objectStore(storeName).put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

export async function remove(storeName, id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    // Delete only the record that matches the supplied id.
    const request = db.transaction(storeName, "readwrite").objectStore(storeName).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function importRecords(records) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    // Import all supplied feeds in one transaction so the data is saved together.
    const transaction = db.transaction(Object.keys(records), "readwrite");
    Object.entries(records).forEach(([storeName, values]) => {
      const store = transaction.objectStore(storeName);
      values.forEach(value => store.put(value));
    });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}
