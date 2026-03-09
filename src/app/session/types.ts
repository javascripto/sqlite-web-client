export type DbObjectType = 'table' | 'view';

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

export interface TableData {
  columns: string[];
  rows: DataRow[];
  totalRows: number;
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
  activeTableData: TableData | null;
  isLoadingTableData: boolean;
  isOpeningDatabase: boolean;
  importProgress: number | null;
  statusMessage: string | null;
  isExplorerVisible: boolean;
  isSqlConsoleVisible: boolean;
}
