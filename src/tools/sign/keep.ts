// "Keep my signature on this device": the signature's picture, and nothing else, in this browser's
// IndexedDB, only once someone asks for it; Forget deletes it. The one thing Fundus keeps that
// someone made (plans/fundus.md, Memory).

const DB = 'fundus-sign';
const STORE = 'kept';
const KEY = 'signature';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** The kept signature as PNG bytes, or null (none kept, or storage refused: a private window). */
export async function loadKept(): Promise<Uint8Array | null> {
  try {
    const value = await run<unknown>('readonly', (s) => s.get(KEY));
    return value instanceof ArrayBuffer ? new Uint8Array(value) : null;
  } catch {
    return null;
  }
}

/** Keeps the signature's picture (PNG bytes). False when the browser won't store it. */
export async function keep(png: Uint8Array): Promise<boolean> {
  try {
    // Bytes rather than a Blob: every engine stores an ArrayBuffer.
    await run('readwrite', (s) => s.put(png.slice().buffer, KEY));
    return true;
  } catch {
    return false;
  }
}

export async function forget(): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(KEY));
  } catch {
    // Nothing kept, or no storage: nothing to forget.
  }
}
