use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

use crate::providers::StreamRequest;
use crate::orchestration::{Engine, WorkflowGraph};

// ─── State Types ────────────────────────────────────────────────────────────

#[derive(Default)]
pub struct AiState {
    pub api_keys: Mutex<HashMap<String, String>>,
    pub ollama_url: Mutex<String>,
}

#[derive(Default)]
pub struct RuntimeState {
    pub processes: Mutex<HashMap<String, tokio::process::Child>>,
    pub stdins: Mutex<HashMap<String, tokio::process::ChildStdin>>,
}

use retrieval_engine::RetrievalEngine;

#[derive(Default)]
pub struct SemanticState {
    pub engine: Mutex<RetrievalEngine>,
}

// ─── AI Streaming Commands ───────────────────────────────────────────────────

#[tauri::command]
pub async fn write_scratch_file(component_name: String, code: String, workspace_path: String) -> Result<String, String> {
    use std::path::PathBuf;
    use tokio::fs;

    let mut path = PathBuf::from(&workspace_path);
    path.push(".aether");
    path.push("artisan-runtime");
    path.push("generated");

    if !path.exists() {
        fs::create_dir_all(&path).await.map_err(|e| e.to_string())?;
    }

    path.push(format!("{}.tsx", component_name));
    fs::write(&path, code).await.map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn copy_to_workspace(scratch_path: String, workspace_path: String, component_name: String) -> Result<String, String> {
    use std::path::PathBuf;
    use tokio::fs;

    let mut target = PathBuf::from(&workspace_path);
    target.push("src");
    target.push("components");
    target.push("generated");

    if !target.exists() {
        fs::create_dir_all(&target).await.map_err(|e| e.to_string())?;
    }

    target.push(format!("{}.tsx", component_name));
    fs::copy(&scratch_path, &target).await.map_err(|e| e.to_string())?;

    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn scaffold_workspace_fs(workspace_path: String) -> Result<(), String> {
    use std::path::PathBuf;
    use tokio::fs;

    let base_path = PathBuf::from(&workspace_path).join(".aether");
    
    let dirs = vec![
        "agents",
        "workflows",
        "memory",
        "artifacts",
        "prompts",
        "indexes",
        "sessions",
        "runtime",
        "logs",
    ];

    if !base_path.exists() {
        fs::create_dir_all(&base_path).await.map_err(|e| e.to_string())?;
    }

    for dir in dirs {
        let dir_path = base_path.join(dir);
        if !dir_path.exists() {
            fs::create_dir_all(&dir_path).await.map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn start_workspace_indexer(
    workspace_path: String,
    engine: tauri::State<'_, std::sync::Arc<crate::orchestration::Engine>>,
) -> Result<(), String> {
    let indexer = crate::orchestration::Indexer::new(engine.event_bus.clone());
    indexer.start_watching(workspace_path)?;
    Ok(())
}

#[tauri::command]
pub async fn read_agent_memory(agent_id: String, workspace_path: String) -> Result<crate::orchestration::AgentMemory, String> {
    crate::orchestration::AgentMemory::load(&agent_id, &workspace_path).await
}

#[tauri::command]
pub async fn write_agent_memory(memory: crate::orchestration::AgentMemory, workspace_path: String) -> Result<(), String> {
    memory.save(&workspace_path).await
}

#[tauri::command]
pub async fn ai_chat_stream(
    app: AppHandle,
    state: State<'_, AiState>,
    request: StreamRequest,
    provider: String,
    api_key: Option<String>,
) -> Result<(), String> {
    let base_url = {
        let url = state.ollama_url.lock().unwrap();
        if url.is_empty() {
            "http://localhost:11434".to_string()
        } else {
            url.clone()
        }
    };

    match provider.as_str() {
        "ollama" => {
            crate::providers::ollama::stream_ollama(
                app,
                request.session_id,
                request.model,
                request.messages,
                request.temperature.unwrap_or(0.7),
                base_url,
            )
            .await
        }
        "openai" => {
            let key = api_key.or_else(|| {
                crate::keychain::retrieve_secret(provider.clone()).ok()
            }).unwrap_or_default();
            
            if key.is_empty() {
                return Err(format!("API Key is missing for cloud provider: {}", provider));
            }
            crate::providers::openai::stream_openai(
                app,
                request.session_id,
                request.model,
                request.messages,
                request.temperature.unwrap_or(0.7),
                key,
            )
            .await
        }
        "anthropic" => {
            let key = api_key.or_else(|| {
                crate::keychain::retrieve_secret(provider.clone()).ok()
            }).unwrap_or_default();
            
            if key.is_empty() {
                return Err(format!("API Key is missing for cloud provider: {}", provider));
            }
            crate::providers::anthropic::stream_anthropic(
                app,
                request.session_id,
                request.model,
                request.messages,
                request.temperature.unwrap_or(0.7),
                key,
            )
            .await
        }
        "gemini" => {
            let key = api_key.or_else(|| {
                crate::keychain::retrieve_secret(provider.clone()).ok()
            }).unwrap_or_default();

            if key.is_empty() {
                return Err("API Key is missing for Gemini provider".into());
            }
            crate::providers::gemini::stream_gemini(
                app,
                request.session_id,
                request.model,
                request.messages,
                request.temperature.unwrap_or(0.7),
                key,
            )
            .await
        }
        "openrouter" => {
            let key = api_key.or_else(|| {
                crate::keychain::retrieve_secret(provider.clone()).ok()
            }).unwrap_or_default();

            if key.is_empty() {
                return Err("API Key is missing for OpenRouter provider".into());
            }
            crate::providers::openrouter::stream_openrouter(
                app,
                request.session_id,
                request.model,
                request.messages,
                request.temperature.unwrap_or(0.7),
                key,
            )
            .await
        }
        _ => Err(format!("Provider '{}' not yet implemented", provider)),
    }
}

#[tauri::command]
pub async fn ollama_list_models(state: State<'_, AiState>) -> Result<serde_json::Value, String> {
    let base_url = {
        let url = state.ollama_url.lock().unwrap();
        if url.is_empty() {
            "http://localhost:11434".to_string()
        } else {
            url.clone()
        }
    };
    let models: Vec<serde_json::Value> = crate::providers::ollama::list_models(&base_url).await?;
    Ok(serde_json::json!({ "models": models }))
}

#[tauri::command]
pub async fn ollama_check_status(state: State<'_, AiState>) -> Result<bool, String> {
    let base_url = {
        let url = state.ollama_url.lock().unwrap();
        if url.is_empty() {
            "http://localhost:11434".to_string()
        } else {
            url.clone()
        }
    };
    Ok(crate::providers::ollama::check_status(&base_url).await)
}

// Removed set_api_key; use keychain::store_secret from frontend instead

#[tauri::command]
pub fn set_ollama_url(state: State<'_, AiState>, url: String) -> Result<(), String> {
    let mut current = state.ollama_url.lock().unwrap();
    *current = url;
    Ok(())
}

// ─── Filesystem Commands ─────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
    pub extension: Option<String>,
}

fn read_dir_recursive(path: &PathBuf, depth: u32) -> Vec<FileNode> {
    if depth > 12 {
        return vec![];
    }

    let mut nodes = vec![];
    let entries = match std::fs::read_dir(path) {
        Ok(e) => e,
        Err(_) => return nodes,
    };

    let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
    entries.sort_by(|a, b| {
        let a_dir = a.path().is_dir();
        let b_dir = b.path().is_dir();
        b_dir.cmp(&a_dir).then(a.file_name().cmp(&b.file_name()))
    });

    for entry in entries {
        let entry_path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and node_modules
        if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" {
            continue;
        }

        let is_dir = entry_path.is_dir();
        let extension = if is_dir {
            None
        } else {
            entry_path
                .extension()
                .and_then(|e| e.to_str())
                .map(|s| s.to_string())
        };

        let children = if is_dir {
            Some(read_dir_recursive(&entry_path, depth + 1))
        } else {
            None
        };

        nodes.push(FileNode {
            name,
            path: entry_path.to_string_lossy().to_string(),
            is_dir,
            children,
            extension,
        });
    }
    nodes
}

fn is_path_safe(path: &str) -> bool {
    let p = std::path::Path::new(path);
    !p.components().any(|c| matches!(c, std::path::Component::ParentDir))
}

#[tauri::command]
pub async fn fs_read_dir(path: String) -> Result<Vec<FileNode>, String> {
    if !is_path_safe(&path) { return Err("Path traversal detected".into()); }
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    Ok(read_dir_recursive(&path_buf, 0))
}

#[tauri::command]
pub async fn fs_read_file(path: String) -> Result<String, String> {
    if !is_path_safe(&path) { return Err("Path traversal detected".into()); }
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read '{}': {}", path, e))
}

#[tauri::command]
pub async fn fs_write_file(path: String, content: String) -> Result<(), String> {
    if !is_path_safe(&path) { return Err("Path traversal detected".into()); }
    let path_buf = PathBuf::from(&path);
    if let Some(parent) = path_buf.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory for '{}': {}", path, e))?;
    }
    std::fs::write(&path_buf, content).map_err(|e| format!("Failed to write '{}': {}", path, e))
}

#[tauri::command]
pub async fn fs_write_base64_file(path: String, content_base64: String) -> Result<(), String> {
    if !is_path_safe(&path) { return Err("Path traversal detected".into()); }
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(content_base64)
        .map_err(|e| format!("Failed to decode base64 content: {}", e))?;
    let path_buf = PathBuf::from(&path);
    if let Some(parent) = path_buf.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory for '{}': {}", path, e))?;
    }
    std::fs::write(&path_buf, bytes).map_err(|e| format!("Failed to write '{}': {}", path, e))
}

#[tauri::command]
pub async fn fs_create_dir(path: String) -> Result<(), String> {
    if !is_path_safe(&path) { return Err("Path traversal detected".into()); }
    let path_buf = PathBuf::from(&path);
    std::fs::create_dir_all(&path_buf)
        .map_err(|e| format!("Failed to create directory '{}': {}", path, e))
}

#[tauri::command]
pub async fn fs_delete(path: String) -> Result<(), String> {
    if !is_path_safe(&path) { return Err("Path traversal detected".into()); }
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if path_buf.is_dir() {
        std::fs::remove_dir_all(&path_buf)
            .map_err(|e| format!("Failed to delete directory '{}': {}", path, e))
    } else {
        std::fs::remove_file(&path_buf)
            .map_err(|e| format!("Failed to delete file '{}': {}", path, e))
    }
}

#[tauri::command]
pub async fn fs_rename(old_path: String, new_path: String) -> Result<(), String> {
    if !is_path_safe(&old_path) || !is_path_safe(&new_path) {
        return Err("Path traversal detected".into());
    }
    let old_buf = PathBuf::from(&old_path);
    let new_buf = PathBuf::from(&new_path);
    if let Some(parent) = new_buf.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory for target: {}", e))?;
    }
    std::fs::rename(&old_buf, &new_buf)
        .map_err(|e| format!("Failed to rename '{}' to '{}': {}", old_path, new_path, e))
}

