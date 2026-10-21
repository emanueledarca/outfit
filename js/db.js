// Archivio locale (IndexedDB): i dati restano sul dispositivo.

const DB_NAME = 'app-outfit';
const VERSION = 1;
const STORES = { items: 'id', log: 'id', votes: 'key', tryons: 'id', settings: 'key' };

let opening;

function open() {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      for (const [name, keyPath] of Object.entries(STORES)) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
}

async function run(store, mode, fn) {
  const conn = await open();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const db = {
  all: (store) => run(store, 'readonly', (s) => s.getAll()),
  get: (store, key) => run(store, 'readonly', (s) => s.get(key)),
  put: (store, value) => run(store, 'readwrite', (s) => s.put(value)),
  putMany: (store, values) => run(store, 'readwrite', (s) => { for (const v of values) s.put(v); }),
  del: (store, key) => run(store, 'readwrite', (s) => s.delete(key)),
  delMany: (store, keys) => run(store, 'readwrite', (s) => { for (const k of keys) s.delete(k); }),
  clear: (store) => run(store, 'readwrite', (s) => s.clear()),
};

export async function getSetting(key, fallback = null) {
  const row = await db.get('settings', key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  return db.put('settings', { key, value });
}
