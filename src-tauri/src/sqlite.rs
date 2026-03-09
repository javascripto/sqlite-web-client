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
pub struct RowIdentifier {
    pub kind: String,
    pub key_columns: Vec<String>,
    pub hidden_column: Option<String>,
    pub updatable_columns: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TablePageResult {
    pub columns: Vec<String>,
    pub rows: Vec<Map<String, Value>>,
    pub total_rows: i64,
    pub identifier: RowIdentifier,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCellRequest {
    pub table_name: String,
    pub column_name: String,
    pub value: Value,
    pub row: Map<String, Value>,
    pub identifier: RowIdentifierPayload,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RowIdentifierPayload {
    pub kind: String,
    pub key_columns: Vec<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InsertRowRequest {
    pub table_name: String,
    pub values: Map<String, Value>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRowRequest {
    pub table_name: String,
    pub row: Map<String, Value>,
    pub identifier: RowIdentifierPayload,
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

fn json_to_rusqlite_value(value: &Value) -> rusqlite::types::Value {
    match value {
        Value::Null => rusqlite::types::Value::Null,
        Value::Bool(boolean) => rusqlite::types::Value::Integer(if *boolean { 1 } else { 0 }),
        Value::Number(number) => {
            if let Some(integer) = number.as_i64() {
                rusqlite::types::Value::Integer(integer)
            } else if let Some(float) = number.as_f64() {
                rusqlite::types::Value::Real(float)
            } else {
                rusqlite::types::Value::Null
            }
        }
        Value::String(text) => rusqlite::types::Value::Text(text.clone()),
        Value::Array(_) | Value::Object(_) => rusqlite::types::Value::Text(value.to_string()),
    }
}

fn resolve_row_identifier(connection: &Connection, table_name: &str) -> Result<RowIdentifier, String> {
    let quoted_table = quote_identifier(table_name);
    let mut stmt = connection
        .prepare(&format!("PRAGMA table_info({quoted_table})"))
        .map_err(|e| format!("Failed to prepare table_info query: {e}"))?;

    let pragma_rows = stmt
        .query_map([], |row| {
            let name: String = row.get(1)?;
            let pk: i64 = row.get(5)?;
            Ok((name, pk))
        })
        .map_err(|e| format!("Failed to execute table_info query: {e}"))?;

    let mut columns = Vec::new();
    let mut primary_keys = Vec::new();

    for row in pragma_rows {
        let (name, pk) = row.map_err(|e| format!("Failed to read table_info row: {e}"))?;
        columns.push(name.clone());
        if pk > 0 {
            primary_keys.push((pk, name));
        }
    }

    primary_keys.sort_by_key(|(pk, _)| *pk);

    if !primary_keys.is_empty() {
        return Ok(RowIdentifier {
            kind: "primary-key".into(),
            key_columns: primary_keys.into_iter().map(|(_, name)| name).collect(),
            hidden_column: None,
            updatable_columns: columns,
        });
    }

    let rowid_probe = connection.query_row(
        &format!("SELECT rowid FROM {quoted_table} LIMIT 1"),
        [],
        |row| row.get::<_, i64>(0),
    );

    if rowid_probe.is_ok() {
        return Ok(RowIdentifier {
            kind: "rowid".into(),
            key_columns: vec!["__rowid__".into()],
            hidden_column: Some("__rowid__".into()),
            updatable_columns: columns,
        });
    }

    Ok(RowIdentifier {
        kind: "none".into(),
        key_columns: Vec::new(),
        hidden_column: None,
        updatable_columns: columns,
    })
}

fn build_where_clause(
    identifier: &RowIdentifierPayload,
    row: &Map<String, Value>,
    params: &mut Vec<rusqlite::types::Value>,
) -> Result<String, String> {
    if identifier.kind == "none" || identifier.key_columns.is_empty() {
        return Err("Table without primary key or accessible rowid. Editing is not supported.".into());
    }

    let mut clauses = Vec::new();
    for key in &identifier.key_columns {
        let row_value = row
            .get(key)
            .ok_or_else(|| format!("Missing key column in row payload: {key}"))?;
        params.push(json_to_rusqlite_value(row_value));
        clauses.push(if identifier.kind == "rowid" {
            "rowid = ?".to_string()
        } else {
            format!("{} = ?", quote_identifier(key))
        });
    }

    Ok(clauses.join(" AND "))
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
    let identifier = resolve_row_identifier(&connection, &table_name)?;

    let quoted_table = quote_identifier(&table_name);
    let data_sql = if identifier.kind == "rowid" {
        format!("SELECT rowid AS \"__rowid__\", * FROM {quoted_table} LIMIT ?1 OFFSET ?2")
    } else {
        format!("SELECT * FROM {quoted_table} LIMIT ?1 OFFSET ?2")
    };

    let mut stmt = connection
        .prepare(&data_sql)
        .map_err(|e| format!("Failed to prepare table page query: {e}"))?;

    let all_column_names = stmt
        .column_names()
        .iter()
        .map(|name| name.to_string())
        .collect::<Vec<_>>();
    let column_names = all_column_names
        .iter()
        .filter(|name| Some((*name).clone()) != identifier.hidden_column)
        .cloned()
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
        for (index, column_name) in all_column_names.iter().enumerate() {
            if Some(column_name.clone()) == identifier.hidden_column {
                continue;
            }

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
        identifier,
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
pub fn update_cell(payload: UpdateCellRequest, state: State<AppState>) -> Result<(), String> {
    let connection = open_connection_from_state(&state)?;

    let quoted_table = quote_identifier(&payload.table_name);
    let quoted_column = quote_identifier(&payload.column_name);

    let mut params = vec![json_to_rusqlite_value(&payload.value)];
    let where_clause = build_where_clause(&payload.identifier, &payload.row, &mut params)?;

    let sql = format!(
        "UPDATE {quoted_table} SET {quoted_column} = ? WHERE {}",
        where_clause
    );

    connection
        .execute(&sql, rusqlite::params_from_iter(params))
        .map_err(|e| format!("Failed to update cell: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn insert_row(payload: InsertRowRequest, state: State<AppState>) -> Result<(), String> {
    let connection = open_connection_from_state(&state)?;
    let quoted_table = quote_identifier(&payload.table_name);

    if payload.values.is_empty() {
        let sql = format!("INSERT INTO {quoted_table} DEFAULT VALUES");
        connection
            .execute(&sql, [])
            .map_err(|e| format!("Failed to insert row: {e}"))?;
        return Ok(());
    }

    let entries = payload.values.iter().collect::<Vec<_>>();
    let columns = entries
        .iter()
        .map(|(key, _)| quote_identifier(key))
        .collect::<Vec<_>>()
        .join(", ");
    let placeholders = entries.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let params = entries
        .into_iter()
        .map(|(_, value)| json_to_rusqlite_value(value))
        .collect::<Vec<_>>();

    let sql = format!("INSERT INTO {quoted_table} ({columns}) VALUES ({placeholders})");
    connection
        .execute(&sql, rusqlite::params_from_iter(params))
        .map_err(|e| format!("Failed to insert row: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn delete_row(payload: DeleteRowRequest, state: State<AppState>) -> Result<(), String> {
    let connection = open_connection_from_state(&state)?;
    let quoted_table = quote_identifier(&payload.table_name);
    let mut params = Vec::new();
    let where_clause = build_where_clause(&payload.identifier, &payload.row, &mut params)?;
    let sql = format!("DELETE FROM {quoted_table} WHERE {where_clause}");

    connection
        .execute(&sql, rusqlite::params_from_iter(params))
        .map_err(|e| format!("Failed to delete row: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn persist_current_database(_state: State<AppState>) -> Result<(), String> {
    Ok(())
}
