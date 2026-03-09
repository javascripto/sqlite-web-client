use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::{types::ValueRef, Connection};
use serde::Serialize;
use serde_json::{Map, Value};
use tauri::State;

#[derive(Default)]
pub struct AppState {
    pub db_path: Mutex<Option<PathBuf>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenDatabaseResult {
    pub database_name: String,
    pub sqlite_version: String,
}

#[derive(Serialize)]
pub struct DbObjectItem {
    pub name: String,
    pub r#type: String,
    pub estimated_rows: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TablePageResult {
    pub columns: Vec<String>,
    pub rows: Vec<Map<String, Value>>,
    pub total_rows: i64,
}

fn open_connection_from_state(state: &State<AppState>) -> Result<Connection, String> {
    let guard = state.db_path.lock().map_err(|_| "Failed to lock db path state".to_string())?;
    let path = guard
        .as_ref()
        .ok_or_else(|| "No database currently open".to_string())?;

    Connection::open(path).map_err(|e| format!("Failed to open database: {e}"))
}

fn sqlite_value_to_json(value: ValueRef<'_>) -> Value {
    match value {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(i) => Value::Number(i.into()),
        ValueRef::Real(f) => serde_json::Number::from_f64(f)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        ValueRef::Text(bytes) => Value::String(String::from_utf8_lossy(bytes).to_string()),
        ValueRef::Blob(bytes) => {
            let text = bytes.iter().map(|b| format!("{b:02x}")).collect::<String>();
            Value::String(text)
        }
    }
}

fn quote_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
}

#[tauri::command]
pub fn open_database(path: Option<String>, state: State<AppState>) -> Result<OpenDatabaseResult, String> {
    let selected_path = if let Some(path) = path {
        PathBuf::from(path)
    } else {
        rfd::FileDialog::new()
            .add_filter("SQLite", &["db", "sqlite", "sqlite3"])
            .pick_file()
            .ok_or_else(|| "Database selection canceled".to_string())?
    };

    let connection = Connection::open(&selected_path)
        .map_err(|e| format!("Failed to open selected database: {e}"))?;

    let sqlite_version: String = connection
        .query_row("SELECT sqlite_version()", [], |row| row.get(0))
        .map_err(|e| format!("Failed to get sqlite version: {e}"))?;

    {
        let mut guard = state
            .db_path
            .lock()
            .map_err(|_| "Failed to lock db path state".to_string())?;
        *guard = Some(selected_path.clone());
    }

    let database_name = selected_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| selected_path.to_string_lossy().to_string());

    Ok(OpenDatabaseResult {
        database_name,
        sqlite_version,
    })
}

#[tauri::command]
pub fn list_objects(state: State<AppState>) -> Result<Vec<DbObjectItem>, String> {
    let connection = open_connection_from_state(&state)?;

    let mut stmt = connection
        .prepare(
            "SELECT name, type
             FROM sqlite_master
             WHERE type IN ('table', 'view')
             ORDER BY name COLLATE NOCASE",
        )
        .map_err(|e| format!("Failed to prepare list_objects query: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            let name: String = row.get(0)?;
            let object_type: String = row.get(1)?;

            Ok(DbObjectItem {
                name,
                r#type: object_type,
                estimated_rows: None,
            })
        })
        .map_err(|e| format!("Failed to execute list_objects query: {e}"))?;

    let mut objects = Vec::new();
    for row in rows {
        objects.push(row.map_err(|e| format!("Failed to read list_objects row: {e}"))?);
    }

    Ok(objects)
}

#[tauri::command]
pub fn query_table_page(
    table_name: String,
    limit: u32,
    offset: u32,
    state: State<AppState>,
) -> Result<TablePageResult, String> {
    let connection = open_connection_from_state(&state)?;

    let quoted_table = quote_identifier(&table_name);
    let data_sql = format!("SELECT * FROM {quoted_table} LIMIT ?1 OFFSET ?2");

    let mut stmt = connection
        .prepare(&data_sql)
        .map_err(|e| format!("Failed to prepare table page query: {e}"))?;

    let column_names = stmt
        .column_names()
        .iter()
        .map(|name| name.to_string())
        .collect::<Vec<_>>();

    let mut rows_cursor = stmt
        .query([limit as i64, offset as i64])
        .map_err(|e| format!("Failed to execute table page query: {e}"))?;

    let mut rows_json = Vec::new();
    while let Some(row) = rows_cursor
        .next()
        .map_err(|e| format!("Failed to iterate table page rows: {e}"))?
    {
        let mut row_json = Map::new();
        for (index, column_name) in column_names.iter().enumerate() {
            let value = row
                .get_ref(index)
                .map_err(|e| format!("Failed to read row value: {e}"))?;
            row_json.insert(column_name.clone(), sqlite_value_to_json(value));
        }
        rows_json.push(row_json);
    }

    let count_sql = format!("SELECT COUNT(*) FROM {quoted_table}");
    let total_rows: i64 = connection
        .query_row(&count_sql, [], |row| row.get(0))
        .map_err(|e| format!("Failed to count rows: {e}"))?;

    Ok(TablePageResult {
        columns: column_names,
        rows: rows_json,
        total_rows,
    })
}

#[tauri::command]
pub fn run_sql(sql: String, state: State<AppState>) -> Result<Vec<Map<String, Value>>, String> {
    let connection = open_connection_from_state(&state)?;
    let sql_trimmed = sql.trim().to_lowercase();

    let is_query = sql_trimmed.starts_with("select")
        || sql_trimmed.starts_with("pragma")
        || sql_trimmed.starts_with("with")
        || sql_trimmed.starts_with("explain");

    if !is_query {
        connection
            .execute_batch(&sql)
            .map_err(|e| format!("Failed to execute SQL batch: {e}"))?;
        return Ok(Vec::new());
    }

    let mut stmt = connection
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare SQL query: {e}"))?;

    let column_names = stmt
        .column_names()
        .iter()
        .map(|name| name.to_string())
        .collect::<Vec<_>>();

    let mut rows_cursor = stmt
        .query([])
        .map_err(|e| format!("Failed to execute SQL query: {e}"))?;

    let mut rows_json = Vec::new();
    while let Some(row) = rows_cursor
        .next()
        .map_err(|e| format!("Failed to iterate SQL rows: {e}"))?
    {
        let mut row_json = Map::new();
        for (index, column_name) in column_names.iter().enumerate() {
            let value = row
                .get_ref(index)
                .map_err(|e| format!("Failed to read SQL row value: {e}"))?;
            row_json.insert(column_name.clone(), sqlite_value_to_json(value));
        }
        rows_json.push(row_json);
    }

    Ok(rows_json)
}

#[tauri::command]
pub fn persist_current_database(_state: State<AppState>) -> Result<(), String> {
    Ok(())
}
