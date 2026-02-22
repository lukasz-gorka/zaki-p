use crate::ai::{AIProxy, ChatCompletionRequest, ChatCompletionResponse, ModelInfo, ProviderCredentials};
use crate::audio::{AudioRecordingManager, AudioRecordingConfig, AudioRecordingSession, AudioRecordingResult};
use crate::local_models::{LocalModelManager, LocalModelStatus};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::collections::HashMap;
use tokio::sync::RwLock;
use tauri::{AppHandle, Emitter, State};
use reqwest::Client;
use futures::StreamExt;

/// Global state for AI Proxy and Audio
pub struct AppState {
    pub ai_proxy: Arc<AIProxy>,
    pub audio_manager: Arc<AudioRecordingManager>,
    /// Track active operations for abort functionality
    /// Key: sessionId/operationId, Value: abort flag
    pub active_operations: Arc<RwLock<HashMap<String, Arc<AtomicBool>>>>,
}

/// Helper to execute an async operation with abort flag and timeout support
async fn with_abort_and_timeout<F, T>(
    operations: Arc<RwLock<HashMap<String, Arc<AtomicBool>>>>,
    operation_id: String,
    timeout_secs: u64,
    timeout_message: &str,
    operation: F,
) -> Result<T, String>
where
    F: std::future::Future<Output = Result<T, String>>,
{
    // Register operation for abort capability
    let abort_flag = Arc::new(AtomicBool::new(false));
    {
        let mut ops = operations.write().await;
        ops.insert(operation_id.clone(), Arc::clone(&abort_flag));
    }

    // Race between operation, timeout, and abort
    let result = tokio::select! {
        res = operation => res,
        _ = tokio::time::sleep(tokio::time::Duration::from_secs(timeout_secs)) => {
            Err(timeout_message.to_string())
        }
        _ = async {
            loop {
                if abort_flag.load(Ordering::Relaxed) {
                    break;
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        } => {
            Err("Operation aborted by user".to_string())
        }
    };

    // Cleanup operation
    {
        let mut ops = operations.write().await;
        ops.remove(&operation_id);
    }

    result
}

/// Main chat completion endpoint - credentials passed per-request
#[tauri::command]
pub async fn chat_completion(
    state: State<'_, AppState>,
    request: ChatCompletionRequest,
    operation_id: String,
    credentials: ProviderCredentials,
) -> Result<ChatCompletionResponse, String> {
    let proxy = Arc::clone(&state.ai_proxy);
    let operations = Arc::clone(&state.active_operations);

    with_abort_and_timeout(
        operations,
        operation_id,
        60,
        "Request timeout: AI provider did not respond within 60 seconds",
        async move {
            proxy.chat_completion(request, credentials)
                .await
                .map_err(|e| e.to_string())
        },
    ).await
}

/// Chat completion with streaming - credentials passed per-request
/// Emits events: "stream-chunk-{session_id}", "stream-done-{session_id}", "stream-error-{session_id}"
#[tauri::command]
pub async fn chat_completion_stream(
    app: AppHandle,
    state: State<'_, AppState>,
    request: ChatCompletionRequest,
    session_id: String,
    credentials: ProviderCredentials,
) -> Result<(), String> {
    let proxy = Arc::clone(&state.ai_proxy);
    let operations = Arc::clone(&state.active_operations);

    // Register this operation for abort capability
    let abort_flag = Arc::new(AtomicBool::new(false));
    {
        let mut ops = operations.write().await;
        ops.insert(session_id.clone(), Arc::clone(&abort_flag));
    }

    // Start streaming in a background task
    let session_id_clone = session_id.clone();
    let abort_flag_clone = Arc::clone(&abort_flag);
    tokio::spawn(async move {
        let chunk_event = format!("stream-chunk-{}", session_id);
        let done_event = format!("stream-done-{}", session_id);
        let error_event = format!("stream-error-{}", session_id);

        // Add timeout for getting the stream (30 seconds to establish connection)
        let stream_future = proxy.chat_completion_stream(request, credentials);
        let timeout_duration = tokio::time::Duration::from_secs(30);

        let stream_result = tokio::select! {
            result = stream_future => result,
            _ = tokio::time::sleep(timeout_duration) => {
                let _ = app.emit(&error_event, "Request timeout: Failed to establish connection to AI provider");
                let mut ops = operations.write().await;
                ops.remove(&session_id_clone);
                return;
            }
            _ = async {
                loop {
                    if abort_flag_clone.load(Ordering::Relaxed) {
                        break;
                    }
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                }
            } => {
                let _ = app.emit(&done_event, ());
                let mut ops = operations.write().await;
                ops.remove(&session_id_clone);
                return;
            }
        };

        // Get stream from proxy
        match stream_result {
            Ok(mut stream) => {
                // Stream chunks to frontend
                while let Some(result) = stream.next().await {
                    // Check abort flag
                    if abort_flag.load(Ordering::Relaxed) {
                        let _ = app.emit(&done_event, ()); // Emit done even if aborted (partial result is kept)
                        break;
                    }

                    match result {
                        Ok(chunk) => {
                            // Emit the full StreamChunk (includes content, citations, etc.)
                            // Frontend will extract what it needs
                            if let Err(_e) = app.emit(&chunk_event, &chunk) {
                                break;
                            }
                        }
                        Err(e) => {
                            let _ = app.emit(&error_event, format!("Stream error: {}", e));
                            // Cleanup operation on error
                            let mut ops = operations.write().await;
                            ops.remove(&session_id_clone);
                            return;
                        }
                    }
                }

                // Stream complete (either finished or aborted)
                let _ = app.emit(&done_event, ());

                // Cleanup operation
                let mut ops = operations.write().await;
                ops.remove(&session_id_clone);
            }
            Err(e) => {
                let _ = app.emit(&error_event, format!("Failed to start stream: {}", e));
                // Cleanup operation on error
                let mut ops = operations.write().await;
                ops.remove(&session_id_clone);
            }
        }
    });

    Ok(())
}

/// Fetch available models from a provider API
/// Works with any OpenAI-compatible API that has /v1/models endpoint
#[tauri::command]
pub async fn fetch_provider_models(
    api_key: String,
    base_url: String,
) -> Result<Vec<ModelInfo>, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("{}/models", base_url.trim_end_matches('/'));

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch models: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("API error ({}): {}", status, error_text));
    }

    #[derive(serde::Deserialize)]
    struct ModelsResponse {
        data: Vec<ModelInfo>,
    }

    let models_response: ModelsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse models response: {}", e))?;

    Ok(models_response.data)
}

