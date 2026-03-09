import type {
  SqliteObjectItem,
  SqliteTablePage,
} from '@/features/sqlite/sqlite-engine';

interface OpenDatabaseResult {
  databaseName: string;
  sqliteVersion: string;
}

type TauriInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

async function getInvoke(): Promise<TauriInvoke> {
  const tauriCore = await import('@tauri-apps/api/core');
  return tauriCore.invoke as TauriInvoke;
}

export function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export class TauriSqliteClient {
  async openDatabase(path?: string): Promise<OpenDatabaseResult> {
    const invoke = await getInvoke();
    return invoke<OpenDatabaseResult>('open_database', {
      path: path ?? null,
    });
  }

  async listObjects(): Promise<SqliteObjectItem[]> {
    const invoke = await getInvoke();
    return invoke<SqliteObjectItem[]>('list_objects');
  }

  async queryTablePage(
    tableName: string,
    limit: number,
    offset: number,
  ): Promise<SqliteTablePage> {
    const invoke = await getInvoke();
    return invoke<SqliteTablePage>('query_table_page', {
      tableName,
      limit,
      offset,
    });
  }

  async runSql(sql: string) {
    const invoke = await getInvoke();
    return invoke<Record<string, string | number | null>[]>('run_sql', { sql });
  }

  async persistCurrentDatabase() {
    const invoke = await getInvoke();
    return invoke<void>('persist_current_database');
  }
}
