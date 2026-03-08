use crate::audio::processing;
use crate::audio::types::*;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use std::thread::{self, JoinHandle};
use std::sync::mpsc::{self, Sender, Receiver};
use tauri::Emitter;
use tracing::{info, warn, error, debug};

const MAX_RECORDING_DURATION_SECS: u32 = 600;

enum AudioCommand {
    StartRecording {
        config: AudioRecordingConfig,
        app_handle: Option<tauri::AppHandle>,
        response: Sender<Result<AudioRecordingSession, AudioRecordingError>>,
    },
    StopRecording {
        session_id: String,
        response: Sender<Result<AudioRecordingResult, AudioRecordingError>>,
    },
    CancelRecording {
        session_id: String,
        response: Sender<Result<(), AudioRecordingError>>,
    },
    ForceReset {
        response: Sender<bool>,
    },
    Shutdown,
}

pub struct AudioRecordingManager {
    command_sender: Sender<AudioCommand>,
    audio_thread: Option<JoinHandle<()>>,
}

unsafe impl Send for AudioRecordingManager {}
unsafe impl Sync for AudioRecordingManager {}

impl AudioRecordingManager {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel();

        let audio_thread = thread::spawn(move || {
            info!("[AudioRecorder] Audio thread started");
            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                audio_thread_main(rx);
            })) {
                Ok(()) => info!("[AudioRecorder] Audio thread exited normally"),
                Err(e) => error!("[AudioRecorder] Audio thread PANICKED: {:?}", e),
            }
        });

        Self {
            command_sender: tx,
            audio_thread: Some(audio_thread),
        }
    }

    pub fn start_recording(&self, config: Option<AudioRecordingConfig>, app_handle: Option<tauri::AppHandle>) -> Result<AudioRecordingSession, AudioRecordingError> {
        debug!("[AudioRecorder] start_recording called");
        let (tx, rx) = mpsc::channel();
        if let Err(e) = self.command_sender.send(AudioCommand::StartRecording {
            config: config.unwrap_or_default(),
            app_handle,
            response: tx,
        }) {
            error!("[AudioRecorder] send failed: {} — audio thread is dead", e);
            return Err(AudioRecordingError::StreamInitFailed("Audio thread not responding".to_string()));
        }
        debug!("[AudioRecorder] command sent, waiting for response...");

        match rx.recv() {
            Ok(result) => {
                debug!("[AudioRecorder] got response: {:?}", result.is_ok());
                result
            }
            Err(e) => {
                error!("[AudioRecorder] recv failed: {} — audio thread dropped response channel", e);
                Err(AudioRecordingError::StreamInitFailed("Audio thread not responding".to_string()))
            }
        }
    }

    pub fn stop_recording(&self, session_id: &str) -> Result<AudioRecordingResult, AudioRecordingError> {
        let (tx, rx) = mpsc::channel();
        self.command_sender.send(AudioCommand::StopRecording {
            session_id: session_id.to_string(),
            response: tx,
        }).map_err(|_| AudioRecordingError::StreamInitFailed("Audio thread not responding".to_string()))?;

        rx.recv().map_err(|_| AudioRecordingError::StreamInitFailed("Audio thread not responding".to_string()))?
    }

    pub fn cancel_recording(&self, session_id: &str) -> Result<(), AudioRecordingError> {
        let (tx, rx) = mpsc::channel();
        self.command_sender.send(AudioCommand::CancelRecording {
            session_id: session_id.to_string(),
            response: tx,
        }).map_err(|_| AudioRecordingError::StreamInitFailed("Audio thread not responding".to_string()))?;

        rx.recv().map_err(|_| AudioRecordingError::StreamInitFailed("Audio thread not responding".to_string()))?
    }

    pub fn force_reset(&self) -> bool {
        let (tx, rx) = mpsc::channel();
        if self.command_sender.send(AudioCommand::ForceReset { response: tx }).is_ok() {
            rx.recv().unwrap_or(false)
        } else {
            false
        }
    }
}

impl Drop for AudioRecordingManager {
    fn drop(&mut self) {
        let _ = self.command_sender.send(AudioCommand::Shutdown);
        if let Some(handle) = self.audio_thread.take() {
            let _ = handle.join();
        }
    }
}

struct RecordingState {
    session: AudioRecordingSession,
    samples: Arc<Mutex<Vec<f32>>>,
    stream: cpal::Stream,
}

