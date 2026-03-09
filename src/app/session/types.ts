export type DbObjectType = 'table' | 'view';
export type BackendPreference = 'auto' | 'browser' | 'tauri';
export type ActiveBackend = 'browser' | 'tauri' | null;

export interface DbObjectItem {
  name: string;
  type: DbObjectType;
  estimatedRows: number | null;
}

export interface QueryLogItem {
  id: string;
  sql: string;
  ranAt: string;
  durationMs: number;
  rows: number;
  status: 'ok' | 'error';
  message?: string;
}

export type DataRow = Record<string, string | number | null>;

export interface RowIdentifier {
  kind: 'primary-key' | 'rowid' | 'none';
  keyColumns: string[];
  hiddenColumn: string | null;
  updatableColumns: string[];
}

export interface TableData {
  columns: string[];
  rows: DataRow[];
  totalRows: number;
  identifier: RowIdentifier;
}

export type TableDataset = Record<string, TableData>;

export interface SessionState {
  databaseName: string | null;
  sqliteVersion: string | null;
  openStatus: 'idle' | 'ready' | 'error';
  backendPreference: BackendPreference;
  activeBackend: ActiveBackend;
  isReadOnly: boolean;
  canUseTauri: boolean;
  objects: DbObjectItem[];
  activeObject: string | null;
  explorerSearch: string;
  queryText: string;
  queryLog: QueryLogItem[];
  page: number;
  pageSize: number;
  selectedRowIndex: number | null;
  activeTableData: TableData | null;
  isLoadingTableData: boolean;
  isOpeningDatabase: boolean;
  importProgress: number | null;
  statusMessage: string | null;
  isExplorerVisible: boolean;
  isSqlConsoleVisible: boolean;
}