#[tauri::command]
pub async fn execute_sandboxed_command(command: String) -> Result<String, String> {
    // Phase 11: Scope execution
    let parts: Vec<&str> = command.split_whitespace().collect();
    if parts.is_empty() {
        return Err("Empty command".into());
    }

    // Security boundary: prevent obvious path traversals and absolute paths targeting the root system.
    // For an enterprise production environment, this should wrap `docker run` or a Firecracker microVM.
    for arg in &parts[1..] {
        if arg.starts_with("/") || arg.starts_with("C:\\") || arg.contains("..") {
            log::warn!("Blocked sandboxed command containing forbidden path traversal: {}", command);
            return Err("Execution denied: Absolute paths and traversal are forbidden in sandbox.".into());
        }
    }

    #[cfg(target_os = "windows")]
    let mut process = tokio::process::Command::new("cmd");
    #[cfg(target_os = "windows")]
    process.args(["/C", &command]);

    #[cfg(not(target_os = "windows"))]
    let mut process = tokio::process::Command::new("sh");
    #[cfg(not(target_os = "windows"))]
    process.args(["-c", &command]);

    match process.output().await {
        Ok(output) => {
            if output.status.success() {
                Ok(String::from_utf8_lossy(&output.stdout).to_string())
            } else {
                Err(String::from_utf8_lossy(&output.stderr).to_string())
            }
        }
        Err(e) => Err(format!("Sandbox execution failed: {}", e)),
    }
}