fn audio_thread_main(receiver: Receiver<AudioCommand>) {
    let mut active_recording: Option<RecordingState> = None;

    loop {
        match receiver.recv() {
            Ok(command) => match command {
                AudioCommand::StartRecording { config, app_handle, response } => {
                    let result = start_recording_internal(&mut active_recording, config, app_handle);
                    let _ = response.send(result);
                }
                AudioCommand::StopRecording { session_id, response } => {
                    let result = stop_recording_internal(&mut active_recording, &session_id);
                    let _ = response.send(result);
                }
                AudioCommand::CancelRecording { session_id, response } => {
                    let result = cancel_recording_internal(&mut active_recording, &session_id);
                    let _ = response.send(result);
                }
                AudioCommand::ForceReset { response } => {
                    let had_recording = active_recording.is_some();
                    if had_recording {
                        if let Some(state) = active_recording.take() {
                            drop(state.stream);
                            warn!("[AudioRecorder] Force reset: cleared stuck recording session");
                        }
                    }
                    let _ = response.send(had_recording);
                }
                AudioCommand::Shutdown => {
                    break;
                }
            },
            Err(_) => {
                break;
            }
        }
    }
}

fn start_recording_internal(
    active_recording: &mut Option<RecordingState>,
    config: AudioRecordingConfig,
    app_handle: Option<tauri::AppHandle>,
) -> Result<AudioRecordingSession, AudioRecordingError> {
    if active_recording.is_some() {
        return Err(AudioRecordingError::StreamInitFailed(
            "Recording already in progress".to_string(),
        ));
    }

    let host = cpal::default_host();
    let device = match config.device_id.as_ref().filter(|s| !s.is_empty()) {
        Some(desired_name) => {
            // Find device by name
            host.input_devices()
                .map_err(|e| AudioRecordingError::StreamInitFailed(format!("Failed to enumerate devices: {}", e)))?
                .find(|d| d.name().ok().as_deref() == Some(desired_name.as_str()))
                .ok_or_else(|| AudioRecordingError::StreamInitFailed(format!("Device '{}' not found", desired_name)))?
        }
        None => {
            host.default_input_device()
                .ok_or(AudioRecordingError::NoInputDevice)?
        }
    };

    let supported_config = device
        .supported_input_configs()
        .map_err(|e| AudioRecordingError::StreamInitFailed(e.to_string()))?
        .find(|c| {
            c.channels() == config.channels
                && c.min_sample_rate().0 <= config.sample_rate
                && c.max_sample_rate().0 >= config.sample_rate
        })
        .or_else(|| {
            device
                .supported_input_configs()
                .ok()?
                .find(|c| c.channels() == 1)
        })
        .or_else(|| {
            device
                .supported_input_configs()
                .ok()?
                .next()
        })
        .ok_or_else(|| {
            AudioRecordingError::StreamInitFailed("No suitable audio config found".to_string())
        })?;

    let sample_rate = if supported_config.min_sample_rate().0 <= config.sample_rate
        && supported_config.max_sample_rate().0 >= config.sample_rate
    {
        config.sample_rate
    } else {
        // Use the closest supported rate, clamped to device range
        config.sample_rate
            .max(supported_config.min_sample_rate().0)
            .min(supported_config.max_sample_rate().0)
    };

    let stream_config = supported_config
        .with_sample_rate(cpal::SampleRate(sample_rate))
        .config();

    let session_id = format!("rec-{}", uuid_simple());
    let started_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let session = AudioRecordingSession {
        session_id: session_id.clone(),
        started_at,
        sample_rate: stream_config.sample_rate.0,
        channels: stream_config.channels,
    };

    let samples_buffer: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
    let samples_buffer_clone = Arc::clone(&samples_buffer);
    let channels = stream_config.channels as usize;

    let max_samples = (stream_config.sample_rate.0 * MAX_RECORDING_DURATION_SECS) as usize;
    let limit_reached = Arc::new(AtomicBool::new(false));
    let limit_reached_clone = Arc::clone(&limit_reached);

    let app_handle_clone = app_handle.clone();
    let app_handle_limit = app_handle.clone();
    let session_id_clone = session_id.clone();
    let session_id_limit = session_id.clone();
    let last_emit_time = Arc::new(Mutex::new(std::time::Instant::now()));

    let analysis_buffer: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::with_capacity(2048)));
    let analysis_buffer_clone = Arc::clone(&analysis_buffer);
    let sample_rate_for_analysis = stream_config.sample_rate.0;

    let err_fn = |err| error!("[AudioRecorder] Stream error: {}", err);

    let stream = device
        .build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                let mut buffer = match samples_buffer_clone.lock() {
                    Ok(guard) => guard,
                    Err(poisoned) => {
                        warn!("[AudioRecorder] Mutex was poisoned, recovering...");
                        poisoned.into_inner()
                    }
                };

                if buffer.len() >= max_samples {
                    if !limit_reached_clone.swap(true, Ordering::Relaxed) {
                        warn!(
                            "[AudioRecorder] Recording buffer limit reached ({} seconds)",
                            MAX_RECORDING_DURATION_SECS
                        );
                        if let Some(app) = &app_handle_limit {
                            let _ = app.emit("audio-recording-limit-reached", serde_json::json!({
                                "sessionId": session_id_limit,
                                "maxDurationSecs": MAX_RECORDING_DURATION_SECS,
                            }));
                        }
                    }
                    return;
                }

                let rms = if !data.is_empty() {
                    let sum_of_squares: f32 = data.iter().map(|&s| s * s).sum();
                    (sum_of_squares / data.len() as f32).sqrt()
                } else {
                    0.0
                };

                {
                    let mut abuf = match analysis_buffer_clone.lock() {
                        Ok(guard) => guard,
                        Err(poisoned) => poisoned.into_inner(),
                    };
                    if channels > 1 {
                        for chunk in data.chunks(channels) {
                            abuf.push(chunk.iter().sum::<f32>() / channels as f32);
                        }
                    } else {
                        abuf.extend_from_slice(data);
                    }
                    if abuf.len() > 2048 {
                        let excess = abuf.len() - 2048;
                        abuf.drain(0..excess);
                    }
                }

                if let Some(app) = &app_handle_clone {
                    let mut last_time = last_emit_time.lock().unwrap_or_else(|e| e.into_inner());
                    if last_time.elapsed().as_millis() >= 50 {
                        let bands = {
                            let abuf = analysis_buffer_clone.lock().unwrap_or_else(|e| e.into_inner());
                            compute_frequency_bands(&abuf, sample_rate_for_analysis, 24)
                        };
                        let _ = app.emit("audio-level", serde_json::json!({
                            "sessionId": session_id_clone,
                            "level": rms,
                            "bands": bands,
                        }));
                        *last_time = std::time::Instant::now();
                    }
                }

                if channels > 1 {
                    for chunk in data.chunks(channels) {
                        let mono_sample: f32 = chunk.iter().sum::<f32>() / channels as f32;
                        buffer.push(mono_sample);
                        if buffer.len() >= max_samples {
                            break;
                        }
                    }
                } else {
                    let remaining = max_samples - buffer.len();
                    let to_take = data.len().min(remaining);
                    buffer.extend_from_slice(&data[..to_take]);
                }
            },
            err_fn,
            None,
        )
        .map_err(|e| AudioRecordingError::StreamInitFailed(e.to_string()))?;

    stream
        .play()
        .map_err(|e| AudioRecordingError::StreamInitFailed(e.to_string()))?;

    *active_recording = Some(RecordingState {
        session: session.clone(),
        samples: samples_buffer,
        stream,
    });

    Ok(session)
}

