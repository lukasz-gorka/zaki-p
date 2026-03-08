export interface SpeechToTextSettings {
    sttModel: string; // composite ID: providerId::modelId
    language: string;
    prompt: string;
    globalShortcut: string;
    globalShortcutToggleApp: string;
    globalShortcutAbort: string;
    globalShortcutQuickChat: string;
    copyToClipboard: boolean;
    autoPasteAfterTranscription: boolean;
    playSoundNotification: boolean;
    enableEscapeShortcut: boolean;
    /** Audio input device ID. Empty string means system default. */
    inputDeviceId: string;
}

export interface SpeechToSpeechSettings {
    ttsModel: string; // composite ID: providerId::modelId
    ttsVoice: string;
    ttsSpeed: number;
    globalShortcut: string;
}

export interface TranscriptionHistoryItem {
    id: string;
    text: string;
    timestamp: number;
    rawText?: string;
    isEnhanced?: boolean;
    modelName?: string;
    audioFilePath?: string;
}

export interface IVoiceSettings {
    speechToText: SpeechToTextSettings;
    speechToSpeech: SpeechToSpeechSettings;
    transcriptionHistory: TranscriptionHistoryItem[];
    isRecording?: boolean;
    isTranscribing?: boolean;
    isProcessing?: boolean;
    isSpeaking?: boolean;
    autoReadResponses?: boolean;
    recordingStartTime?: number;
    transcribingStartTime?: number;
    processingStartTime?: number;
    speakingStartTime?: number;
}

export const DEFAULT_VOICE_SETTINGS: IVoiceSettings = {
    speechToText: {
        sttModel: "openai::gpt-4o-mini-transcribe",
        language: "pl-PL",
        prompt: "",
        globalShortcut: "",
        globalShortcutToggleApp: "",
        globalShortcutAbort: "",
        globalShortcutQuickChat: "",
        copyToClipboard: true,
        autoPasteAfterTranscription: false,
        playSoundNotification: true,
        enableEscapeShortcut: true,
        inputDeviceId: "",
    },
    speechToSpeech: {
        ttsModel: "openai::tts-1",
        ttsVoice: "alloy",
        ttsSpeed: 1.0,
        globalShortcut: "",
    },
    transcriptionHistory: [],
    isRecording: false,
    isProcessing: false,
};
