import type { BudgetProject } from './types';

const DATABASE_NAME = 'sbs-secure-cache-v1';
const DATABASE_VERSION = 1;
const KEY_STORE = 'keys';
const PROJECT_STORE = 'projects';

interface EncryptedProject {
  id: string;
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
  updatedAt: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(KEY_STORE)) database.createObjectStore(KEY_STORE);
      if (!database.objectStoreNames.contains(PROJECT_STORE)) database.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getKey(userId: string) {
  const database = await openDatabase();
  const read = database.transaction(KEY_STORE, 'readonly').objectStore(KEY_STORE).get(userId);
  const existing = await requestValue<CryptoKey | undefined>(read);
  if (existing) return existing;

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const transaction = database.transaction(KEY_STORE, 'readwrite');
  transaction.objectStore(KEY_STORE).put(key, userId);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  return key;
}

const cacheId = (userId: string, projectId: string) => `${userId}:${projectId}`;

export async function saveSecureProject(userId: string, project: BudgetProject) {
  if (!('indexedDB' in window) || !crypto.subtle) return;
  const key = await getKey(userId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(project));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const entry: EncryptedProject = {
    id: cacheId(userId, project.id),
    iv: iv.buffer,
    ciphertext,
    updatedAt: new Date().toISOString(),
  };
  const database = await openDatabase();
  const transaction = database.transaction(PROJECT_STORE, 'readwrite');
  transaction.objectStore(PROJECT_STORE).put(entry);
}

export async function loadSecureProject(userId: string, projectId: string) {
  if (!('indexedDB' in window) || !crypto.subtle) return null;
  try {
    const database = await openDatabase();
    const request = database.transaction(PROJECT_STORE, 'readonly').objectStore(PROJECT_STORE).get(cacheId(userId, projectId));
    const entry = await requestValue<EncryptedProject | undefined>(request);
    if (!entry) return null;
    const key = await getKey(userId);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(entry.iv) }, key, entry.ciphertext);
    return JSON.parse(new TextDecoder().decode(plaintext)) as BudgetProject;
  } catch {
    return null;
  }
}
