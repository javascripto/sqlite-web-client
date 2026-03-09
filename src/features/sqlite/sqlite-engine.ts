import * as sqliteWasm from '@sqlite.org/sqlite-wasm';

export interface SqliteOpenResult {
  dbId: string;
  filename: string;
  version: string;
}

export interface SqliteObjectItem {
  name: string;
  type: 'table' | 'view';
}

export interface SqliteTablePage {
  columns: string[];
  rows: Record<string, string | number | null>[];
  totalRows: number;
}

type WorkerResponse = Record<string, unknown>;

type WorkerPromiser = (
  type: string,
  args?: Record<string, unknown> | string,
) => Promise<WorkerResponse>;

const sqlite3Worker1Promiser = (
  sqliteWasm as unknown as {
    sqlite3Worker1Promiser: (config: { onready: () => void }) => WorkerPromiser;
  }
).sqlite3Worker1Promiser;

function quoteIdent(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function unwrapResult<T>(response: WorkerResponse): T {
  if ('result' in response) {
    return response.result as T;
  }

  return response as T;
}

export class SqliteEngine {
  private promiser: WorkerPromiser | null = null;
  private dbId: string | null = null;

  async init() {
    if (this.promiser) {
      return;
    }

    this.promiser = await new Promise<WorkerPromiser>(resolve => {
      const workerPromiser = sqlite3Worker1Promiser({
        onready: () => resolve(workerPromiser),
      });
    });
  }

  async openOpfsDatabase(opfsFilename: string): Promise<SqliteOpenResult> {
    await this.init();

    if (!this.promiser) {
      throw new Error('SQLite worker is not available');
    }

    const filename = `file:${opfsFilename}?vfs=opfs`;

    const versionResponse = await this.promiser('config-get', {});
    const versionResult = unwrapResult<{ version: { libVersion: string } }>(
      versionResponse,
    );

    const openResponse = await this.promiser('open', { filename });
    const openResult = unwrapResult<{ filename: string; dbId?: string }>(
      openResponse,
    );

    this.dbId = String(openResponse.dbId ?? openResult.dbId ?? '');

    if (!this.dbId) {
      throw new Error('SQLite worker did not return a valid dbId');
    }

    return {
      dbId: this.dbId,
      filename: openResult.filename,
      version: versionResult.version.libVersion,
    };
  }

  async close() {
    if (!this.promiser || !this.dbId) {
      return;
    }

    await this.promiser('close', { dbId: this.dbId });
    this.dbId = null;
  }

  async listObjects(): Promise<SqliteObjectItem[]> {
    const rows = await this.execRows(
      `SELECT name, type
       FROM sqlite_master
       WHERE type IN ('table','view')
       ORDER BY name COLLATE NOCASE`,
    );

    return rows
      .map(row => {
        const rawType = String(row.type ?? '');

        return {
          name: String(row.name ?? ''),
          type:
            rawType === 'view'
              ? ('view' as const)
              : rawType === 'table'
                ? ('table' as const)
                : null,
        };
      })
      .filter(
        (row): row is SqliteObjectItem =>
          row.name.length > 0 && row.type !== null,
      );
  }

  async queryTablePage(
    tableName: string,
    limit: number,
    offset: number,
  ): Promise<SqliteTablePage> {
    const quotedTable = quoteIdent(tableName);

    const dataRows = await this.execRows(
      `SELECT * FROM ${quotedTable} LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    const columns =
      dataRows.length > 0
        ? Object.keys(dataRows[0])
        : await this.fetchColumns(tableName);

    const countRows = await this.execRows(
      `SELECT COUNT(*) AS count FROM ${quotedTable}`,
    );
    const totalRows = Number(countRows[0]?.count ?? 0);

    return {
      columns,
      rows: dataRows,
      totalRows,
    };
  }

  async runSql(sql: string) {
    return this.execRows(sql);
  }

  private async fetchColumns(tableName: string): Promise<string[]> {
    const quotedTable = quoteIdent(tableName);
    const pragmaRows = await this.execRows(`PRAGMA table_info(${quotedTable})`);

    return pragmaRows.map(row => String(row.name ?? ''));
  }

  private async execRows(
    sql: string,
    bind?: Array<string | number | null>,
  ): Promise<Record<string, string | number | null>[]> {
    if (!this.promiser || !this.dbId) {
      throw new Error('No database is currently open');
    }

    const execResponse = await this.promiser('exec', {
      dbId: this.dbId,
      sql,
      bind,
      rowMode: 'object',
      returnValue: 'resultRows',
      resultRows: [],
    });

    const execResult = unwrapResult<{
      resultRows?: Record<string, string | number | null>[];
    }>(execResponse);

    return execResult.resultRows ?? [];
  }
}
