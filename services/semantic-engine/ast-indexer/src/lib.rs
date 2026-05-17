use std::path::Path;
use thiserror::Error;
use tree_sitter::{Language, Parser, Tree};

#[derive(Error, Debug)]
pub enum IndexerError {
    #[error("Language not supported for file extension: {0}")]
    UnsupportedLanguage(String),
    #[error("Failed to parse file: {0}")]
    ParseError(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

pub enum SupportedLanguage {
    TypeScript,
    TSX,
    Rust,
    Python,
}

impl SupportedLanguage {
    pub fn from_extension(ext: &str) -> Option<Self> {
        match ext {
            "ts" => Some(SupportedLanguage::TypeScript),
            "tsx" => Some(SupportedLanguage::TSX),
            "rs" => Some(SupportedLanguage::Rust),
            "py" => Some(SupportedLanguage::Python),
            _ => None,
        }
    }

    pub fn get_language(&self) -> Language {
        match self {
            SupportedLanguage::TypeScript => tree_sitter_typescript::language_typescript().into(),
            SupportedLanguage::TSX => tree_sitter_typescript::language_tsx().into(),
            SupportedLanguage::Rust => tree_sitter_rust::language().into(),
            SupportedLanguage::Python => tree_sitter_python::language().into(),
        }
    }
}

pub struct AstIndexer {
    parser: Parser,
}

impl Default for AstIndexer {
    fn default() -> Self {
        Self::new()
    }
}

impl AstIndexer {
    pub fn new() -> Self {
        Self {
            parser: Parser::new(),
        }
    }

    pub fn parse_file(&mut self, path: &Path) -> Result<Tree, IndexerError> {
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        let lang = SupportedLanguage::from_extension(ext)
            .ok_or_else(|| IndexerError::UnsupportedLanguage(ext.to_string()))?;

        self.parser.set_language(&lang.get_language())
            .map_err(|e| IndexerError::ParseError(format!("Failed to set language: {:?}", e)))?;

        let source = std::fs::read_to_string(path)?;
        let tree = self.parser.parse(&source, None)
            .ok_or_else(|| IndexerError::ParseError("Failed to parse AST".into()))?;

        Ok(tree)
    }

    pub fn parse_text(&mut self, source: &str, ext: &str) -> Result<Tree, IndexerError> {
        let lang = SupportedLanguage::from_extension(ext)
            .ok_or_else(|| IndexerError::UnsupportedLanguage(ext.to_string()))?;

        self.parser.set_language(&lang.get_language())
            .map_err(|e| IndexerError::ParseError(format!("Failed to set language: {:?}", e)))?;

        let tree = self.parser.parse(source, None)
            .ok_or_else(|| IndexerError::ParseError("Failed to parse AST".into()))?;

        Ok(tree)
    }
}
