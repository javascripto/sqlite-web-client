const HANDLE_DB_NAME = 'table-plus-handles';
const HANDLE_STORE_NAME = 'handles';
const LAST_HANDLE_KEY = 'last-db-handle';
const LAST_IMPORT_META_KEY = 'last-import-meta';
const OPFS_ACTIVE_FILENAME = 'table-plus-active.db';

type FsPermissionMode = 'read' | 'readwrite';
type FsPermissionState = 'granted' | 'denied' | 'prompt';

interface FsPermissionDescriptor {
  mode?: FsPermissionMode;
}

interface FileSystemFileHandleCompat extends FileSystemFileHandle {
  queryPermission?: (
    descriptor?: FsPermissionDescriptor,
  ) => Promise<FsPermissionState>;
  requestPermission?: (
    descriptor?: FsPermissionDescriptor,
  ) => Promise<FsPermissionState>;
}

interface WindowWithFsPicker extends Window {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{
      description?: string;
      accept?: Record<string, string[]>;
    }>;
    excludeAcceptAllOption?: boolean;
  }) => Promise<FileSystemFileHandleCompat[]>;
}

interface ImportedFileMeta {
  fileName: string;
  size: number;
  lastModified: number;
  opfsFilename: string;
}

interface ImportOptions {
  onProgress?: (bytesCopied: number, bytesTotal: number) => void;
}

interface ImportResult {
  fileName: string;
  opfsPath: string;
  fromCache: boolean;
  sourceSize: number;
  opfsSize: number;
}

function isBrowser() {
  return typeof window !== 'undefined';
}

function openHandleDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        db.createObjectStore(HANDLE_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putStoreValue(key: string, value: unknown) {
  const db = await openHandleDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
    tx.objectStore(HANDLE_STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

async function getStoreValue<T>(key: string): Promise<T | null> {
  const db = await openHandleDb();

  const value = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, 'readonly');
    const request = tx.objectStore(HANDLE_STORE_NAME).get(key);

    request.onsuccess = () => {
      resolve((request.result as T | undefined) ?? null);
    };

    request.onerror = () => reject(request.error);
  });

  db.close();

  return value;
}

async function getLastImportMeta() {
  return getStoreValue<ImportedFileMeta>(LAST_IMPORT_META_KEY);
}

async function saveLastImportMeta(meta: ImportedFileMeta) {
  await putStoreValue(LAST_IMPORT_META_KEY, meta);
}

export function isFileSystemAccessSupported() {
  const browserWindow = window as WindowWithFsPicker;
  return (
    isBrowser() &&
    typeof browserWindow.showOpenFilePicker === 'function' &&
    'storage' in navigator
  );
}

export async function requestPersistentStorage() {
  if (!('storage' in navigator) || !navigator.storage.persist) {
    return false;
  }

  return navigator.storage.persist();
}

export async function getStorageEstimate() {
  if (!('storage' in navigator) || !navigator.storage.estimate) {
    return { usage: null, quota: null };
  }

  const estimate = await navigator.storage.estimate();

  return {
    usage: estimate.usage ?? null,
    quota: estimate.quota ?? null,
  };
}

export async function pickDatabaseFileHandle() {
  const browserWindow = window as WindowWithFsPicker;

  if (!browserWindow.showOpenFilePicker) {
    throw new Error('showOpenFilePicker() is not available');
  }

  const handles = await browserWindow.showOpenFilePicker({
    multiple: false,
    types: [
      {
        description: 'SQLite database',
        accept: {
          'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3'],
        },
      },
    ],
    excludeAcceptAllOption: false,
  });

  return handles[0];
}

export async function saveLastFileHandle(handle: FileSystemFileHandleCompat) {
  await putStoreValue(LAST_HANDLE_KEY, handle);
}

export async function loadLastFileHandle() {
  return getStoreValue<FileSystemFileHandleCompat>(LAST_HANDLE_KEY);
}

async function queryOrPromptPermission(
  handle: FileSystemFileHandleCompat,
  mode: FsPermissionMode,
) {
  const queryPermission = handle.queryPermission;
  const requestPermission = handle.requestPermission;

  if (!queryPermission || !requestPermission) {
    return false;
  }

  const permission = await queryPermission.call(handle, { mode });

  if (permission === 'granted') {
    return true;
  }

  const requested = await requestPermission.call(handle, { mode });

  return requested === 'granted';
}

export async function ensureReadPermission(handle: FileSystemFileHandleCompat) {
  return queryOrPromptPermission(handle, 'read');
}

export async function ensureReadWritePermission(
  handle: FileSystemFileHandleCompat,
) {
  return queryOrPromptPermission(handle, 'readwrite');
}

async function getOpfsSpaceCheck(fileSize: number) {
  const { usage, quota } = await getStorageEstimate();

  if (!quota || usage === null) {
    return {
      canEstimate: false,
      hasSpace: true,
      available: null as number | null,
      recommended: null as number | null,
    };
  }

  const available = quota - usage;
  const required = Math.ceil(fileSize * 1.35);

  return {
    canEstimate: true,
    hasSpace: available >= required,
    available,
    recommended: required,
  };
}

async function opfsFileExists(opfsFilename: string) {
  try {
    const opfsRoot = await navigator.storage.getDirectory();
    await opfsRoot.getFileHandle(opfsFilename, { create: false });
    return true;
  } catch {
    return false;
  }
}

async function removeOpfsEntryIfExists(filename: string) {
  try {
    const opfsRoot = await navigator.storage.getDirectory();
    await opfsRoot.removeEntry(filename);
  } catch {
    // Ignore missing entries.
  }
}

