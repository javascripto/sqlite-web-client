import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { toast } from 'sonner';

import type {
  DbObjectItem,
  QueryLogItem,
  SessionState,
  TableData,
} from '@/app/session/types';
import {
  ACTIVE_OPFS_FILENAME,
  ensureReadPermission,
  ensureReadWritePermission,
  exportOpfsToHandle,
  getStorageEstimate,
  importHandleToOpfs,
  isFileSystemAccessSupported,
  loadLastFileHandle,
  pickDatabaseFileHandle,
  saveLastFileHandle,
} from '@/features/sqlite/fs-access-gateway';
import { SqliteEngine } from '@/features/sqlite/sqlite-engine';
import {
  isTauriRuntime,
  TauriSqliteClient,
} from '@/features/sqlite/tauri-sqlite-client';

type SessionAction =
  | { type: 'SET_EXPLORER_SEARCH'; payload: string }
  | { type: 'SET_OBJECTS'; payload: DbObjectItem[] }
  | { type: 'SELECT_OBJECT'; payload: string }
  | { type: 'SET_QUERY_TEXT'; payload: string }
  | { type: 'RUN_QUERY'; payload: QueryLogItem }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_PAGE_SIZE'; payload: number }
  | { type: 'SELECT_ROW'; payload: number | null }
  | { type: 'SET_ACTIVE_TABLE_DATA'; payload: TableData | null }
  | { type: 'SET_LOADING_TABLE_DATA'; payload: boolean }
  | { type: 'SET_OPENING_DATABASE'; payload: boolean }
  | { type: 'SET_IMPORT_PROGRESS'; payload: number | null }
  | { type: 'SET_OPEN_STATUS'; payload: SessionState['openStatus'] }
  | {
      type: 'SET_DATABASE_META';
      payload: { databaseName: string; sqliteVersion: string };
    }
  | { type: 'SET_STATUS_MESSAGE'; payload: string | null }
  | { type: 'TOGGLE_EXPLORER_PANEL' }
  | { type: 'TOGGLE_SQL_CONSOLE_PANEL' };

const defaultSql =
  'SELECT name FROM sqlite_master WHERE type IN ("table","view") ORDER BY name;';

const initialState: SessionState = {
  databaseName: null,
  sqliteVersion: null,
  openStatus: 'idle',
  objects: [],
  activeObject: null,
  explorerSearch: '',
  queryText: defaultSql,
  queryLog: [],
  page: 0,
  pageSize: 300,
  selectedRowIndex: null,
  activeTableData: null,
  isLoadingTableData: false,
  isOpeningDatabase: false,
  importProgress: null,
  statusMessage: 'Nenhum banco aberto. Selecione um arquivo .db.',
  isExplorerVisible: true,
  isSqlConsoleVisible: true,
};

type StoredFileHandle = NonNullable<
  Awaited<ReturnType<typeof loadLastFileHandle>>
>;

function extractErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  if (error && typeof error === 'object') {
    const asRecord = error as Record<string, unknown>;

    const directMessage = asRecord.message;
    if (typeof directMessage === 'string' && directMessage.trim().length > 0) {
      return directMessage;
    }

    const result = asRecord.result;
    if (result && typeof result === 'object') {
      const resultMessage = (result as Record<string, unknown>).message;
      if (
        typeof resultMessage === 'string' &&
        resultMessage.trim().length > 0
      ) {
        return resultMessage;
      }
    }

    const cause = asRecord.cause;
    if (cause && typeof cause === 'object') {
      const causeMessage = (cause as Record<string, unknown>).message;
      if (typeof causeMessage === 'string' && causeMessage.trim().length > 0) {
        return causeMessage;
      }
    }

    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case 'SET_EXPLORER_SEARCH':
      return { ...state, explorerSearch: action.payload };
    case 'SET_OBJECTS':
      return { ...state, objects: action.payload };
    case 'SELECT_OBJECT':
      return {
        ...state,
        activeObject: action.payload,
        selectedRowIndex: null,
        page: 0,
      };
    case 'SET_QUERY_TEXT':
      return { ...state, queryText: action.payload };
    case 'RUN_QUERY':
      return {
        ...state,
        queryLog: [action.payload, ...state.queryLog].slice(0, 40),
      };
    case 'SET_PAGE':
      return {
        ...state,
        page: Math.max(action.payload, 0),
        selectedRowIndex: null,
      };
    case 'SET_PAGE_SIZE':
      return {
        ...state,
        page: 0,
        pageSize: action.payload,
        selectedRowIndex: null,
      };
    case 'SELECT_ROW':
      return { ...state, selectedRowIndex: action.payload };
    case 'SET_ACTIVE_TABLE_DATA':
      return {
        ...state,
        activeTableData: action.payload,
        selectedRowIndex: null,
      };
    case 'SET_LOADING_TABLE_DATA':
      return { ...state, isLoadingTableData: action.payload };
    case 'SET_OPENING_DATABASE':
      return { ...state, isOpeningDatabase: action.payload };
    case 'SET_IMPORT_PROGRESS':
      return { ...state, importProgress: action.payload };
    case 'SET_OPEN_STATUS':
      return { ...state, openStatus: action.payload };
    case 'SET_DATABASE_META':
      return {
        ...state,
        databaseName: action.payload.databaseName,
        sqliteVersion: action.payload.sqliteVersion,
        openStatus: 'ready',
      };
    case 'SET_STATUS_MESSAGE':
      return { ...state, statusMessage: action.payload };
    case 'TOGGLE_EXPLORER_PANEL':
      return { ...state, isExplorerVisible: !state.isExplorerVisible };
    case 'TOGGLE_SQL_CONSOLE_PANEL':
      return { ...state, isSqlConsoleVisible: !state.isSqlConsoleVisible };
    default:
      return state;
  }
}