fn stop_recording_internal(
    active_recording: &mut Option<RecordingState>,
    session_id: &str,
) -> Result<AudioRecordingResult, AudioRecordingError> {
    let state = active_recording.take().ok_or(AudioRecordingError::NoActiveSession)?;

    if state.session.session_id != session_id {
        *active_recording = Some(state);
        return Err(AudioRecordingError::SessionMismatch);
    }

    drop(state.stream);

    let duration_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
        - state.session.started_at;

    let samples = {
        let guard = match state.samples.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                warn!("[AudioRecorder] Mutex was poisoned during stop, recovering...");
                poisoned.into_inner()
            }
        };
        guard.clone()
    };

    let processed = processing::process_audio(&samples, state.session.sample_rate);

    let (audio_data, audio_format) = match encode_flac(&processed, state.session.sample_rate, 1, 16) {
        Ok(data) => {
            (data, "flac".to_string())
        }
        Err(e) => {
            warn!("[AudioRecorder] FLAC failed, falling back to WAV: {}", e);
            let wav_data = encode_wav(&processed, state.session.sample_rate, 1)?;
            (wav_data, "wav".to_string())
        }
    };

    Ok(AudioRecordingResult {
        session_id: session_id.to_string(),
        duration_ms,
        audio_data,
        sample_rate: state.session.sample_rate,
        audio_format,
    })
}

fn cancel_recording_internal(
    active_recording: &mut Option<RecordingState>,
    session_id: &str,
) -> Result<(), AudioRecordingError> {
    let state = active_recording.take().ok_or(AudioRecordingError::NoActiveSession)?;

    if state.session.session_id != session_id {
        *active_recording = Some(state);
        return Err(AudioRecordingError::SessionMismatch);
    }

    drop(state.stream);
    Ok(())
}

