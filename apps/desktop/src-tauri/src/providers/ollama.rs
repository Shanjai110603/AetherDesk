use futures_util::StreamExt;
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use crate::providers::{ChatMessage, StreamEvent};

/// Ollama streaming response chunk (single line of NDJSON)
#[derive(Debug, Deserialize)]
struct OllamaChunk {
    message: Option<OllamaMessage>,
    done: bool,
    #[serde(rename = "eval_count")]
    eval_count: Option<u64>,
    #[serde(rename = "prompt_eval_count")]
    prompt_eval_count: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct OllamaMessage {
    content: String,
}

/// Stream from Ollama and emit normalized `StreamEvent`s on `session_id` channel
pub async fn stream_ollama(
    app: AppHandle,
    session_id: String,
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f64,
    base_url: String,
) -> Result<(), String> {
    let client = Client::new();
    let event_name = format!("ai_stream_{}", session_id);

    // Signal start
    app.emit(
        &event_name,
        StreamEvent::Started {
            model: model.clone(),
        },
    )
    .map_err(|e| e.to_string())?;

    let start_time = std::time::Instant::now();

    let body = json!({
        "model": model,
        "messages": messages.iter().map(|m| json!({ "role": m.role, "content": m.content })).collect::<Vec<_>>(),
        "stream": true,
        "options": { "temperature": temperature }
    });

    let response = client
        .post(format!("{}/api/chat", base_url))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama connection failed: {}. Is Ollama running?", e))?;

    if !response.status().is_success() {
        let err_msg = format!("Ollama returned HTTP {}", response.status());
        app.emit(
            &event_name,
            StreamEvent::Error {
                code: "HTTP_ERROR".into(),
                message: err_msg.clone(),
            },
        )
        .ok();
        return Err(err_msg);
    }

    let mut byte_stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut total_tokens: u64 = 0;
    let mut prompt_tokens: u64 = 0;

    while let Some(chunk_result) = byte_stream.next().await {
        let chunk = chunk_result.map_err(|e| e.to_string())?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process complete lines (Ollama sends NDJSON)
        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            if let Ok(ollama_chunk) = serde_json::from_str::<OllamaChunk>(&line) {
                if let Some(msg) = &ollama_chunk.message {
                    if !msg.content.is_empty() {
                        app.emit(
                            &event_name,
                            StreamEvent::Token {
                                content: msg.content.clone(),
                            },
                        )
                        .map_err(|e| e.to_string())?;
                    }
                }

                if ollama_chunk.done {
                    total_tokens = ollama_chunk.eval_count.unwrap_or(0);
                    prompt_tokens = ollama_chunk.prompt_eval_count.unwrap_or(0);

                    let elapsed = start_time.elapsed().as_millis() as u64;
                    let tps = if elapsed > 0 {
                        total_tokens as f64 / (elapsed as f64 / 1000.0)
                    } else {
                        0.0
                    };

                    app.emit(
                        &event_name,
                        StreamEvent::Telemetry {
                            inference_ms: elapsed,
                            tokens_per_sec: tps,
                        },
                    )
                    .ok();

                    app.emit(
                        &event_name,
                        StreamEvent::Completed {
                            model: model.clone(),
                            total_tokens: Some(total_tokens),
                            prompt_tokens: Some(prompt_tokens),
                            finish_reason: "stop".into(),
                        },
                    )
                    .ok();
                    return Ok(());
                }
            }
        }
    }

    Ok(())
}

/// List models from local Ollama instance
pub async fn list_models(base_url: &str) -> Result<Vec<Value>, String> {
    let client = Client::new();
    let response = client
        .get(format!("{}/api/tags", base_url))
        .send()
        .await
        .map_err(|e| format!("Ollama not reachable: {}", e))?;

    let json: Value = response.json().await.map_err(|e| e.to_string())?;
    let models = json["models"].as_array().cloned().unwrap_or_default();
    Ok(models)
}

/// Check if Ollama is running
pub async fn check_status(base_url: &str) -> bool {
    let client = Client::new();
    client
        .get(format!("{}/api/tags", base_url))
        .send()
        .await
        .is_ok()
}
