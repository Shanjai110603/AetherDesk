pub mod ollama;
pub mod openai;

use serde::{Deserialize, Serialize};

/// Unified streaming event emitted by ALL providers through ONE pipeline.
/// The frontend never knows which backend generated this event.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamEvent {
    /// A single token/delta of text
    Token { content: String },
    /// Provider confirmed it started generating
    Started { model: String },
    /// Full stream completed successfully
    Completed {
        model: String,
        total_tokens: Option<u64>,
        prompt_tokens: Option<u64>,
        finish_reason: String,
    },
    /// Telemetry update mid-stream
    Telemetry {
        inference_ms: u64,
        tokens_per_sec: f64,
    },
    /// Recoverable or fatal error
    Error { code: String, message: String },
}

/// Normalized chat message sent to any provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Provider capability trait — implemented by ollama.rs, openai.rs etc.
pub trait AiProvider: Send + Sync {
    fn provider_id(&self) -> &'static str;
}

/// Configuration for a streaming request, provider-agnostic
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamRequest {
    pub session_id: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u64>,
}