fn encode_wav(
    samples: &[f32],
    sample_rate: u32,
    channels: u16,
) -> Result<Vec<u8>, AudioRecordingError> {
    let spec = hound::WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut cursor = std::io::Cursor::new(Vec::new());
    {
        let mut writer = hound::WavWriter::new(&mut cursor, spec)
            .map_err(|e| AudioRecordingError::EncodingError(e.to_string()))?;

        for &sample in samples {
            let sample_i16 = (sample * 32767.0).clamp(-32768.0, 32767.0) as i16;
            writer
                .write_sample(sample_i16)
                .map_err(|e| AudioRecordingError::EncodingError(e.to_string()))?;
        }

        writer
            .finalize()
            .map_err(|e| AudioRecordingError::EncodingError(e.to_string()))?;
    }

    Ok(cursor.into_inner())
}

fn encode_flac(
    samples: &[f32],
    sample_rate: u32,
    channels: usize,
    bits_per_sample: usize,
) -> Result<Vec<u8>, AudioRecordingError> {
    use flacenc::component::BitRepr;
    use flacenc::error::Verify;

    let max_val = (1i32 << (bits_per_sample - 1)) - 1;
    let min_val = -(1i32 << (bits_per_sample - 1));
    let scale = max_val as f32;

    let samples_i32: Vec<i32> = samples
        .iter()
        .map(|&s| (s * scale).clamp(min_val as f32, max_val as f32) as i32)
        .collect();

    let config = flacenc::config::Encoder::default()
        .into_verified()
        .map_err(|e| AudioRecordingError::EncodingError(format!("FLAC config error: {:?}", e)))?;

    let source = flacenc::source::MemSource::from_samples(
        &samples_i32,
        channels,
        bits_per_sample,
        sample_rate as usize,
    );

    let flac_stream = flacenc::encode_with_fixed_block_size(&config, source, config.block_size)
        .map_err(|e| AudioRecordingError::EncodingError(format!("FLAC encode error: {:?}", e)))?;

    let mut sink = flacenc::bitsink::ByteSink::new();
    flac_stream
        .write(&mut sink)
        .map_err(|_| AudioRecordingError::EncodingError("FLAC write error".to_string()))?;

    Ok(sink.as_slice().to_vec())
}

fn compute_frequency_bands(samples: &[f32], sample_rate: u32, num_bands: usize) -> Vec<f32> {
    let n = samples.len();
    if n < 64 {
        return vec![0.0; num_bands];
    }

    let window_size = n.min(1024);
    let start = n - window_size;
    let analysis = &samples[start..];
    let wn = analysis.len();

    let min_freq: f64 = 85.0;
    let max_freq: f64 = 8000.0;
    let log_min = min_freq.ln();
    let log_max = max_freq.ln();

    let mut bands = Vec::with_capacity(num_bands);

    for i in 0..num_bands {
        let t = if num_bands > 1 {
            i as f64 / (num_bands - 1) as f64
        } else {
            0.5
        };
        let freq = (log_min + t * (log_max - log_min)).exp();

        let k = freq * wn as f64 / sample_rate as f64;
        let omega = 2.0 * std::f64::consts::PI * k / wn as f64;
        let coeff = 2.0 * omega.cos();

        let mut s1: f64 = 0.0;
        let mut s2: f64 = 0.0;

        for (j, &sample) in analysis.iter().enumerate() {
            let w = 0.5 * (1.0 - (2.0 * std::f64::consts::PI * j as f64 / (wn - 1) as f64).cos());
            let windowed = sample as f64 * w;

            let s0 = windowed + coeff * s1 - s2;
            s2 = s1;
            s1 = s0;
        }

        let power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
        let magnitude = power.abs().sqrt() / wn as f64;

        bands.push(magnitude as f32);
    }

    bands
}

pub fn list_audio_devices() -> Result<Vec<AudioDeviceInfo>, AudioRecordingError> {
    let host = cpal::default_host();
    let default_name = host
        .default_input_device()
        .and_then(|d| d.name().ok());

    let devices = host.input_devices().map_err(|e| {
        AudioRecordingError::StreamInitFailed(format!("Failed to enumerate devices: {}", e))
    })?;

    let mut result = Vec::new();
    for device in devices {
        let name = device.name().unwrap_or_else(|_| "Unknown".to_string());
        let is_default = Some(&name) == default_name.as_ref();
        result.push(AudioDeviceInfo {
            id: name.clone(),
            name,
            is_default,
        });
    }
    Ok(result)
}

fn uuid_simple() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("{:x}", timestamp)
}
