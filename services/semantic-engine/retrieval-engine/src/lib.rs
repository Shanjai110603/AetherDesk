use symbol_graph::{Symbol, SymbolGraph, SymbolError};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum RetrievalError {
    #[error("Symbol extraction error: {0}")]
    Symbol(#[from] SymbolError),
    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),
}

pub struct RetrievalEngine {
    symbol_extractor: SymbolGraph,
    // Maps a file path to its extracted symbols
    file_symbols: HashMap<PathBuf, Vec<Symbol>>,
}

impl Default for RetrievalEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl RetrievalEngine {
    pub fn new() -> Self {
        Self {
            symbol_extractor: SymbolGraph::new(),
            file_symbols: HashMap::new(),
        }
    }

    /// Indexes a specific file and stores its symbols
    pub fn index_file(&mut self, path: &Path) -> Result<(), RetrievalError> {
        let symbols = self.symbol_extractor.extract_symbols(path)?;
        self.file_symbols.insert(path.to_path_buf(), symbols);
        Ok(())
    }

    /// Recursively indexes all supported files in a directory
    pub fn index_directory(&mut self, dir: &Path) -> Result<(), RetrievalError> {
        if dir.is_dir() {
            for entry in std::fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                
                if path.is_dir() {
                    // Skip hidden dirs like .git or node_modules for basic indexing
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" {
                            continue;
                        }
                    }
                    self.index_directory(&path)?;
                } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if matches!(ext, "ts" | "tsx" | "rs" | "py") {
                        // ignore errors for individual files to avoid halting the whole index process
                        let _ = self.index_file(&path);
                    }
                }
            }
        }
        Ok(())
    }

    /// Finds a symbol by its exact name across the indexed workspace
    pub fn find_symbol(&self, name: &str) -> Vec<&Symbol> {
        let mut results = Vec::new();
        for symbols in self.file_symbols.values() {
            for symbol in symbols {
                if symbol.name == name {
                    results.push(symbol);
                }
            }
        }
        results
    }

    /// Returns all symbols found in a specific file
    pub fn get_file_symbols(&self, path: &Path) -> Option<&Vec<Symbol>> {
        self.file_symbols.get(path)
    }
}
