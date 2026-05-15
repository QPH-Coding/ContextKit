use std::io;

#[derive(Debug, thiserror::Error)]
pub enum ContextKitError {
    #[error("IO error: {0}")]
    Io(#[from] io::Error),

    #[error("Failed to parse TOML: {0}")]
    TomlParse(#[from] toml::de::Error),

    #[error("Failed to serialize TOML: {0}")]
    TomlSerialize(#[from] toml::ser::Error),

    #[error("Source not found: {id}")]
    SourceNotFound { id: String },

    #[error("Config not found: {id}")]
    ConfigNotFound { id: String },

    #[error("Agent tool not found: {id}")]
    AgentToolNotFound { id: String },

    #[error("Could not determine config directory")]
    ConfigDirNotFound,

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("Assignment conflict: {message}")]
    AssignmentConflict { message: String },

    #[error("Git operation failed: {message}")]
    GitError { message: String },
}

pub type Result<T> = std::result::Result<T, ContextKitError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn io_error_conversion() {
        let io_err = io::Error::new(io::ErrorKind::NotFound, "file missing");
        let ck_err: ContextKitError = io_err.into();
        assert!(matches!(ck_err, ContextKitError::Io(_)));
        assert!(ck_err.to_string().contains("file missing"));
    }

    #[test]
    fn toml_parse_error_conversion() {
        let toml_str = "[invalid toml";
        let result: Result<toml::Table> = toml::from_str(toml_str)
            .map_err(ContextKitError::from);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err, ContextKitError::TomlParse(_)));
    }

    #[test]
    fn error_display_messages() {
        assert_eq!(
            ContextKitError::SourceNotFound { id: "abc".into() }.to_string(),
            "Source not found: abc"
        );
        assert_eq!(
            ContextKitError::ConfigNotFound { id: "xyz".into() }.to_string(),
            "Config not found: xyz"
        );
        assert_eq!(
            ContextKitError::ConfigDirNotFound.to_string(),
            "Could not determine config directory"
        );
        assert_eq!(
            ContextKitError::InvalidPath("bad/path".into()).to_string(),
            "Invalid path: bad/path"
        );
        assert_eq!(
            ContextKitError::AssignmentConflict { message: "file exists".into() }.to_string(),
            "Assignment conflict: file exists"
        );
        assert_eq!(
            ContextKitError::GitError { message: "clone failed".into() }.to_string(),
            "Git operation failed: clone failed"
        );
    }

    #[test]
    fn result_type_alias() {
        fn might_fail() -> Result<String> {
            Err(ContextKitError::ConfigDirNotFound)
        }
        assert!(might_fail().is_err());
    }
}
