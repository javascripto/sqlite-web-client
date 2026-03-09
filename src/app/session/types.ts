export type DbObjectType = 'table' | 'view';

export interface DbObjectItem {
  name: string;
  type: DbObjectType;
  estimatedRows: number;
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

export interface TableData {
  columns: string[];
  rows: DataRow[];
}

export type TableDataset = Record<string, TableData>;

export interface SessionState {
  databaseName: string | null;
  sqliteVersion: string | null;
  openStatus: 'idle' | 'ready' | 'error';
  objects: DbObjectItem[];
  activeObject: string | null;
  explorerSearch: string;
  queryText: string;
  queryLog: QueryLogItem[];
  page: number;
  pageSize: number;
  selectedRowIndex: number | null;
  isExplorerVisible: boolean;
  isSqlConsoleVisible: boolean;
}
