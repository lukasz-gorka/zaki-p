use biquad::*;

pub fn apply_highpass(samples: &mut [f32], sample_rate: u32) {
    let coeffs = match Coefficients::<f32>::from_params(
        Type::HighPass,
        sample_rate.hz(),
        80.hz(),
        Q_BUTTERWORTH_F32,
    ) {
        Ok(c) => c,
        Err(_) => return,
    };

    let mut filter = DirectForm2Transposed::<f32>::new(coeffs);

    for sample in samples.iter_mut() {
        *sample = filter.run(*sample);
    }
}

pub fn trim_silence(samples: &[f32], sample_rate: u32) -> Vec<f32> {
    if samples.is_empty() {
        return Vec::new();
    }

    let window_size = (sample_rate as usize * 30) / 1000;
    if window_size == 0 || samples.len() < window_size {
        return samples.to_vec();
    }

    let rms_threshold: f32 = 0.004; // -48dB
    let min_speech_samples = (sample_rate as usize * 50) / 1000;
    let bridge_gap_samples = sample_rate as usize * 3;
    let margin_before = sample_rate as usize;
    let margin_after = sample_rate as usize;

    let mut speech_windows: Vec<bool> = Vec::with_capacity(samples.len() / window_size + 1);
    let mut i = 0;
    while i + window_size <= samples.len() {
        let window = &samples[i..i + window_size];
        let sum_sq: f32 = window.iter().map(|&s| s * s).sum();
        let rms = (sum_sq / window_size as f32).sqrt();
        speech_windows.push(rms >= rms_threshold);
        i += window_size;
    }

    if speech_windows.is_empty() {
        return samples.to_vec();
    }

    let mut segments: Vec<(usize, usize)> = Vec::new();
    let mut seg_start: Option<usize> = None;

    for (idx, &is_speech) in speech_windows.iter().enumerate() {
        if is_speech {
            if seg_start.is_none() {
                seg_start = Some(idx);
            }
        } else if let Some(start) = seg_start {
            segments.push((start, idx));
            seg_start = None;
        }
    }
    if let Some(start) = seg_start {
        segments.push((start, speech_windows.len()));
    }

    let min_speech_windows = min_speech_samples / window_size;
    segments.retain(|&(start, end)| (end - start) >= min_speech_windows.max(1));

    if segments.is_empty() {
        return samples.to_vec();
    }

    let bridge_gap_windows = bridge_gap_samples / window_size;
    let mut merged: Vec<(usize, usize)> = Vec::new();
    merged.push(segments[0]);

    for &(start, end) in &segments[1..] {
        let last = merged.last_mut().unwrap();
        if start <= last.1 + bridge_gap_windows {
            last.1 = end;
        } else {
            merged.push((start, end));
        }
    }

    let first_sample = merged.first().unwrap().0 * window_size;
    let last_sample = (merged.last().unwrap().1 * window_size).min(samples.len());

    let trim_start = first_sample.saturating_sub(margin_before);
    let trim_end = (last_sample + margin_after).min(samples.len());

    samples[trim_start..trim_end].to_vec()
}

pub fn normalize_peak(samples: &mut [f32], target_peak: f32) {
    let peak = samples.iter().map(|&s| s.abs()).fold(0.0f32, f32::max);

    if peak < 1e-10 {
        return;
    }

    let gain = target_peak / peak;

    for sample in samples.iter_mut() {
        *sample *= gain;
    }
}

pub fn process_audio(samples: &[f32], sample_rate: u32) -> Vec<f32> {
    let mut processed = samples.to_vec();
    apply_highpass(&mut processed, sample_rate);
    processed = trim_silence(&processed, sample_rate);
    normalize_peak(&mut processed, 0.9);
    processed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_silence() {
        let mut silence = vec![0.0f32; 100];
        normalize_peak(&mut silence, 0.9);
        assert!(silence.iter().all(|&s| s == 0.0));
    }

    #[test]
    fn test_normalize_loud() {
        let mut samples = vec![0.0, 0.5, -0.5, 0.3];
        normalize_peak(&mut samples, 0.9);
        let peak = samples.iter().map(|&s| s.abs()).fold(0.0f32, f32::max);
        assert!((peak - 0.9).abs() < 1e-6);
    }

    #[test]
    fn test_trim_silence_preserves_speech() {
        let sample_rate = 48000u32;
        let mut samples = vec![0.0f32; sample_rate as usize * 6];

        let speech_start = sample_rate as usize * 3;
        let speech_len = (sample_rate as usize * 500) / 1000;
        for i in 0..speech_len {
            let t = i as f32 / sample_rate as f32;
            samples[speech_start + i] = (t * 440.0 * 2.0 * std::f32::consts::PI).sin() * 0.5;
        }

        let trimmed = trim_silence(&samples, sample_rate);
        assert!(trimmed.len() < samples.len());
        assert!(!trimmed.is_empty());
    }

    #[test]
    fn test_trim_silence_all_silence() {
        let sample_rate = 48000u32;
        let samples = vec![0.0f32; sample_rate as usize];
        let trimmed = trim_silence(&samples, sample_rate);
        assert_eq!(trimmed.len(), samples.len());
    }

    #[test]
    fn test_process_audio_pipeline() {
        let sample_rate = 48000u32;
        let mut samples = vec![0.0f32; sample_rate as usize];
        for i in 0..samples.len() {
            let t = i as f32 / sample_rate as f32;
            samples[i] = (t * 440.0 * 2.0 * std::f32::consts::PI).sin() * 0.3;
        }

        let result = process_audio(&samples, sample_rate);
        assert!(!result.is_empty());
        let peak = result.iter().map(|&s| s.abs()).fold(0.0f32, f32::max);
        assert!((peak - 0.9).abs() < 0.05);
    }
}
