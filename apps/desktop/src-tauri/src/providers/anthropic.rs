use futures_util::StreamExt;
use reqwest::Client;
use serde_json::json;
use std::time::Instant;
use tauri::{AppHandle, Emitter};

use super::{ChatMessage, StreamEvent};

pub async fn stream_anthropic(
    app: AppHandle,
    session_id: String,
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f64,
    api_key: String,
) -> Result<(), String> {
    let client = Client::new();
    let url = "https://api.anthropic.com/v1/messages";

    // Reconstruct history: Anthropic requires 'system' prompt as a top-level field,
    // and only accepts alternate 'user' and 'assistant' roles in the messages array.
    let mut system_prompt = String::new();
    let mut filtered_messages = Vec::new();

    for msg in messages {
        if msg.role == "system" {
            system_prompt = msg.content;
        } else {
            filtered_messages.push(json!({
                "role": if msg.role == "user" { "user" } else { "assistant" },
                "content": msg.content
            }));
        }
    }

    let mut body = json!({
        "model": model,
        "messages": filtered_messages,
        "temperature": temperature,
        "max_tokens": 4096,
        "stream": true,
    });

    if !system_prompt.is_empty() {
        body.as_object_mut().unwrap().insert("system".to_string(), json!(system_prompt));
    }

    let start_time = Instant::now();

    let response = client
        .post(url)
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic connection error: {}", e))?;

    if !response.status().is_success() {
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic API error: {}", err_text));
    }

    let event_name = format!("ai_stream_{}", session_id);
    let mut total_tokens = 0;

    app.emit(&event_name, StreamEvent::Started { model: model.clone() })
        .ok();

    let mut byte_stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_res) = byte_stream.next().await {
        let chunk = match chunk_res {
            Ok(c) => c,
            Err(_) => break,
        };

        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(idx) = buffer.find("\n\n") {
            let block = buffer[..idx].to_string();
            buffer = buffer[idx + 2..].to_string();

            for line in block.lines() {
                if let Some(data) = line.strip_prefix("data: ") {
                    let data = data.trim();
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                        if let Some(event_type) = parsed.get("type").and_then(|t| t.as_str()) {
                            match event_type {
                                "content_block_delta" => {
                                    if let Some(delta) = parsed.get("delta") {
                                        if let Some(text) = delta.get("text").and_then(|t| t.as_str()) {
                                            total_tokens += 1;
                                            app.emit(
                                                &event_name,
                                                StreamEvent::Token {
                                                    content: text.to_string(),
                                                },
                                            )
                                            .ok();
                                        }
                                    }
                                }
                                "message_stop" => {
                                    break;
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
        }
    }

    let elapsed = start_time.elapsed().as_millis() as u64;
    let tps = if elapsed > 0 {
        (total_tokens as f64) / (elapsed as f64 / 1000.0)
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
            model,
            total_tokens: Some(total_tokens as u64),
            prompt_tokens: None,
            finish_reason: "end_turn".to_string(),
        },
    )
    .ok();

    Ok(())
}
