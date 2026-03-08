use std::path::PathBuf;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

pub struct LocalWhisperEngine;

impl LocalWhisperEngine {
    pub fn transcribe(
        model_path: &PathBuf,
        audio_data: &[u8],
        language: Option<&str>,
    ) -> Result<String, String> {
        // Detect format and parse audio data
        let samples = if audio_data.starts_with(b"fLaC") {
            Self::flac_to_f32_samples(audio_data)?
        } else {
            Self::wav_to_f32_samples(audio_data)?
        };

        // Resample to 16kHz mono if needed (whisper requires 16kHz)
        let samples_16k = Self::ensure_16khz(&samples, audio_data)?;

        // Create whisper context from model file
        let ctx = WhisperContext::new_with_params(
            model_path.to_str().ok_or("Invalid model path")?,
            WhisperContextParameters::default(),
        )
        .map_err(|e| format!("Failed to load whisper model: {}", e))?;

        let mut state = ctx.create_state()
            .map_err(|e| format!("Failed to create whisper state: {}", e))?;

        // Configure transcription parameters
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

        // Set language if provided
        if let Some(lang) = language {
            let lang_code = lang.split('-').next().unwrap_or(lang);
            params.set_language(Some(lang_code));
        } else {
            params.set_language(Some("auto"));
        }

        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_suppress_blank(true);
        params.set_n_threads(num_cpus());

        // Run inference
        state.full(params, &samples_16k)
            .map_err(|e| format!("Whisper inference failed: {}", e))?;

        // Collect transcription segments
        let num_segments = state.full_n_segments()
            .map_err(|e| format!("Failed to get segments: {}", e))?;

        let mut text = String::new();
        for i in 0..num_segments {
            if let Ok(segment) = state.full_get_segment_text(i) {
                text.push_str(&segment);
            }
        }

        Ok(text.trim().to_string())
    }

    fn flac_to_f32_samples(flac_data: &[u8]) -> Result<(Vec<f32>, u32, u16), String> {
        let cursor = std::io::Cursor::new(flac_data);
        let mut reader = claxon::FlacReader::new(cursor)
            .map_err(|e| format!("Failed to parse FLAC: {}", e))?;

        let info = reader.streaminfo();
        let sample_rate = info.sample_rate;
        let channels = info.channels as u16;
        let bits = info.bits_per_sample;
        let max_val = (1u32 << (bits - 1)) as f32;

        let samples: Vec<f32> = reader
            .samples()
            .filter_map(|s| s.ok())
            .map(|s| s as f32 / max_val)
            .collect();

        Ok((samples, sample_rate, channels))
    }

    fn wav_to_f32_samples(wav_data: &[u8]) -> Result<(Vec<f32>, u32, u16), String> {
        let cursor = std::io::Cursor::new(wav_data);
        let reader = hound::WavReader::new(cursor)
            .map_err(|e| format!("Failed to parse WAV: {}", e))?;

        let spec = reader.spec();
        let sample_rate = spec.sample_rate;
        let channels = spec.channels;

        let samples: Vec<f32> = match spec.sample_format {
            hound::SampleFormat::Float => {
                reader.into_samples::<f32>()
                    .filter_map(|s| s.ok())
                    .collect()
            }
            hound::SampleFormat::Int => {
                let bits = spec.bits_per_sample;
                let max_val = (1u32 << (bits - 1)) as f32;
                reader.into_samples::<i32>()
                    .filter_map(|s| s.ok())
                    .map(|s| s as f32 / max_val)
                    .collect()
            }
        };

        Ok((samples, sample_rate, channels))
    }

    fn ensure_16khz(parsed: &(Vec<f32>, u32, u16), _raw: &[u8]) -> Result<Vec<f32>, String> {
        let (samples, sample_rate, channels) = parsed;

        // Convert to mono if stereo
        let mono: Vec<f32> = if *channels > 1 {
            samples
                .chunks(*channels as usize)
                .map(|chunk| chunk.iter().sum::<f32>() / *channels as f32)
                .collect()
        } else {
            samples.clone()
        };

        // Resample to 16kHz if needed
        if *sample_rate == 16000 {
            return Ok(mono);
        }

        let ratio = 16000.0 / *sample_rate as f64;
        let new_len = (mono.len() as f64 * ratio) as usize;
        let mut resampled = Vec::with_capacity(new_len);

        for i in 0..new_len {
            let src_idx = i as f64 / ratio;
            let idx = src_idx as usize;
            let frac = src_idx - idx as f64;

            if idx + 1 < mono.len() {
                let sample = mono[idx] as f64 * (1.0 - frac) + mono[idx + 1] as f64 * frac;
                resampled.push(sample as f32);
            } else if idx < mono.len() {
                resampled.push(mono[idx]);
            }
        }

        Ok(resampled)
    }
}

fn num_cpus() -> i32 {
    let cpus = std::thread::available_parallelism()
        .map(|n| n.get() as i32)
        .unwrap_or(4);
    // Use at most 4 threads for whisper to avoid hogging all CPU
    cpus.min(4)
}
