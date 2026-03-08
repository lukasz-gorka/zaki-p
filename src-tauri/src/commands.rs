use tracing::debug;
use crate::audio::{AudioRecordingManager, AudioRecordingConfig, AudioRecordingSession, AudioRecordingResult, AudioDeviceInfo};
use crate::local_models::{LocalModelManager, LocalModelStatus};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use reqwest::Client;

/// Global state for Audio and shared HTTP client
pub struct AppState {
    pub audio_manager: Arc<AudioRecordingManager>,
    pub http_client: Client,
}

// ============================================================================
// AI Chat Completion Proxy
// ============================================================================

/// Proxy chat completion request to an OpenAI-compatible API.
/// Bypasses CORS by going through Rust reqwest instead of browser fetch.
/// Supports tool_ids for Open WebUI server-side tools.
#[tauri::command]
pub async fn proxy_chat_completion(
    state: State<'_, AppState>,
    url: String,
    api_key: String,
    body: serde_json::Value,
) -> Result<serde_json::Value, String> {
    validate_url(&url)?;

    let response = state.http_client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("API error ({}): {}", status, error_text));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

// ============================================================================
// AI Transcription Proxy
// ============================================================================

/// Proxy audio transcription request (multipart POST) to an OpenAI-compatible API.
#[tauri::command]
pub async fn proxy_transcription(
    state: State<'_, AppState>,
    url: String,
    api_key: String,
    audio_data: Vec<u8>,
    audio_format: String,
    model: String,
    language: Option<String>,
    prompt: Option<String>,
) -> Result<serde_json::Value, String> {
    validate_url(&url)?;

    let filename = format!("audio.{}", audio_format);
    let file_part = reqwest::multipart::Part::bytes(audio_data)
        .file_name(filename)
        .mime_str(&format!("audio/{}", audio_format))
        .map_err(|e| format!("Failed to create file part: {}", e))?;

    let mut form = reqwest::multipart::Form::new()
        .part("file", file_part)
        .text("model", model)
        .text("response_format", "json");

    if let Some(lang) = language {
        form = form.text("language", lang);
    }
    if let Some(p) = prompt {
        form = form.text("prompt", p);
    }

    let response = state.http_client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Transcription API error ({}): {}", status, error_text));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

// ============================================================================
// AI Text-to-Speech Proxy
// ============================================================================

/// Proxy TTS request to an OpenAI-compatible API. Returns raw audio bytes.
#[tauri::command]
pub async fn proxy_text_to_speech(
    state: State<'_, AppState>,
    url: String,
    api_key: String,
    model: String,
    text: String,
    voice: String,
    speed: Option<f64>,
) -> Result<Vec<u8>, String> {
    validate_url(&url)?;

    let body = serde_json::json!({
        "model": model,
        "input": text,
        "voice": voice,
        "speed": speed.unwrap_or(1.0),
    });

    let response = state.http_client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("TTS API error ({}): {}", status, error_text));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response bytes: {}", e))?;

    Ok(bytes.to_vec())
}

// ============================================================================
// AI Image Generation Proxy
// ============================================================================

