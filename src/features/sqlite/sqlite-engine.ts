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
  identifier: {
    kind: 'primary-key' | 'rowid' | 'none';
    keyColumns: string[];
    hiddenColumn: string | null;
    updatableColumns: string[];
  };
}

type SqlValue = string | number | null;

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
    const identifier = await this.resolveRowIdentifier(tableName);
    const selectColumns =
      identifier.kind === 'rowid' && identifier.hiddenColumn
        ? `${quotedTable}.rowid AS ${quoteIdent(identifier.hiddenColumn)}, *`
        : '*';

    const dataRows = await this.execRows(
      `SELECT ${selectColumns} FROM ${quotedTable} LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    const columns =
      dataRows.length > 0
        ? Object.keys(dataRows[0]).filter(
            column => column !== identifier.hiddenColumn,
          )
        : await this.fetchColumns(tableName);

    const countRows = await this.execRows(
      `SELECT COUNT(*) AS count FROM ${quotedTable}`,
    );
    const totalRows = Number(countRows[0]?.count ?? 0);

    return {
      columns,
      rows: dataRows,
      totalRows,
      identifier,
    };
  }

  async runSql(sql: string) {
    return this.execRows(sql);
  }

  async updateCell(
    tableName: string,
    identifier: SqliteTablePage['identifier'],
    row: Record<string, SqlValue>,
    columnName: string,
    value: SqlValue,
  ) {
    const quotedTable = quoteIdent(tableName);
    const quotedColumn = quoteIdent(columnName);
    const setBind: Array<string | number | null> = [value];
    const whereClause = this.buildWhereClause(identifier, row, setBind);

    await this.execRows(
      `UPDATE ${quotedTable} SET ${quotedColumn} = ? WHERE ${whereClause}`,
      setBind,
    );
  }

  async insertRow(tableName: string, values: Record<string, SqlValue>) {
    const entries = Object.entries(values);
    const quotedTable = quoteIdent(tableName);

    if (entries.length === 0) {
      await this.execRows(`INSERT INTO ${quotedTable} DEFAULT VALUES`);
      return;
    }

    const columns = entries.map(([column]) => quoteIdent(column)).join(', ');
    const placeholders = entries.map(() => '?').join(', ');
    const bind = entries.map(([, value]) => value);

    await this.execRows(
      `INSERT INTO ${quotedTable} (${columns}) VALUES (${placeholders})`,
      bind,
    );
  }

  async deleteRow(
    tableName: string,
    identifier: SqliteTablePage['identifier'],
    row: Record<string, SqlValue>,
  ) {
    const quotedTable = quoteIdent(tableName);
    const bind: SqlValue[] = [];
    const whereClause = this.buildWhereClause(identifier, row, bind);

    await this.execRows(
      `DELETE FROM ${quotedTable} WHERE ${whereClause}`,
      bind,
    );
  }

  private async fetchColumns(tableName: string): Promise<string[]> {
    const quotedTable = quoteIdent(tableName);
    const pragmaRows = await this.execRows(`PRAGMA table_info(${quotedTable})`);

    return pragmaRows.map(row => String(row.name ?? ''));
  }

  private async resolveRowIdentifier(
    tableName: string,
  ): Promise<SqliteTablePage['identifier']> {
    const quotedTable = quoteIdent(tableName);
    const pragmaRows = await this.execRows(`PRAGMA table_info(${quotedTable})`);

    const primaryKeyColumns = pragmaRows
      .filter(row => Number(row.pk ?? 0) > 0)
      .sort((a, b) => Number(a.pk ?? 0) - Number(b.pk ?? 0))
      .map(row => String(row.name ?? ''))
      .filter(Boolean);

    const updatableColumns = pragmaRows
      .map(row => String(row.name ?? ''))
      .filter(Boolean);

    if (primaryKeyColumns.length > 0) {
      return {
        kind: 'primary-key',
        keyColumns: primaryKeyColumns,
        hiddenColumn: null,
        updatableColumns,
      };
    }

    try {
      await this.execRows(`SELECT rowid FROM ${quotedTable} LIMIT 1`);
      return {
        kind: 'rowid',
        keyColumns: ['__rowid__'],
        hiddenColumn: '__rowid__',
        updatableColumns,
      };
    } catch {
      return {
        kind: 'none',
        keyColumns: [],
        hiddenColumn: null,
        updatableColumns,
      };
    }
  }

  private buildWhereClause(
    identifier: SqliteTablePage['identifier'],
    row: Record<string, SqlValue>,
    bindValues: SqlValue[],
  ) {
    if (identifier.kind === 'none' || identifier.keyColumns.length === 0) {
      throw new Error(
        'Tabela sem chave primária ou rowid acessível. Edição não suportada.',
      );
    }

    return identifier.keyColumns
      .map(column => {
        if (!(column in row)) {
          throw new Error(`Coluna identificadora ausente na linha: ${column}`);
        }

        bindValues.push(row[column]);
        return identifier.kind === 'rowid'
          ? 'rowid = ?'
          : `${quoteIdent(column)} = ?`;
      })
      .join(' AND ');
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
