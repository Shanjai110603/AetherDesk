use futures_util::StreamExt;
use reqwest::Client;
use serde_json::json;
use std::time::Instant;
use tauri::{AppHandle, Emitter};

use super::{ChatMessage, StreamEvent};

pub async fn stream_openai(
    app: AppHandle,
    session_id: String,
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f64,
    api_key: String,
) -> Result<(), String> {
    let client = Client::new();
    let url = "https://api.openai.com/v1/chat/completions";

    let payload = json!({
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "stream": true,
    });

    let start_time = Instant::now();

    let mut response = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error: {}", err_text));
    }

    let event_name = format!("ai_stream_{}", session_id);
    let mut total_tokens = 0;

    app.emit(&event_name, StreamEvent::Started { model: model.clone() })
        .ok();

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_res) = stream.next().await {
        let chunk = match chunk_res {
            Ok(c) => c,
            Err(_) => break,
        };

        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(idx) = buffer.find("\n\n") {
            let message = buffer[..idx].to_string();
            buffer = buffer[idx + 2..].to_string();

            for line in message.lines() {
                if let Some(data) = line.strip_prefix("data: ") {
                    let data = data.trim();
                    if data == "[DONE]" {
                        break;
                    }

                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                        if let Some(choices) = parsed.get("choices").and_then(|c| c.as_array()) {
                            if let Some(choice) = choices.get(0) {
                                if let Some(delta) = choice.get("delta") {
                                    if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                        total_tokens += 1;
                                        app.emit(
                                            &event_name,
                                            StreamEvent::Token {
                                                content: content.to_string(),
                                            },
                                        )
                                        .ok();
                                    }
                                }
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
            finish_reason: "stop".to_string(),
        },
    )
    .ok();

    Ok(())
}
