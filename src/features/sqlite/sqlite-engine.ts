import * as sqliteWasm from '@sqlite.org/sqlite-wasm';

export interface SqliteOpenResult {
  dbId: string;
  filename: string;
  version: string;
  vfs: string;
  readOnly: boolean;
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

function extractWorkerErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string') {
      return record.message;
    }
    if (
      record.result &&
      typeof record.result === 'object' &&
      typeof (record.result as Record<string, unknown>).message === 'string'
    ) {
      return (record.result as Record<string, unknown>).message as string;
    }
  }

  return 'Unknown SQLite worker error';
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

    const versionResponse = await this.promiser('config-get', {});
    const versionResult = unwrapResult<{
      version: { libVersion: string };
      vfsList?: string[] | string;
    }>(versionResponse);

    const normalizedName = opfsFilename.replace(/^\/+/, '');
    const vfsList = Array.isArray(versionResult.vfsList)
      ? versionResult.vfsList
      : typeof versionResult.vfsList === 'string'
        ? versionResult.vfsList.split(',').map(item => item.trim())
        : [];

    const candidateOpens: Array<{
      args: Record<string, unknown>;
      label: string;
      readOnly: boolean;
    }> = [
      {
        args: { filename: normalizedName, vfs: 'opfs' },
        label: `filename=${normalizedName},vfs=opfs`,
        readOnly: false,
      },
      {
        args: { filename: `/${normalizedName}`, vfs: 'opfs' },
        label: `filename=/${normalizedName},vfs=opfs`,
        readOnly: false,
      },
      {
        args: { filename: `file:${normalizedName}?vfs=opfs` },
        label: `uri=file:${normalizedName}?vfs=opfs`,
        readOnly: false,
      },
      {
        args: { filename: `file:/${normalizedName}?vfs=opfs` },
        label: `uri=file:/${normalizedName}?vfs=opfs`,
        readOnly: false,
      },
      {
        args: { filename: `file:${normalizedName}?vfs=opfs&mode=ro` },
        label: `uri=file:${normalizedName}?vfs=opfs&mode=ro`,
        readOnly: true,
      },
      {
        args: { filename: `file:/${normalizedName}?vfs=opfs&mode=ro` },
        label: `uri=file:/${normalizedName}?vfs=opfs&mode=ro`,
        readOnly: true,
      },
      {
        args: { filename: `file:${normalizedName}?vfs=opfs&immutable=1` },
        label: `uri=file:${normalizedName}?vfs=opfs&immutable=1`,
        readOnly: true,
      },
      {
        args: { filename: `file:/${normalizedName}?vfs=opfs&immutable=1` },
        label: `uri=file:/${normalizedName}?vfs=opfs&immutable=1`,
        readOnly: true,
      },
    ];

    if (vfsList.includes('opfs-sahpool')) {
      candidateOpens.unshift({
        args: { filename: normalizedName, vfs: 'opfs-sahpool' },
        label: `filename=${normalizedName},vfs=opfs-sahpool`,
        readOnly: false,
      });
    }

    let lastErrorMessage = 'Unknown open error';
    let openResult: { filename: string; dbId?: string; vfs?: string } | null =
      null;

    for (const candidate of candidateOpens) {
      try {
        const openResponse = await this.promiser('open', candidate.args);
        openResult = unwrapResult<{
          filename: string;
          dbId?: string;
          vfs?: string;
        }>(openResponse);
        this.dbId = String(openResponse.dbId ?? openResult.dbId ?? '');

        if (!this.dbId) {
          throw new Error('SQLite worker did not return a valid dbId');
        }

        return {
          dbId: this.dbId,
          filename: openResult.filename,
          version: versionResult.version.libVersion,
          vfs: String(
            openResult.vfs ??
              (candidate.args.vfs as string | undefined) ??
              'opfs',
          ),
          readOnly: candidate.readOnly,
        };
      } catch (error) {
        lastErrorMessage = `${extractWorkerErrorMessage(error)} [${candidate.label}]`;
      }
    }

    throw new Error(
      `Não foi possível abrir o DB no worker SQLite. Último erro: ${lastErrorMessage}`,
    );
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
