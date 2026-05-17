use ast_indexer::{AstIndexer, IndexerError, SupportedLanguage};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tree_sitter::{Query, QueryCursor, Node};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SymbolError {
    #[error("Indexer error: {0}")]
    Indexer(#[from] IndexerError),
    #[error("Query error: {0}")]
    Query(#[from] tree_sitter::QueryError),
    #[error("Unsupported language for symbol extraction")]
    UnsupportedLanguage,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum SymbolKind {
    Function,
    Class,
    Interface,
    Method,
    Variable,
    Struct,
    Enum,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Symbol {
    pub name: String,
    pub kind: SymbolKind,
    pub path: String,
    pub line_start: usize,
    pub line_end: usize,
    pub signature: Option<String>,
}

pub struct SymbolGraph {
    indexer: AstIndexer,
}

impl Default for SymbolGraph {
    fn default() -> Self {
        Self::new()
    }
}

impl SymbolGraph {
    pub fn new() -> Self {
        Self {
            indexer: AstIndexer::new(),
        }
    }

    pub fn extract_symbols(&mut self, path: &Path) -> Result<Vec<Symbol>, SymbolError> {
        let tree = self.indexer.parse_file(path)?;
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        
        let lang = SupportedLanguage::from_extension(ext)
            .ok_or(SymbolError::UnsupportedLanguage)?;
            
        let source_code = std::fs::read_to_string(path)
            .map_err(IndexerError::IoError)?;

        let query_source = match lang {
            SupportedLanguage::TypeScript | SupportedLanguage::TSX => {
                "(function_declaration name: (identifier) @name) @function
                 (class_declaration name: (type_identifier) @name) @class
                 (interface_declaration name: (type_identifier) @name) @interface
                 (method_definition name: (property_identifier) @name) @method"
            }
            SupportedLanguage::Rust => {
                "(function_item name: (identifier) @name) @function
                 (struct_item name: (type_identifier) @name) @struct
                 (enum_item name: (type_identifier) @name) @enum
                 (impl_item (function_item name: (identifier) @name) @method)"
            }
            SupportedLanguage::Python => {
                "(function_definition name: (identifier) @name) @function
                 (class_definition name: (identifier) @name) @class"
            }
        };

        let query = Query::new(&lang.get_language(), query_source)?;
        let mut cursor = QueryCursor::new();
        let matches = cursor.matches(&query, tree.root_node(), source_code.as_bytes());

        let mut symbols = Vec::new();
        let path_str = path.to_string_lossy().to_string();

        for m in matches {
            // A match contains multiple captures (e.g. the entire function block, and the name identifier).
            // We need to extract the kind from the capture name of the block, and the name from the name identifier.
            let mut kind = None;
            let mut name = String::new();
            let mut block_node: Option<Node> = None;

            for capture in m.captures {
                let capture_name = query.capture_names()[capture.index as usize];
                
                if capture_name == "name" {
                    if let Ok(text) = capture.node.utf8_text(source_code.as_bytes()) {
                        name = text.to_string();
                    }
                } else {
                    kind = match capture_name {
                        "function" => Some(SymbolKind::Function),
                        "class" => Some(SymbolKind::Class),
                        "interface" => Some(SymbolKind::Interface),
                        "method" => Some(SymbolKind::Method),
                        "struct" => Some(SymbolKind::Struct),
                        "enum" => Some(SymbolKind::Enum),
                        _ => None,
                    };
                    block_node = Some(capture.node);
                }
            }

            if let (Some(k), Some(node)) = (kind, block_node) {
                if !name.is_empty() {
                    symbols.push(Symbol {
                        name,
                        kind: k,
                        path: path_str.clone(),
                        line_start: node.start_position().row + 1, // 1-indexed
                        line_end: node.end_position().row + 1,
                        signature: None, // Can be expanded later by slicing source_code
                    });
                }
            }
        }

        Ok(symbols)
    }
}