// ============================================================================
// AI Audio Commands
// ============================================================================

/// Transcribe audio - credentials passed per-request
#[tauri::command]
pub async fn transcribe_audio(
    state: State<'_, AppState>,
    operation_id: String,
    audio_data: Vec<u8>,
    model: String,
    language: Option<String>,
    prompt: Option<String>,
    audio_format: Option<String>,
    credentials: ProviderCredentials,
) -> Result<String, String> {
    let request = crate::ai::types::AudioTranscriptionRequest {
        model: model.clone(),
        language,
        prompt,
        response_format: None,
        temperature: None,
    };

    let proxy = Arc::clone(&state.ai_proxy);
    let operations = Arc::clone(&state.active_operations);

    with_abort_and_timeout(
        operations,
        operation_id,
        60,
        "Transcription timeout: Operation took longer than 60 seconds",
        async move {
            proxy.transcribe_audio(audio_data, request, credentials, audio_format)
                .await
                .map(|r| r.text)
                .map_err(|e| e.to_string())
        },
    ).await
}

/// Generate speech from text - credentials passed per-request
#[tauri::command]
pub async fn text_to_speech(
    state: State<'_, AppState>,
    operation_id: String,
    text: String,
    model: String,
    voice: String,
    speed: Option<f32>,
    credentials: ProviderCredentials,
) -> Result<Vec<u8>, String> {
    let request = crate::ai::types::TextToSpeechRequest {
        model: model.clone(),
        input: text,
        voice,
        speed,
        response_format: None, // Use default (mp3)
    };

    let proxy = Arc::clone(&state.ai_proxy);
    let operations = Arc::clone(&state.active_operations);

    with_abort_and_timeout(
        operations,
        operation_id,
        60,
        "Text-to-speech timeout: Operation took longer than 60 seconds",
        async move {
            proxy.text_to_speech(request, credentials)
                .await
                .map_err(|e| e.to_string())
        },
    ).await
}

// ============================================================================
// Abort Operations
// ============================================================================

/// Abort an active AI operation (streaming, image generation, transcription, TTS)
/// This sets the abort flag for the given operation ID, causing it to stop gracefully
#[tauri::command]
pub async fn abort_operation(
    state: State<'_, AppState>,
    operation_id: String,
) -> Result<(), String> {
    let operations = state.active_operations.read().await;

    if let Some(abort_flag) = operations.get(&operation_id) {
        abort_flag.store(true, Ordering::Relaxed);
        Ok(())
    } else {
        // Operation not found - might have already completed
        // Return Ok anyway since the goal (stop operation) is achieved
        Ok(())
    }
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
        eprintln!("[simulate_paste] AXIsProcessTrusted = {}", trusted);
        if !trusted {
            return Err("Accessibility permission not granted. Please remove and re-add the app in System Settings → Privacy & Security → Accessibility.".to_string());
        }
    }

    eprintln!("[simulate_paste] Starting macOS paste simulation via CGEvent");

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

    eprintln!("[simulate_paste] CGEvent paste simulation executed successfully");
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
        .spawn()
        .map_err(|e| format!("Failed to play sound: {}", e))?;
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn play_sound_platform(sound_type: &str) -> Result<(), String> {
    eprintln!("[Sound] Notification sounds not implemented for this platform (type: {})", sound_type);
    Ok(())
}

// ============================================================================
// Audio File Playback Commands
// ============================================================================

#[tauri::command]
pub async fn read_audio_file_as_wav(file_path: String) -> Result<Vec<u8>, String> {
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
    state: State<'_, AppState>,
    manager: State<'_, Arc<LocalModelManager>>,
    operation_id: String,
    audio_data: Vec<u8>,
    model_id: String,
    language: Option<String>,
) -> Result<String, String> {
    let mgr = Arc::clone(&manager);
    let operations = Arc::clone(&state.active_operations);

    with_abort_and_timeout(
        operations,
        operation_id,
        300,
        "Local transcription timeout: Operation took longer than 5 minutes",
        async move {
            let model_path = mgr
                .get_model_file_path(&model_id)
                .ok_or_else(|| format!("Model {} is not downloaded", model_id))?;

            // Run whisper inference on a blocking thread (CPU-bound)
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
        },
    )
    .await
}