/// Proxy image generation request to an OpenAI-compatible API.
#[tauri::command]
pub async fn proxy_image_generation(
    state: State<'_, AppState>,
    url: String,
    api_key: String,
    body: serde_json::Value,
) -> Result<serde_json::Value, String> {
    validate_url(&url)?;

    let response = state.http_client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Image generation API error ({}): {}", status, error_text));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

// ============================================================================
// Webhook Commands
// ============================================================================

/// Validate URL for security - prevent SSRF attacks
pub fn validate_url(raw_url: &str) -> Result<(), String> {
    let parsed = url::Url::parse(raw_url)
        .map_err(|e| format!("Invalid URL: {}", e))?;

    let scheme = parsed.scheme();
    let host = parsed.host_str().unwrap_or("");

    // Allow localhost for local models
    let is_localhost = host == "localhost" || host == "127.0.0.1" || host == "::1";

    if is_localhost {
        if scheme != "http" && scheme != "https" {
            return Err(format!("Only http/https allowed, got: {}", scheme));
        }
        return Ok(());
    }

    // Non-localhost: require https
    if scheme != "https" {
        return Err("Only HTTPS URLs are allowed for external requests".to_string());
    }

    // Block private IP ranges
    if let Some(url::Host::Ipv4(ip)) = parsed.host() {
        if ip.is_private() || ip.is_loopback() || ip.is_link_local() {
            return Err("Requests to private IP addresses are not allowed".to_string());
        }
    }

    Ok(())
}

/// Execute a webhook (POST JSON to a URL)
#[tauri::command]
pub async fn execute_webhook(
    state: State<'_, AppState>,
    url: String,
    data: String,
) -> Result<String, String> {
    validate_url(&url)?;

    let response = state.http_client
        .post(&url)
        .header("Content-Type", "application/json")
        .body(data)
        .send()
        .await
        .map_err(|e| format!("Webhook request failed: {}", e))?;

    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read webhook response: {}", e))?;

    Ok(text)
}

// ============================================================================
// Download Image Commands
// ============================================================================

/// Download an image from URL and return as base64
#[tauri::command]
pub async fn download_image(
    state: State<'_, AppState>,
    url: String,
) -> Result<String, String> {
    use base64::Engine;

    validate_url(&url)?;

    let response = state.http_client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to download image: {}", e))?;

    // Check Content-Length header if available
    if let Some(content_length) = response.content_length() {
        if content_length > 10 * 1024 * 1024 {
            return Err("Image too large: exceeds 10MB limit".to_string());
        }
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read image bytes: {}", e))?;

    if bytes.len() > 10 * 1024 * 1024 {
        return Err("Image too large: exceeds 10MB limit".to_string());
    }

    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

// ============================================================================
// Keyboard Simulation Commands
// ============================================================================

/// Simulate paste action (Ctrl+V / Cmd+V) to paste clipboard content
/// at the current cursor position in any focused application
///
/// Note: On macOS, this uses AppleScript via osascript to avoid crashes
/// caused by enigo's TIS/TSM API calls from non-main threads.
/// On Windows/Linux, enigo is used directly.
/// Requires Accessibility permissions on macOS.
#[tauri::command]
pub async fn simulate_paste() -> Result<(), String> {
    // Small delay to ensure the window that should receive paste is focused
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    tokio::task::spawn_blocking(move || {
        simulate_paste_platform()
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[cfg(target_os = "macos")]
fn simulate_paste_platform() -> Result<(), String> {
    use std::ffi::c_void;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventSourceCreate(stateID: i32) -> *mut c_void;
        fn CGEventCreateKeyboardEvent(source: *mut c_void, virtualKey: u16, keyDown: bool) -> *mut c_void;
        fn CGEventSetFlags(event: *mut c_void, flags: u64);
        fn CGEventPost(tap: u32, event: *mut c_void);
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFRelease(cf: *const c_void);
    }

    const KCG_EVENT_SOURCE_STATE_HID: i32 = 1;
    const KCG_HID_EVENT_TAP: u32 = 0;
    const KVK_ANSI_V: u16 = 9;
    const KCG_EVENT_FLAG_MASK_COMMAND: u64 = 0x00100000;

    // Check accessibility permission first
    {
        #[link(name = "ApplicationServices", kind = "framework")]
        extern "C" {
            fn AXIsProcessTrusted() -> bool;
        }
        let trusted = unsafe { AXIsProcessTrusted() };
        debug!("[simulate_paste] AXIsProcessTrusted = {}", trusted);
        if !trusted {
            return Err("Accessibility permission not granted. Please remove and re-add the app in System Settings → Privacy & Security → Accessibility.".to_string());
        }
    }

    debug!("[simulate_paste] Starting macOS paste simulation via CGEvent");

    unsafe {
        let source = CGEventSourceCreate(KCG_EVENT_SOURCE_STATE_HID);

        let key_down = CGEventCreateKeyboardEvent(source, KVK_ANSI_V, true);
        if key_down.is_null() {
            if !source.is_null() { CFRelease(source); }
            return Err("Failed to create CGEvent key down".to_string());
        }
        CGEventSetFlags(key_down, KCG_EVENT_FLAG_MASK_COMMAND);
        CGEventPost(KCG_HID_EVENT_TAP, key_down);
        CFRelease(key_down);

        std::thread::sleep(std::time::Duration::from_millis(10));

        let key_up = CGEventCreateKeyboardEvent(source, KVK_ANSI_V, false);
        if key_up.is_null() {
            if !source.is_null() { CFRelease(source); }
            return Err("Failed to create CGEvent key up".to_string());
        }
        CGEventSetFlags(key_up, KCG_EVENT_FLAG_MASK_COMMAND);
        CGEventPost(KCG_HID_EVENT_TAP, key_up);
        CFRelease(key_up);

        if !source.is_null() {
            CFRelease(source);
        }
    }

    debug!("[simulate_paste] CGEvent paste simulation executed successfully");
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn simulate_paste_platform() -> Result<(), String> {
    use enigo::{Enigo, Keyboard, Settings, Key};

    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize enigo: {}", e))?;

    enigo.key(Key::Control, enigo::Direction::Press)
        .map_err(|e| format!("Failed to press modifier: {}", e))?;

    enigo.key(Key::Unicode('v'), enigo::Direction::Click)
        .map_err(|e| format!("Failed to press V: {}", e))?;

    enigo.key(Key::Control, enigo::Direction::Release)
        .map_err(|e| format!("Failed to release modifier: {}", e))?;

    Ok(())
}

// ============================================================================
// Audio Recording Commands
// ============================================================================

#[tauri::command]
pub async fn list_audio_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    tokio::task::spawn_blocking(|| {
        crate::audio::list_audio_devices()
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_audio_recording(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    config: Option<AudioRecordingConfig>,
) -> Result<AudioRecordingSession, String> {
    let manager = Arc::clone(&state.audio_manager);
    tokio::task::spawn_blocking(move || {
        manager.start_recording(config, Some(app))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_audio_recording(
    state: State<'_, AppState>,
    #[allow(non_snake_case)]
    sessionId: String,
) -> Result<AudioRecordingResult, String> {
    let manager = Arc::clone(&state.audio_manager);
    tokio::task::spawn_blocking(move || {
        manager.stop_recording(&sessionId)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cancel_audio_recording(
    state: State<'_, AppState>,
    #[allow(non_snake_case)]
    sessionId: String,
) -> Result<(), String> {
    let manager = Arc::clone(&state.audio_manager);
    tokio::task::spawn_blocking(move || {
        manager.cancel_recording(&sessionId)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reset_audio_recording(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let manager = Arc::clone(&state.audio_manager);
    tokio::task::spawn_blocking(move || {
        manager.force_reset()
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))
}

// ============================================================================
// Accessibility Check Commands
// ============================================================================

/// Check if the app has accessibility permissions (macOS).
/// Returns true if trusted, false if not.
#[tauri::command]
pub fn check_accessibility_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        #[link(name = "ApplicationServices", kind = "framework")]
        extern "C" {
            fn AXIsProcessTrusted() -> bool;
        }
        unsafe { AXIsProcessTrusted() }
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

// ============================================================================
// System Settings Commands
// ============================================================================

#[tauri::command]
pub async fn open_accessibility_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility")
            .spawn()
            .map_err(|e| format!("Failed to open settings: {}", e))?;
    }
    Ok(())
}

// ============================================================================
// Notification Sound Commands
// ============================================================================

#[tauri::command]
pub async fn play_notification_sound(
    #[allow(non_snake_case)]
    soundType: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        play_sound_platform(&soundType)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[cfg(target_os = "macos")]
fn play_sound_platform(sound_type: &str) -> Result<(), String> {
    let sound_name = match sound_type {
        "start" => "Tink",
        "stop" => "Pop",
        "copy" => "Morse",
        _ => "Tink",
    };
    std::process::Command::new("afplay")
        .arg(format!("/System/Library/Sounds/{}.aiff", sound_name))
        .status()
        .map_err(|e| format!("Failed to play sound: {}", e))?;
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn play_sound_platform(sound_type: &str) -> Result<(), String> {
    debug!("[Sound] Notification sounds not implemented for this platform (type: {})", sound_type);
    Ok(())
}

// ============================================================================
// Audio File Playback Commands
// ============================================================================

#[tauri::command]
pub async fn read_audio_file_as_wav(app: AppHandle, file_path: String) -> Result<Vec<u8>, String> {
    // Validate that file_path is within app_data_dir or temp dir
    let canonical = std::path::Path::new(&file_path)
        .canonicalize()
        .map_err(|e| format!("Invalid file path: {}", e))?;
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let temp_dir = std::env::temp_dir();
    if !canonical.starts_with(&app_data_dir) && !canonical.starts_with(&temp_dir) {
        return Err("Access denied: file must be within app data or temp directory".to_string());
    }

    tokio::task::spawn_blocking(move || {
        let path = std::path::Path::new(&file_path);
        if !path.exists() {
            return Err(format!("File not found: {}", file_path));
        }

        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        if ext.eq_ignore_ascii_case("flac") {
            decode_flac_to_wav(&file_path)
        } else {
            // WAV or other — read as-is
            std::fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

fn decode_flac_to_wav(path: &str) -> Result<Vec<u8>, String> {
    let mut reader = claxon::FlacReader::open(path)
        .map_err(|e| format!("Failed to open FLAC: {}", e))?;

    let info = reader.streaminfo();
    let channels = info.channels as u16;
    let sample_rate = info.sample_rate;
    let bits_per_sample = info.bits_per_sample as u16;

    let samples: Vec<i32> = reader.samples().collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to decode FLAC samples: {}", e))?;

    let mut wav_buf = Vec::new();
    let cursor = std::io::Cursor::new(&mut wav_buf);
    let spec = hound::WavSpec {
        channels,
        sample_rate,
        bits_per_sample,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::new(cursor, spec)
        .map_err(|e| format!("Failed to create WAV writer: {}", e))?;

    for sample in &samples {
        writer.write_sample(*sample)
            .map_err(|e| format!("Failed to write WAV sample: {}", e))?;
    }

    writer.finalize()
        .map_err(|e| format!("Failed to finalize WAV: {}", e))?;

    Ok(wav_buf)
}

// ============================================================================
// Local Model Commands
// ============================================================================

/// List all available local models with their download status
#[tauri::command]
pub async fn local_models_list(
    manager: State<'_, Arc<LocalModelManager>>,
) -> Result<Vec<LocalModelStatus>, String> {
    Ok(manager.list_models().await)
}

/// Download a local model by ID. Emits progress events: "local-model-download-progress-{model_id}"
#[tauri::command]
pub async fn local_model_download(
    app: AppHandle,
    manager: State<'_, Arc<LocalModelManager>>,
    model_id: String,
) -> Result<(), String> {
    let mgr = Arc::clone(&manager);
    let event_name = format!("local-model-download-progress-{}", model_id);
    let app_clone = app.clone();

    mgr.download_model(model_id, move |progress| {
        let _ = app_clone.emit(&event_name, progress);
    })
    .await
}

/// Cancel an in-progress model download
#[tauri::command]
pub async fn local_model_cancel_download(
    manager: State<'_, Arc<LocalModelManager>>,
    model_id: String,
) -> Result<(), String> {
    manager.cancel_download(&model_id).await
}

/// Delete a downloaded local model
#[tauri::command]
pub async fn local_model_delete(
    manager: State<'_, Arc<LocalModelManager>>,
    model_id: String,
) -> Result<(), String> {
    manager.delete_model(&model_id).await
}

/// Transcribe audio using a local whisper model
#[tauri::command]
pub async fn local_transcribe_audio(
    manager: State<'_, Arc<LocalModelManager>>,
    audio_data: Vec<u8>,
    model_id: String,
    language: Option<String>,
) -> Result<String, String> {
    let mgr = Arc::clone(&manager);
    let model_path = mgr
        .get_model_file_path(&model_id)
        .ok_or_else(|| format!("Model {} is not downloaded", model_id))?;

    let lang = language;
    tokio::task::spawn_blocking(move || {
        crate::local_models::LocalWhisperEngine::transcribe(
            &model_path,
            &audio_data,
            lang.as_deref(),
        )
    })
    .await
    .map_err(|e| format!("Whisper task failed: {}", e))?
}
