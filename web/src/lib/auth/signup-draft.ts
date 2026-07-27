/** Persist in-progress referee signup so Save & exit can resume later. */

const DRAFT_KEY = "gotrefs_ref_signup_draft_v1";
const IDB_NAME = "gotrefs-signup-draft";
const IDB_STORE = "files";
const IDB_VERSION = 1;

export type RefSignupDraftFields = {
  screen: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  primarySport: string;
  customPrimarySport: string;
  secondarySport: string;
  certificationLevel: string;
  additionalCertificationLevels?: string[];
  certifiedBy?: string;
  hourlyRateMin: string;
  hourlyRateMax: string;
  baseCity: string;
  travelRadius: string;
  workRegions: string[];
  termsAccepted: boolean;
  recommendedAssignorName: string;
  recommendedAssignorEmail: string;
  recommendedAssignorPhone: string;
  savedAt: string;
};

export type RefSignupDraftFiles = {
  photo?: File | null;
  govIdFront?: File | null;
  govIdBack?: File | null;
  certDoc?: File | null;
};

type StoredFile = {
  name: string;
  type: string;
  buffer: ArrayBuffer;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

async function idbPut(key: string, value: StoredFile | null) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    if (value) store.put(value, key);
    else store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });
  db.close();
}

async function idbGet(key: string): Promise<StoredFile | null> {
  const db = await openDb();
  const value = await new Promise<StoredFile | null>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const request = tx.objectStore(IDB_STORE).get(key);
    request.onsuccess = () => resolve((request.result as StoredFile | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
  });
  db.close();
  return value;
}

async function idbClear() {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB clear failed"));
    });
    db.close();
  } catch {
    // Non-fatal.
  }
}

async function fileToStored(file: File | null | undefined): Promise<StoredFile | null> {
  if (!file) return null;
  const buffer = await file.arrayBuffer();
  return { name: file.name, type: file.type || "application/octet-stream", buffer };
}

function storedToFile(stored: StoredFile | null): File | null {
  if (!stored) return null;
  return new File([stored.buffer], stored.name, { type: stored.type });
}

export function readRefSignupDraftFields(): RefSignupDraftFields | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RefSignupDraftFields;
    if (!parsed || typeof parsed.screen !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function loadRefSignupDraft(): Promise<{
  fields: RefSignupDraftFields;
  files: Required<RefSignupDraftFiles>;
} | null> {
  const fields = readRefSignupDraftFields();
  if (!fields) return null;

  try {
    const [photo, govIdFront, govIdBack, certDoc] = await Promise.all([
      idbGet("photo"),
      idbGet("govIdFront"),
      idbGet("govIdBack"),
      idbGet("certDoc"),
    ]);
    return {
      fields,
      files: {
        photo: storedToFile(photo),
        govIdFront: storedToFile(govIdFront),
        govIdBack: storedToFile(govIdBack),
        certDoc: storedToFile(certDoc),
      },
    };
  } catch {
    return { fields, files: { photo: null, govIdFront: null, govIdBack: null, certDoc: null } };
  }
}

export async function saveRefSignupDraft(
  fields: Omit<RefSignupDraftFields, "savedAt">,
  files: RefSignupDraftFiles
): Promise<void> {
  if (typeof window === "undefined") return;
  const payload: RefSignupDraftFields = {
    ...fields,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));

  try {
    const [photo, govIdFront, govIdBack, certDoc] = await Promise.all([
      fileToStored(files.photo),
      fileToStored(files.govIdFront),
      fileToStored(files.govIdBack),
      fileToStored(files.certDoc),
    ]);
    await Promise.all([
      idbPut("photo", photo),
      idbPut("govIdFront", govIdFront),
      idbPut("govIdBack", govIdBack),
      idbPut("certDoc", certDoc),
    ]);
  } catch {
    // Text fields still saved even if file storage fails.
  }
}

export async function clearRefSignupDraft(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
  await idbClear();
}

export function hasRefSignupDraft(): boolean {
  return Boolean(readRefSignupDraftFields());
}
