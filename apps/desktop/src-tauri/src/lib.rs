mod commands;
mod providers;
mod orchestration;

use commands::{AiState, RuntimeState, SemanticState};
use orchestration::{Engine, EventBus, spawn_event_forwarder};
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize Orchestration Engine
            let (event_bus, receiver) = EventBus::new();
            let event_bus = Arc::new(event_bus);
            let engine = Arc::new(Engine::new(event_bus.clone()));

            app.manage(engine);
            spawn_event_forwarder(app.handle().clone(), receiver);

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AiState::default())
        .manage(RuntimeState::default())
        .manage(SemanticState::default())
        .invoke_handler(tauri::generate_handler![
            // AI streaming
            commands::ai_chat_stream,
            commands::ollama_list_models,
            commands::ollama_check_status,
            commands::set_api_key,
            commands::set_ollama_url,
            // Filesystem
            commands::fs_read_dir,
            commands::fs_read_file,
            commands::fs_write_file,
            commands::fs_write_base64_file,
            commands::execute_sandboxed_command,
            // Runtime
            commands::runtime_start,
            commands::runtime_stop,
            // Semantic Engine
            commands::semantic_index_workspace,
            commands::semantic_query_symbols,
            // Orchestration
            commands::execute_workflow,
            // Artisan
            commands::write_scratch_file,
            commands::copy_to_workspace,
            commands::scaffold_workspace_fs,
            commands::start_workspace_indexer,
            commands::read_agent_memory,
            commands::write_agent_memory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
