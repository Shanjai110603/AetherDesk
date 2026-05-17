use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentMemory {
    pub agent_id: String,
    pub short_term: Vec<serde_json::Value>,
    pub episodic: Vec<serde_json::Value>,
    pub failures: Vec<String>,
}

impl AgentMemory {
    pub fn new(agent_id: String) -> Self {
        Self {
            agent_id,
            short_term: Vec::new(),
            episodic: Vec::new(),
            failures: Vec::new(),
        }
    }

    pub async fn save(&self, workspace_path: &str) -> Result<(), String> {
        let path = PathBuf::from(workspace_path)
            .join(".aether")
            .join("memory")
            .join(format!("{}.json", self.agent_id));
            
        let data = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(path, data).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn load(agent_id: &str, workspace_path: &str) -> Result<Self, String> {
        let path = PathBuf::from(workspace_path)
            .join(".aether")
            .join("memory")
            .join(format!("{}.json", agent_id));

        if !path.exists() {
            return Ok(Self::new(agent_id.to_string()));
        }

        let data = fs::read_to_string(path).await.map_err(|e| e.to_string())?;
        let memory: AgentMemory = serde_json::from_str(&data).map_err(|e| e.to_string())?;
        Ok(memory)
    }
}
