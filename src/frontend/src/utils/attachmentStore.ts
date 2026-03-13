/**
 * attachmentStore — IndexedDB storage for large attachment data URLs.
 * Bypasses localStorage's 5-10 MB quota so GIFs/images always persist.
 */

const DB_NAME = "sentry_attachments";
const STORE_NAME = "attachments";
const DB_VERSION = 1;

/** In-memory cache so attachments are available synchronously within a session */
const memoryCache = new Map<string, string>();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function getAttachmentFromCache(key: string): string | null {
  return memoryCache.get(key) ?? null;
}

export async function storeAttachment(
  key: string,
  dataUrl: string,
): Promise<void> {
  // Seed memory cache immediately (synchronous) — available before IDB write completes
  memoryCache.set(key, dataUrl);
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(dataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal — in-session display still works via memory cache
  }
}

export async function loadAttachment(key: string): Promise<string | null> {
  // Check memory cache first (synchronous hit)
  if (memoryCache.has(key)) return memoryCache.get(key)!;
  try {
    const db = await openDB();
    const result = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as string) ?? null);
      req.onerror = () => reject(req.error);
    });
    // Populate cache for future synchronous access
    if (result) memoryCache.set(key, result);
    return result;
  } catch {
    return null;
  }
}

export async function deleteAttachment(key: string): Promise<void> {
  memoryCache.delete(key);
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export async function clearAllAttachments(): Promise<void> {
  memoryCache.clear();
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}