interface SessionContextValue {
  state: SessionState;
  dispatch: Dispatch<SessionAction>;
  openDatabase: () => Promise<void>;
  syncDatabaseToDisk: () => Promise<void>;
  selectObject: (name: string) => Promise<void>;
  setPage: (nextPage: number) => Promise<void>;
  runSql: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);
  const sqliteEngineRef = useRef<SqliteEngine | null>(null);
  const tauriClientRef = useRef<TauriSqliteClient | null>(null);
  const fileHandleRef = useRef<StoredFileHandle | null>(null);
  const activeOpfsFilenameRef = useRef(ACTIVE_OPFS_FILENAME);
  const readOnlyModeRef = useRef(false);
  const backendModeRef = useRef<'browser' | 'tauri' | null>(null);

  const getEngine = useCallback(() => {
    if (!sqliteEngineRef.current) {
      sqliteEngineRef.current = new SqliteEngine();
    }

    return sqliteEngineRef.current;
  }, []);

  const getTauriClient = useCallback(() => {
    if (!tauriClientRef.current) {
      tauriClientRef.current = new TauriSqliteClient();
    }

    return tauriClientRef.current;
  }, []);

  const loadTableData = useCallback(
    async (tableName: string, page: number, pageSize: number) => {
      dispatch({ type: 'SET_LOADING_TABLE_DATA', payload: true });

      try {
        const tableData =
          backendModeRef.current === 'tauri'
            ? await getTauriClient().queryTablePage(
                tableName,
                pageSize,
                page * pageSize,
              )
            : await getEngine().queryTablePage(
                tableName,
                pageSize,
                page * pageSize,
              );

        dispatch({ type: 'SET_ACTIVE_TABLE_DATA', payload: tableData });
      } finally {
        dispatch({ type: 'SET_LOADING_TABLE_DATA', payload: false });
      }
    },
    [getEngine, getTauriClient],
  );

  const selectObject = useCallback(
    async (name: string) => {
      dispatch({ type: 'SELECT_OBJECT', payload: name });
      await loadTableData(name, 0, state.pageSize);
    },
    [loadTableData, state.pageSize],
  );

  const setPage = useCallback(
    async (nextPage: number) => {
      if (!state.activeObject) {
        return;
      }

      const normalized = Math.max(nextPage, 0);
      dispatch({ type: 'SET_PAGE', payload: normalized });
      await loadTableData(state.activeObject, normalized, state.pageSize);
    },
    [loadTableData, state.activeObject, state.pageSize],
  );

  const openDatabase = useCallback(async () => {
    dispatch({ type: 'SET_OPENING_DATABASE', payload: true });
    dispatch({ type: 'SET_IMPORT_PROGRESS', payload: 0 });
    dispatch({ type: 'SET_OPEN_STATUS', payload: 'idle' });
    dispatch({
      type: 'SET_STATUS_MESSAGE',
      payload: 'Abrindo arquivo SQLite...',
    });

    let importedContext: {
      opfsPath: string;
      sourceSize: number;
      opfsSize: number;
    } | null = null;

    try {
      if (isTauriRuntime()) {
        backendModeRef.current = 'tauri';
        readOnlyModeRef.current = false;

        const tauriClient = getTauriClient();
        const openResult = await tauriClient.openDatabase();
        const objects = await tauriClient.listObjects();

        dispatch({
          type: 'SET_DATABASE_META',
          payload: {
            databaseName: openResult.databaseName,
            sqliteVersion: openResult.sqliteVersion,
          },
        });
        dispatch({
          type: 'SET_OBJECTS',
          payload: objects.map(obj => ({ ...obj, estimatedRows: null })),
        });

        const firstTable =
          objects.find(obj => obj.type === 'table')?.name ??
          objects[0]?.name ??
          null;

        if (firstTable) {
          dispatch({ type: 'SELECT_OBJECT', payload: firstTable });
          await loadTableData(firstTable, 0, state.pageSize);
        } else {
          dispatch({ type: 'SET_ACTIVE_TABLE_DATA', payload: null });
        }

        dispatch({
          type: 'SET_STATUS_MESSAGE',
          payload: `Arquivo aberto (Tauri): ${openResult.databaseName}`,
        });
        dispatch({ type: 'SET_IMPORT_PROGRESS', payload: null });

        toast.success('Banco SQLite aberto via Tauri', {
          description: openResult.databaseName,
        });
        return;
      }

      if (!isFileSystemAccessSupported()) {
        throw new Error(
          'Seu browser não suporta File System Access API nesta sessão.',
        );
      }

      backendModeRef.current = 'browser';

      const fileHandle = await pickDatabaseFileHandle();
      const hasReadPermission = await ensureReadPermission(fileHandle);

      if (!hasReadPermission) {
        throw new Error(
          'Permissão de leitura não concedida para o arquivo selecionado.',
        );
      }

      fileHandleRef.current = fileHandle;
      await saveLastFileHandle(fileHandle);
      const engine = getEngine();
      await engine.close();

      const file = await fileHandle.getFile();
      const opfsFilename = `table-plus-${file.lastModified}-${file.size}.db`;
      const estimate = await getStorageEstimate();

      if (estimate.usage !== null && estimate.quota) {
        const freeBytes = estimate.quota - estimate.usage;
        const freeGb = (freeBytes / 1024 / 1024 / 1024).toFixed(2);
        const sizeGb = (file.size / 1024 / 1024 / 1024).toFixed(2);
        const recommendedBytes = Math.ceil(file.size * 1.35);
        const recommendedGb = (recommendedBytes / 1024 / 1024 / 1024).toFixed(
          2,
        );
        dispatch({
          type: 'SET_STATUS_MESSAGE',
          payload:
            freeBytes < recommendedBytes
              ? `Storage possivelmente insuficiente. Arquivo ${sizeGb} GB, recomendado ~${recommendedGb} GB livres, disponível ${freeGb} GB.`
              : `Preparando cópia para OPFS (${sizeGb} GB). Livre no browser: ${freeGb} GB.`,
        });
      }

      const imported = await importHandleToOpfs(fileHandle, opfsFilename, {
        onProgress: (copied, total) => {
          const progress =
            total > 0 ? Math.min(100, Math.round((copied / total) * 100)) : 0;
          dispatch({ type: 'SET_IMPORT_PROGRESS', payload: progress });
          dispatch({
            type: 'SET_STATUS_MESSAGE',
            payload: `Copiando banco para OPFS... ${progress}%`,
          });
        },
      });
      importedContext = {
        opfsPath: imported.opfsPath,
        sourceSize: imported.sourceSize,
        opfsSize: imported.opfsSize,
      };
      activeOpfsFilenameRef.current = opfsFilename;
      const openResult = await engine.openOpfsDatabase(imported.opfsPath);
      readOnlyModeRef.current = openResult.readOnly;
      const objects = await engine.listObjects();

      dispatch({
        type: 'SET_DATABASE_META',
        payload: {
          databaseName: imported.fileName,
          sqliteVersion: openResult.version,
        },
      });

      dispatch({
        type: 'SET_OBJECTS',
        payload: objects.map(obj => ({ ...obj, estimatedRows: null })),
      });

      const firstTable =
        objects.find(obj => obj.type === 'table')?.name ??
        objects[0]?.name ??
        null;

      if (firstTable) {
        dispatch({ type: 'SELECT_OBJECT', payload: firstTable });
        await loadTableData(firstTable, 0, state.pageSize);
      } else {
        dispatch({ type: 'SET_ACTIVE_TABLE_DATA', payload: null });
      }

      dispatch({
        type: 'SET_STATUS_MESSAGE',
        payload: imported.fromCache
          ? `Arquivo aberto: ${imported.fileName} (cache OPFS reutilizado)${openResult.readOnly ? ' [read-only]' : ''}`
          : `Arquivo aberto: ${imported.fileName}${openResult.readOnly ? ' [read-only]' : ''}`,
      });
      dispatch({ type: 'SET_IMPORT_PROGRESS', payload: null });

      toast.success('Banco SQLite aberto no browser', {
        description: imported.fileName,
      });
    } catch (error) {
      let message = extractErrorMessage(error, 'Falha ao abrir banco SQLite');
      if (message.includes('SQLITE_CANTOPEN') && importedContext) {
        const sourceMb = (importedContext.sourceSize / 1024 / 1024).toFixed(1);
        const opfsMb = (importedContext.opfsSize / 1024 / 1024).toFixed(1);
        message = `${message} | OPFS: ${importedContext.opfsPath} | size src/opfs: ${sourceMb}/${opfsMb} MB`;
      }
      console.error('openDatabase failed', error);

      dispatch({ type: 'SET_OPEN_STATUS', payload: 'error' });
      dispatch({ type: 'SET_STATUS_MESSAGE', payload: message });
      dispatch({ type: 'SET_OBJECTS', payload: [] });
      dispatch({ type: 'SET_ACTIVE_TABLE_DATA', payload: null });
      dispatch({ type: 'SELECT_ROW', payload: null });
      dispatch({ type: 'SET_IMPORT_PROGRESS', payload: null });
      readOnlyModeRef.current = false;
      backendModeRef.current = null;

      toast.error('Não foi possível abrir o banco', { description: message });
    } finally {
      dispatch({ type: 'SET_OPENING_DATABASE', payload: false });
    }
  }, [getEngine, getTauriClient, loadTableData, state.pageSize]);

  const syncDatabaseToDisk = useCallback(async () => {
    if (backendModeRef.current === 'tauri') {
      await getTauriClient().persistCurrentDatabase();
      toast.success('Banco salvo no disco (Tauri).');
      return;
    }

    if (readOnlyModeRef.current) {
      toast.error(
        'Banco aberto em modo somente leitura. Não é possível salvar.',
      );
      return;
    }

    if (!fileHandleRef.current) {
      toast.error('Nenhum arquivo local está conectado.');
      return;
    }

    const canWrite = await ensureReadWritePermission(fileHandleRef.current);

    if (!canWrite) {
      toast.error(
        'Permissão de escrita não concedida para sincronizar o arquivo.',
      );
      return;
    }

    await exportOpfsToHandle(
      fileHandleRef.current,
      activeOpfsFilenameRef.current,
    );

    toast.success('Arquivo sincronizado no disco.');
  }, [getTauriClient]);

  const runSql = useCallback(async () => {
    if (state.openStatus !== 'ready') {
      toast.error('Abra um arquivo .db antes de executar SQL.');
      return;
    }

    const now = new Date();
    const start = performance.now();

    try {
      const rows =
        backendModeRef.current === 'tauri'
          ? await getTauriClient().runSql(state.queryText)
          : await getEngine().runSql(state.queryText);
      const durationMs = Math.round(performance.now() - start);

      dispatch({
        type: 'RUN_QUERY',
        payload: {
          id: `${now.getTime()}`,
          sql: state.queryText,
          ranAt: now.toISOString(),
          durationMs,
          rows: rows.length,
          status: 'ok',
        },
      });

      if (state.activeObject) {
        await loadTableData(state.activeObject, state.page, state.pageSize);
      }

      toast.success('Query executada', {
        description: `${rows.length.toLocaleString('en-US')} rows em ${durationMs} ms`,
      });
    } catch (error) {
      const message = extractErrorMessage(error, 'Erro ao executar SQL');
      console.error('runSql failed', error);

      dispatch({
        type: 'RUN_QUERY',
        payload: {
          id: `${now.getTime()}`,
          sql: state.queryText,
          ranAt: now.toISOString(),
          durationMs: Math.round(performance.now() - start),
          rows: 0,
          status: 'error',
          message,
        },
      });

      toast.error('Erro ao executar SQL', { description: message });
    }
  }, [
    getTauriClient,
    getEngine,
    loadTableData,
    state.activeObject,
    state.openStatus,
    state.page,
    state.pageSize,
    state.queryText,
  ]);

  useEffect(() => {
    (async () => {
      if (!isFileSystemAccessSupported()) {
        return;
      }

      const savedHandle = await loadLastFileHandle();

      if (!savedHandle) {
        return;
      }

      const canRead = await ensureReadPermission(savedHandle);

      if (!canRead) {
        return;
      }

      fileHandleRef.current = savedHandle;
      dispatch({
        type: 'SET_STATUS_MESSAGE',
        payload:
          'Arquivo anterior detectado. Clique em "Abrir .db" para recarregar.',
      });
    })().catch(() => {
      // Ignore auto-restore errors to keep startup resilient.
    });
  }, []);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      openDatabase,
      syncDatabaseToDisk,
      selectObject,
      setPage,
      runSql,
    }),
    [openDatabase, runSql, selectObject, setPage, state, syncDatabaseToDisk],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used inside SessionProvider');
  }

  return context;
}

export function useActiveTableData() {
  const {
    state: { activeTableData },
  } = useSession();

  return activeTableData;
}