use tokio::io::{AsyncBufReadExt, BufReader};
use std::process::Stdio;

#[tauri::command]
pub async fn execute_build_command(
    app: tauri::AppHandle,
    command: String,
    cwd: String,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut process = tokio::process::Command::new("cmd");
    #[cfg(target_os = "windows")]
    process.args(["/C", &command]);

    #[cfg(not(target_os = "windows"))]
    let mut process = tokio::process::Command::new("sh");
    #[cfg(not(target_os = "windows"))]
    process.args(["-c", &command]);

    process.current_dir(cwd);
    process.stdout(Stdio::piped());
    process.stderr(Stdio::piped());

    let mut child = process.spawn().map_err(|e| format!("Failed to spawn build process: {}", e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let app_clone = app.clone();
    let stdout_handle = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = app_clone.emit("build-log", line);
        }
    });

    let app_clone2 = app.clone();
    let stderr_handle = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = app_clone2.emit("build-log", line);
        }
    });

    let _ = tokio::join!(stdout_handle, stderr_handle);

    match child.wait().await {
        Ok(status) => {
            let _ = app.emit("build-log", format!("Build process exited with status: {}", status));
            Ok(())
        }
        Err(e) => {
            let err_msg = format!("Build process error: {}", e);
            let _ = app.emit("build-log", err_msg.clone());
            Err(err_msg)
        }
    }
}

