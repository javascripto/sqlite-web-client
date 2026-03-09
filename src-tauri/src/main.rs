#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod sqlite;

use sqlite::{
    list_objects, open_database, persist_current_database, query_table_page, run_sql, update_cell,
    AppState,
};

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            open_database,
            list_objects,
            query_table_page,
            run_sql,
            update_cell,
            persist_current_database,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
