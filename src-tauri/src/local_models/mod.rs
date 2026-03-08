pub mod catalog;
pub mod manager;
pub mod whisper;

pub use manager::{LocalModelManager, LocalModelStatus};
pub use whisper::LocalWhisperEngine;