// ─── Runtime Orchestration Commands ─────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuntimeStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub port: Option<u16>,
}

#[tauri::command]
pub async fn runtime_start(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    workspace_path: String,
    command: String,
    session_id: String,
) -> Result<RuntimeStatus, String> {
    let event_name = format!("runtime_log_{}", session_id);

    if command.trim().is_empty() {
        return Err("Empty command".into());
    }

    // Stop and clean up any pre-existing running process for this session to prevent leaks and port locking
    {
        let mut processes = state.processes.lock().unwrap();
        if let Some(mut child) = processes.remove(&session_id) {
            #[cfg(target_os = "windows")]
            {
                if let Some(pid) = child.id() {
                    let _ = std::process::Command::new("taskkill")
                        .args(&["/F", "/T", "/PID", &pid.to_string()])
                        .spawn();
                }
            }
            let _ = child.start_kill();
        }
    }

    app.emit(
        &event_name,
        serde_json::json!({
            "type": "system",
            "message": format!("Starting: {} in {}", command, workspace_path)
        }),
    )
    .ok();

    #[cfg(target_os = "windows")]
    let mut process = tokio::process::Command::new("cmd")
        .arg("/C")
        .arg(&command)
        .current_dir(&workspace_path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start '{}' via cmd.exe: {}", command, e))?;

    #[cfg(not(target_os = "windows"))]
    let mut process = tokio::process::Command::new("sh")
        .arg("-c")
        .arg(&command)
        .current_dir(&workspace_path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start '{}' via sh: {}", command, e))?;

    let pid = process.id();
    let status = RuntimeStatus {
        running: true,
        pid,
        port: Some(5173),
    };

    // Spawn background task to stream stdout
    let app_clone = app.clone();
    let evt = event_name.clone();
    if let Some(stdout) = process.stdout.take() {
        tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                app_clone
                    .emit(
                        &evt,
                        serde_json::json!({
                            "type": "stdout",
                            "message": line
                        }),
                    )
                    .ok();
            }
        });
    }

    // Spawn background task to stream stderr
    let app_clone2 = app.clone();
    let evt2 = event_name.clone();
    if let Some(stderr) = process.stderr.take() {
        tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                app_clone2
                    .emit(
                        &evt2,
                        serde_json::json!({
                            "type": "stderr",
                            "message": line
                        }),
                    )
                    .ok();
            }
        });
    }

    // Store the process in the registry
    {
        let mut processes = state.processes.lock().unwrap();
        processes.insert(session_id, process);
    }

    Ok(status)
}

#[tauri::command]
pub async fn execute_workflow(
    graph: WorkflowGraph,
    engine: tauri::State<'_, std::sync::Arc<Engine>>
) -> Result<(), String> {
    // We clone the Arc and spawn the execution so the Tauri command returns immediately
    let engine = engine.inner().clone();
    tokio::spawn(async move {
        engine.execute_graph(graph).await;
    });
    Ok(())
}

