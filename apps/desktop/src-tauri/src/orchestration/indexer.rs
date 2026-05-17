use notify::{Watcher, RecursiveMode, RecommendedWatcher, Event, Config};
use std::sync::Arc;
use std::path::Path;
use tokio::sync::Mutex;
use std::time::Duration;
use super::event_bus::{EventBus, PlatformEvent};

pub struct Indexer {
    pub event_bus: Arc<EventBus>,
}

impl Indexer {
    pub fn new(event_bus: Arc<EventBus>) -> Self {
        Self { event_bus }
    }

    pub fn start_watching(&self, workspace_path: String) -> Result<(), String> {
        let event_bus = self.event_bus.clone();
        
        std::thread::spawn(move || {
            let (tx, rx) = std::sync::mpsc::channel();
            
            let mut watcher = match RecommendedWatcher::new(tx, Config::default()) {
                Ok(w) => w,
                Err(e) => {
                    eprintln!("Failed to create watcher: {}", e);
                    return;
                }
            };
            
            if let Err(e) = watcher.watch(Path::new(&workspace_path), RecursiveMode::Recursive) {
                eprintln!("Failed to watch directory: {}", e);
                return;
            }
            
            // Background thread block
            for res in rx {
                match res {
                    Ok(event) => {
                        // Very basic debounce/filtering could go here
                        if event.kind.is_modify() {
                            if let Some(path) = event.paths.first() {
                                event_bus.emit(PlatformEvent::FileModified {
                                    path: path.to_string_lossy().to_string(),
                                });
                            }
                        }
                    },
                    Err(e) => println!("watch error: {:?}", e),
                }
            }
        });

        Ok(())
    }
}
