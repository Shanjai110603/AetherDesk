use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum PlatformEvent {
    // Workflow Events
    WorkflowStarted { workflow_id: String },
    NodeQueued { node_id: String },
    NodeRunning { node_id: String },
    NodeCompleted { node_id: String, result: String },
    NodeError { node_id: String, error: String },
    WorkflowFinished { workflow_id: String },
    
    // Agent Events
    AgentSpawned { agent_id: String, role: String },
    AgentStep { agent_id: String, step_type: String },
    AgentCompleted { agent_id: String },

    // Workspace Events
    WorkspaceIndexed { path: String },
    FileModified { path: String },

    // Tool/Sandbox Events
    ToolExecutionRequested { tool_name: String, execution_id: String },
    ToolExecutionCompleted { tool_name: String, execution_id: String, success: bool },
}

pub struct EventBus {
    sender: broadcast::Sender<PlatformEvent>,
}

impl EventBus {
    pub fn new() -> (Self, broadcast::Receiver<PlatformEvent>) {
        let (sender, receiver) = broadcast::channel(1000);
        (Self { sender }, receiver)
    }

    pub fn emit(&self, event: PlatformEvent) {
        let _ = self.sender.send(event);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<PlatformEvent> {
        self.sender.subscribe()
    }
}

pub fn spawn_event_forwarder(app: AppHandle, mut receiver: broadcast::Receiver<PlatformEvent>) {
    tauri::async_runtime::spawn(async move {
        while let Ok(event) = receiver.recv().await {
            // Forward internal rust events to the Tauri frontend
            let _ = app.emit("platform-event", &event);
        }
    });
}