async function cleanupOpfsFileFamily(opfsFilename: string) {
  await removeOpfsEntryIfExists(opfsFilename);
  await removeOpfsEntryIfExists(`${opfsFilename}-wal`);
  await removeOpfsEntryIfExists(`${opfsFilename}-shm`);
  await removeOpfsEntryIfExists(`${opfsFilename}-journal`);
}

async function getOpfsFileSize(opfsFilename: string) {
  const opfsRoot = await navigator.storage.getDirectory();
  const opfsFileHandle = await opfsRoot.getFileHandle(opfsFilename, {
    create: false,
  });
  const opfsFile = await opfsFileHandle.getFile();
  return opfsFile.size;
}

export async function importHandleToOpfs(
  handle: FileSystemFileHandleCompat,
  opfsFilename = OPFS_ACTIVE_FILENAME,
  options?: ImportOptions,
): Promise<ImportResult> {
  const sourceFile = await handle.getFile();

  const persistentGranted = await requestPersistentStorage();
  const spaceCheck = await getOpfsSpaceCheck(sourceFile.size);
  if (spaceCheck.canEstimate && !spaceCheck.hasSpace) {
    options?.onProgress?.(0, sourceFile.size);
  }

  const lastImportMeta = await getLastImportMeta();
  const hasSameFingerprint =
    lastImportMeta &&
    lastImportMeta.fileName === sourceFile.name &&
    lastImportMeta.size === sourceFile.size &&
    lastImportMeta.lastModified === sourceFile.lastModified &&
    lastImportMeta.opfsFilename === opfsFilename;

  if (hasSameFingerprint && (await opfsFileExists(opfsFilename))) {
    const cachedOpfsSize = await getOpfsFileSize(opfsFilename);
    if (cachedOpfsSize === sourceFile.size) {
      options?.onProgress?.(sourceFile.size, sourceFile.size);

      return {
        fileName: sourceFile.name,
        opfsPath: `/${opfsFilename}`,
        fromCache: true,
        sourceSize: sourceFile.size,
        opfsSize: cachedOpfsSize,
      };
    }
  }

  await cleanupOpfsFileFamily(opfsFilename);

  const opfsRoot = await navigator.storage.getDirectory();
  const opfsFileHandle = await opfsRoot.getFileHandle(opfsFilename, {
    create: true,
  });
  const opfsWritable = await opfsFileHandle.createWritable();

  let bytesCopied = 0;
  const chunkSize = 8 * 1024 * 1024;

  try {
    while (bytesCopied < sourceFile.size) {
      const end = Math.min(bytesCopied + chunkSize, sourceFile.size);
      const chunkBuffer = await sourceFile
        .slice(bytesCopied, end)
        .arrayBuffer();
      const chunk = new Uint8Array(chunkBuffer);

      await opfsWritable.write({
        type: 'write',
        position: bytesCopied,
        data: chunk,
      });

      bytesCopied += chunk.byteLength;
      options?.onProgress?.(bytesCopied, sourceFile.size);
    }

    await opfsWritable.write({ type: 'truncate', size: sourceFile.size });
    await opfsWritable.close();
  } catch (error) {
    await opfsWritable.abort();
    const { usage, quota } = await getStorageEstimate();

    if (
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || error.name === 'NotReadableError')
    ) {
      const copiedGb = (bytesCopied / 1024 / 1024 / 1024).toFixed(2);
      const totalGb = (sourceFile.size / 1024 / 1024 / 1024).toFixed(2);
      const quotaGb =
        quota !== null
          ? (quota / 1024 / 1024 / 1024).toFixed(2)
          : 'desconhecida';
      const usageGb =
        usage !== null
          ? (usage / 1024 / 1024 / 1024).toFixed(2)
          : 'desconhecida';

      throw new Error(
        `Falha ao copiar para OPFS por limite de storage do navegador. Copiado ${copiedGb}/${totalGb} GB. Uso/quota: ${usageGb}/${quotaGb} GB. Storage persistente: ${persistentGranted ? 'sim' : 'não'}.`,
      );
    }

    throw error instanceof Error
      ? error
      : new Error('Falha desconhecida ao copiar arquivo para OPFS.');
  }

  await saveLastImportMeta({
    fileName: sourceFile.name,
    size: sourceFile.size,
    lastModified: sourceFile.lastModified,
    opfsFilename,
  });

  const opfsSize = await getOpfsFileSize(opfsFilename);
  if (opfsSize !== sourceFile.size) {
    const sourceGb = (sourceFile.size / 1024 / 1024 / 1024).toFixed(2);
    const opfsGb = (opfsSize / 1024 / 1024 / 1024).toFixed(2);

    throw new Error(
      `Cópia inconsistente para OPFS. Origem ${sourceGb} GB, OPFS ${opfsGb} GB. Verifique limite de storage/quota.`,
    );
  }

  return {
    fileName: sourceFile.name,
    opfsPath: `/${opfsFilename}`,
    fromCache: false,
    sourceSize: sourceFile.size,
    opfsSize,
  };
}

export async function exportOpfsToHandle(
  handle: FileSystemFileHandleCompat,
  opfsFilename = OPFS_ACTIVE_FILENAME,
) {
  const opfsRoot = await navigator.storage.getDirectory();
  const opfsFileHandle = await opfsRoot.getFileHandle(opfsFilename, {
    create: false,
  });
  const opfsFile = await opfsFileHandle.getFile();
  const destinationWritable = await handle.createWritable();

  await opfsFile.stream().pipeTo(destinationWritable);
}

export const ACTIVE_OPFS_FILENAME = OPFS_ACTIVE_FILENAME;
