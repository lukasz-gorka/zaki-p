export interface AudioRecordingSession {
    session_id: string;
    started_at: number;
    sample_rate: number;
    channels: number;
}

export interface AudioRecordingResult {
    session_id: string;
    duration_ms: number;
    audio_data: number[];
    sample_rate: number;
    audio_format: string;
}

export interface AudioRecordingConfig {
    sample_rate?: number;
    channels?: number;
    echo_cancellation?: boolean;
    noise_suppression?: boolean;
    auto_gain_control?: boolean;
    device_id?: string;
}

export interface AudioDeviceInfo {
    id: string;
    name: string;
    is_default: boolean;
}
