const HANDLE_DB_NAME = 'table-plus-handles';
const HANDLE_STORE_NAME = 'handles';
const LAST_HANDLE_KEY = 'last-db-handle';
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

export function isFileSystemAccessSupported() {
  const browserWindow = window as WindowWithFsPicker;
  return (
    isBrowser() &&
    typeof browserWindow.showOpenFilePicker === 'function' &&
    'storage' in navigator
  );
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
  const db = await openHandleDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
    tx.objectStore(HANDLE_STORE_NAME).put(handle, LAST_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

export async function loadLastFileHandle() {
  const db = await openHandleDb();

  const handle = await new Promise<FileSystemFileHandleCompat | null>(
    (resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE_NAME, 'readonly');
      const request = tx.objectStore(HANDLE_STORE_NAME).get(LAST_HANDLE_KEY);

      request.onsuccess = () => {
        resolve(
          (request.result as FileSystemFileHandleCompat | undefined) ?? null,
        );
      };

      request.onerror = () => reject(request.error);
    },
  );

  db.close();

  return handle;
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

export async function importHandleToOpfs(
  handle: FileSystemFileHandleCompat,
  opfsFilename = OPFS_ACTIVE_FILENAME,
) {
  const sourceFile = await handle.getFile();
  const opfsRoot = await navigator.storage.getDirectory();
  const opfsFileHandle = await opfsRoot.getFileHandle(opfsFilename, {
    create: true,
  });
  const opfsWritable = await opfsFileHandle.createWritable();

  await sourceFile.stream().pipeTo(opfsWritable);

  return {
    fileName: sourceFile.name,
    opfsPath: `/${opfsFilename}`,
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
