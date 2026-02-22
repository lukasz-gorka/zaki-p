import {DEFAULT_ENHANCEMENT_PROMPT} from "../const/TRANSCRIPTION_ENHANCEMENT_PROMPT.ts";

export interface SpeechToTextSettings {
    sttModel: string; // composite ID: providerId::modelId
    language: string;
    prompt: string;
    globalShortcut: string;
    globalShortcutWithAI: string;
    globalShortcutToggleApp: string;
    globalShortcutAbort: string;
    enhancementPrompt: string;
    enhancementModel: string; // composite ID: providerId::modelId
    copyToClipboard: boolean;
    autoPasteAfterTranscription: boolean;
    playSoundNotification: boolean;
    enableEscapeShortcut: boolean;
}

export interface SpeechToSpeechSettings {
    chatModel: string; // composite ID: providerId::modelId
    ttsModel: string; // composite ID: providerId::modelId
    ttsVoice: string;
    ttsSpeed: number;
    systemPrompt: string;
    globalShortcut: string;
}

export const DEFAULT_SPEECH_TO_SPEECH_SYSTEM_PROMPT =
    "You are a helpful voice assistant. Respond concisely and naturally, as if having a conversation. Keep responses brief unless asked for detail.";

export interface ConversationMessage {
    role: "user" | "assistant";
    content: string;
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

export interface ConversationSession {
    id: string;
    startedAt: number;
    messages: ConversationMessage[];
    modelName?: string;
}

export interface IVoiceSettings {
    speechToText: SpeechToTextSettings;
    speechToSpeech: SpeechToSpeechSettings;
    transcriptionHistory: TranscriptionHistoryItem[];
    conversationSessions: ConversationSession[];
    isRecording?: boolean;
    isTranscribing?: boolean;
    isEnhancing?: boolean;
    isResponding?: boolean;
    isSpeaking?: boolean;
    enableAIEnhancement?: boolean;
    recordingStartTime?: number;
    transcribingStartTime?: number;
    enhancingStartTime?: number;
    respondingStartTime?: number;
    speakingStartTime?: number;
    conversationHistory: ConversationMessage[];
    activeConversationSessionId?: string;
}

export const DEFAULT_VOICE_SETTINGS: IVoiceSettings = {
    speechToText: {
        sttModel: "openai::gpt-4o-mini-transcribe",
        language: "pl-PL",
        prompt: "",
        globalShortcut: "",
        globalShortcutWithAI: "",
        globalShortcutToggleApp: "",
        globalShortcutAbort: "",
        enhancementPrompt: DEFAULT_ENHANCEMENT_PROMPT,
        enhancementModel: "",
        copyToClipboard: true,
        autoPasteAfterTranscription: false,
        playSoundNotification: true,
        enableEscapeShortcut: true,
    },
    speechToSpeech: {
        chatModel: "",
        ttsModel: "openai::tts-1",
        ttsVoice: "alloy",
        ttsSpeed: 1.0,
        systemPrompt: DEFAULT_SPEECH_TO_SPEECH_SYSTEM_PROMPT,
        globalShortcut: "",
    },
    transcriptionHistory: [],
    conversationSessions: [],
    conversationHistory: [],
    isRecording: false,
    isEnhancing: false,
    enableAIEnhancement: true,
};
