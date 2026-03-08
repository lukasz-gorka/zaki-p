use serde::{Deserialize, Serialize};

/// Configuration for audio recording
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AudioRecordingConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub echo_cancellation: bool,
    pub noise_suppression: bool,
    pub auto_gain_control: bool,
    /// Audio input device name. Empty or None means system default.
    pub device_id: Option<String>,
}

/// Information about an available audio input device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDeviceInfo {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

impl Default for AudioRecordingConfig {
    fn default() -> Self {
        Self {
            sample_rate: 48000,
            channels: 1,
            echo_cancellation: false,
            noise_suppression: false,
            auto_gain_control: true,
            device_id: None,
        }
    }
}

/// Information about an active recording session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioRecordingSession {
    /// Unique session identifier
    pub session_id: String,
    /// Timestamp when recording started (Unix epoch ms)
    pub started_at: u64,
    /// Sample rate being used
    pub sample_rate: u32,
    /// Number of channels
    pub channels: u16,
}

/// Result of a completed recording
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioRecordingResult {
    pub session_id: String,
    pub duration_ms: u64,
    pub audio_data: Vec<u8>,
    pub sample_rate: u32,
    pub audio_format: String,
}

/// Error types for audio recording
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AudioRecordingError {
    /// No audio input device available
    NoInputDevice,
    /// Failed to initialize audio stream
    StreamInitFailed(String),
    /// No active recording session
    NoActiveSession,
    /// Session ID mismatch
    SessionMismatch,
    /// Audio processing error
    ProcessingError(String),
    /// WAV encoding error
    EncodingError(String),
}

impl std::fmt::Display for AudioRecordingError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NoInputDevice => write!(f, "No audio input device available"),
            Self::StreamInitFailed(msg) => write!(f, "Failed to initialize audio stream: {}", msg),
            Self::NoActiveSession => write!(f, "No active recording session"),
            Self::SessionMismatch => write!(f, "Session ID does not match active recording"),
            Self::ProcessingError(msg) => write!(f, "Audio processing error: {}", msg),
            Self::EncodingError(msg) => write!(f, "WAV encoding error: {}", msg),
        }
    }
}

impl std::error::Error for AudioRecordingError {}