#[tauri::command]
pub async fn terminal_spawn(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    workspace_path: String,
    session_id: String,
) -> Result<(), String> {
    let event_name = format!("runtime_log_{}", session_id);

    // Stop and clean up any pre-existing running process for this session to prevent leaks
    {
        let mut processes = state.processes.lock().unwrap();
        let mut stdins = state.stdins.lock().unwrap();
        stdins.remove(&session_id);
        if let Some(mut child) = processes.remove(&session_id) {
            #[cfg(target_os = "windows")]
            {
                if let Some(pid) = child.id() {
                    let _ = std::process::Command::new("taskkill")
                        .args(&["/F", "/T", "/PID", &pid.to_string()])
                        .spawn();
                }
            }
            let _ = child.start_kill();
        }
    }

    app.emit(
        &event_name,
        serde_json::json!({
            "type": "system",
            "message": format!("Initializing terminal shell in: {}", workspace_path)
        }),
    )
    .ok();

    #[cfg(target_os = "windows")]
    let mut cmd = tokio::process::Command::new("powershell.exe");
    #[cfg(target_os = "windows")]
    cmd.args(&["-NoLogo", "-NoExit"]);

    #[cfg(not(target_os = "windows"))]
    let mut cmd = tokio::process::Command::new("bash");
    #[cfg(not(target_os = "windows"))]
    cmd.arg("-i");

    let mut child = cmd
        .current_dir(&workspace_path)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn terminal shell: {}", e))?;

    let stdin = child.stdin.take().ok_or("Failed to open terminal stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to open terminal stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to open terminal stderr")?;

    {
        let mut processes = state.processes.lock().unwrap();
        let mut stdins = state.stdins.lock().unwrap();
        processes.insert(session_id.clone(), child);
        stdins.insert(session_id.clone(), stdin);
    }

    // Stream stdout
    let app_clone = app.clone();
    let evt = event_name.clone();
    tokio::spawn(async move {
        use tokio::io::{AsyncBufReadExt, BufReader};
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            app_clone
                .emit(
                    &evt,
                    serde_json::json!({
                        "type": "stdout",
                        "message": line
                    }),
                )
                .ok();
        }
    });

    // Stream stderr
    let app_clone2 = app.clone();
    let evt2 = event_name.clone();
    tokio::spawn(async move {
        use tokio::io::{AsyncBufReadExt, BufReader};
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            app_clone2
                .emit(
                    &evt2,
                    serde_json::json!({
                        "type": "stderr",
                        "message": line
                    }),
                )
                .ok();
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn terminal_send_input(
    state: State<'_, RuntimeState>,
    session_id: String,
    input: String,
) -> Result<(), String> {
    use tokio::io::AsyncWriteExt;
    
    // 1. Remove stdin from the registry to write to it without holding the mutex lock
    let mut stdin = {
        let mut stdins = state.stdins.lock().unwrap();
        stdins.remove(&session_id).ok_or_else(|| "No active terminal session stdin found")?
    };

    // 2. Perform the async write and flush operations
    let res = async {
        stdin.write_all(format!("{}\n", input).as_bytes()).await?;
        stdin.flush().await?;
        Ok::<_, std::io::Error>(stdin)
    }.await;

    // 3. Put it back in the registry and handle the result
    match res {
        Ok(stdin) => {
            let mut stdins = state.stdins.lock().unwrap();
            stdins.insert(session_id, stdin);
            Ok(())
        }
        Err(e) => {
            Err(format!("Failed to write to terminal stdin: {}", e))
        }
    }
}

#[tauri::command]
pub async fn runtime_stop(state: State<'_, RuntimeState>, session_id: String) -> Result<(), String> {
    let mut processes = state.processes.lock().unwrap();
    let mut stdins = state.stdins.lock().unwrap();
    stdins.remove(&session_id);
    if let Some(mut child) = processes.remove(&session_id) {
        #[cfg(target_os = "windows")]
        {
            if let Some(pid) = child.id() {
                // Recursively kill the entire process tree (e.g. nested node/npm calls)
                let _ = std::process::Command::new("taskkill")
                    .args(&["/F", "/T", "/PID", &pid.to_string()])
                    .spawn();
            }
        }

        // Attempt to forcefully kill the main spawner process
        if let Err(e) = child.start_kill() {
            log::error!("Failed to kill process {}: {}", session_id, e);
            return Err(format!("Failed to kill process: {}", e));
        }
        log::info!("Runtime stop successful for session: {}", session_id);
    } else {
        log::warn!("Runtime stop requested but no process found for session: {}", session_id);
    }
    Ok(())
}

// ─── Semantic Engine Commands ───────────────────────────────────────────────

#[tauri::command]
pub async fn semantic_index_workspace(
    state: State<'_, SemanticState>,
    workspace_path: String,
) -> Result<(), String> {
    let mut engine = state.engine.lock().map_err(|_| "Mutex lock failed")?;
    let path = std::path::Path::new(&workspace_path);
    engine.index_directory(path).map_err(|e| format!("Indexing failed: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn semantic_query_symbols(
    state: State<'_, SemanticState>,
    query: String,
) -> Result<Vec<symbol_graph::Symbol>, String> {
    let engine = state.engine.lock().map_err(|_| "Mutex lock failed")?;
    // Exact match for now
    let results: Vec<symbol_graph::Symbol> = engine.find_symbol(&query).into_iter().cloned().collect();
    Ok(results)
}
