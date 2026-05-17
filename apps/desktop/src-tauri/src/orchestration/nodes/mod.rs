use std::collections::HashMap;
use tokio::process::Command;
use reqwest::Client;
use serde_json::json;

use super::engine::ExecutionResult;

pub enum Executor {
    Ai,
    Execution,
    Trigger,
}

impl Executor {
    pub async fn execute(&self, config: &HashMap<String, String>) -> Result<ExecutionResult, String> {
        match self {
            // ── Bash/Script Execution ────────────────────────────────────────
            Executor::Execution => {
                let script = config.get("script").cloned().unwrap_or_default();
                if script.is_empty() {
                    return Err("No script provided".to_string());
                }

                #[cfg(target_os = "windows")]
                let mut cmd = Command::new("cmd");
                #[cfg(target_os = "windows")]
                cmd.args(["/C", &script]);

                #[cfg(not(target_os = "windows"))]
                let mut cmd = Command::new("sh");
                #[cfg(not(target_os = "windows"))]
                cmd.args(["-c", &script]);

                match cmd.output().await {
                    Ok(output) => {
                        if output.status.success() {
                            Ok(ExecutionResult {
                                status: "success".to_string(),
                                data: String::from_utf8_lossy(&output.stdout).to_string(),
                            })
                        } else {
                            Err(String::from_utf8_lossy(&output.stderr).to_string())
                        }
                    }
                    Err(e) => Err(format!("Failed to execute script: {}", e)),
                }
            }

            // ── Real AI Inference via Ollama ─────────────────────────────────
            Executor::Ai => {
                let prompt = config.get("prompt").cloned().unwrap_or_default();
                let model = config.get("model").cloned().unwrap_or_else(|| "llama3:8b".to_string());
                let base_url = config.get("ollama_url").cloned().unwrap_or_else(|| "http://localhost:11434".to_string());

                if prompt.is_empty() {
                    return Err("No prompt provided for AiNode".to_string());
                }

                let client = Client::new();
                let body = json!({
                    "model": model,
                    "messages": [
                        { "role": "user", "content": prompt }
                    ],
                    "stream": false,
                    "options": { "temperature": 0.7 }
                });

                let response = client
                    .post(format!("{}/api/chat", base_url))
                    .json(&body)
                    .send()
                    .await
                    .map_err(|e| format!("AiNode: Ollama connection failed — is Ollama running? ({})", e))?;

                if !response.status().is_success() {
                    return Err(format!("AiNode: Ollama HTTP error {}", response.status()));
                }

                let json: serde_json::Value = response.json().await
                    .map_err(|e| format!("AiNode: Failed to parse response: {}", e))?;

                let content = json["message"]["content"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();

                if content.is_empty() {
                    Err("AiNode: Empty response from model".to_string())
                } else {
                    Ok(ExecutionResult {
                        status: "success".to_string(),
                        data: content,
                    })
                }
            }

            // ── Trigger (no-op, entry point) ─────────────────────────────────
            Executor::Trigger => {
                Ok(ExecutionResult {
                    status: "success".to_string(),
                    data: "Triggered".to_string(),
                })
            }
        }
    }
}
