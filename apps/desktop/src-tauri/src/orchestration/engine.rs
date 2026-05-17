use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use super::event_bus::{EventBus, PlatformEvent};
use super::nodes::Executor;

#[derive(Debug, Deserialize, Serialize)]
pub struct WorkflowGraph {
    pub nodes: Vec<WorkflowNode>,
    pub edges: Vec<WorkflowEdge>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WorkflowNode {
    pub id: String,
    pub category: String, // "trigger", "ai", "execution", "logic", "integration"
    pub config: HashMap<String, String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WorkflowEdge {
    #[serde(rename = "sourceNodeId")]
    pub source_node_id: String,
    #[serde(rename = "targetNodeId")]
    pub target_node_id: String,
    pub condition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub status: String, // "success", "error", or custom like "true"/"false"
    pub data: String,
}

pub struct Engine {
    pub event_bus: Arc<EventBus>,
}

impl Engine {
    pub fn new(event_bus: Arc<EventBus>) -> Self {
        Self { event_bus }
    }

    pub async fn execute_graph(&self, graph: WorkflowGraph) {
        let workflow_id = Uuid::new_v4().to_string();
        
        self.event_bus.emit(PlatformEvent::WorkflowStarted {
            workflow_id: workflow_id.clone(),
        });

        // 1. Dependency Resolution & Conditional Routing setup
        let mut in_degree: HashMap<String, usize> = HashMap::new();
        let mut adj_list: HashMap<String, Vec<(String, Option<String>)>> = HashMap::new();
        let mut node_map: HashMap<String, WorkflowNode> = HashMap::new();

        for node in &graph.nodes {
            in_degree.insert(node.id.clone(), 0);
            adj_list.insert(node.id.clone(), Vec::new());
            node_map.insert(node.id.clone(), node.clone());
        }

        for edge in &graph.edges {
            if let Some(targets) = adj_list.get_mut(&edge.source_node_id) {
                targets.push((edge.target_node_id.clone(), edge.condition.clone()));
            }
            if let Some(degree) = in_degree.get_mut(&edge.target_node_id) {
                *degree += 1;
            }
        }

        // Find initial nodes (in_degree == 0)
        let mut ready_queue: Vec<String> = in_degree
            .iter()
            .filter(|(_, &deg)| deg == 0)
            .map(|(id, _)| id.clone())
            .collect();

        // State Store to hold outputs of completed nodes
        let mut state_store: HashMap<String, String> = HashMap::new();

        // 2. Execution Scheduling with Controlled Concurrency
        while !ready_queue.is_empty() {
            let mut next_queue = Vec::new();
            let mut handles = Vec::new();

            for node_id in ready_queue {
                self.event_bus.emit(PlatformEvent::NodeRunning {
                    node_id: node_id.clone(),
                });

                if let Some(node) = node_map.get(&node_id) {
                    let mut node_clone = node.clone();
                    
                    // 3. State Passing (Interpolation)
                    for (_, value) in node_clone.config.iter_mut() {
                        for (k, v) in &state_store {
                            let placeholder = format!("{{{{{}.output}}}}", k); // {{node_id.output}}
                            if value.contains(&placeholder) {
                                *value = value.replace(&placeholder, v);
                            }
                        }
                    }

                    let executor = match node_clone.category.as_str() {
                        "ai" => Executor::Ai,
                        "execution" => Executor::Execution,
                        "trigger" => Executor::Trigger,
                        _ => Executor::Trigger,
                    };

                    // Spawn task for concurrency
                    let node_id_clone = node_id.clone();
                    let handle = tokio::spawn(async move {
                        let res = executor.execute(&node_clone.config).await;
                        (node_id_clone, res)
                    });
                    handles.push(handle);
                }
            }

            // Wait for all concurrent nodes in this batch to finish
            for handle in handles {
                if let Ok((node_id, result)) = handle.await {
                    match result {
                        Ok(exec_res) => {
                            // Save state
                            state_store.insert(node_id.clone(), exec_res.data.clone());

                            // Telemetry Streaming
                            self.event_bus.emit(PlatformEvent::NodeCompleted {
                                node_id: node_id.clone(),
                                result: exec_res.data.clone(),
                            });

                            // 5. Result Propagation & Conditional Dependency Resolution
                            if let Some(targets) = adj_list.get(&node_id) {
                                for (target_id, condition) in targets {
                                    // Evaluate condition
                                    let condition_met = match condition {
                                        Some(cond) => cond == &exec_res.status,
                                        None => exec_res.status == "success",
                                    };

                                    if condition_met {
                                        if let Some(deg) = in_degree.get_mut(target_id) {
                                            *deg -= 1;
                                            if *deg == 0 {
                                                next_queue.push(target_id.clone());
                                                self.event_bus.emit(PlatformEvent::NodeQueued {
                                                    node_id: target_id.clone(),
                                                });
                                            }
                                        }
                                    } else {
                                        // Condition failed, skip target and propagate dead edge
                                        // (For V1 we simply don't decrement in_degree, which means it will never enter ready_queue)
                                        log::info!("Condition not met for edge {} -> {}. Status: {}", node_id, target_id, exec_res.status);
                                    }
                                }
                            }
                        }
                        Err(error) => {
                            self.event_bus.emit(PlatformEvent::NodeError {
                                node_id: node_id.clone(),
                                error,
                            });
                            // Stop propagating this branch on error
                        }
                    }
                }
            }

            ready_queue = next_queue;
        }

        self.event_bus.emit(PlatformEvent::WorkflowFinished {
            workflow_id,
        });
    }
}
