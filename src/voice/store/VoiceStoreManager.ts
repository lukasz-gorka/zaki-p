import {StoreManager} from "../../appInitializer/store/StoreManager.ts";
import {ConversationMessage, ConversationSession, TranscriptionHistoryItem} from "../interfaces/IVoiceSettings.ts";

export class VoiceStoreManager extends StoreManager<"voice"> {
    constructor() {
        super("voice");
    }

    public addTranscriptionToHistory = (transcription: TranscriptionHistoryItem) => {
        this.updateState((voice) => ({
            ...voice,
            transcriptionHistory: [...(voice?.transcriptionHistory ?? []), transcription],
        }));
    };

    public clearTranscriptionHistory = () => {
        this.updateState((voice) => ({
            ...voice,
            transcriptionHistory: [],
        }));
    };

    public removeTranscriptionFromHistory = (id: string) => {
        this.updateState((voice) => ({
            ...voice,
            transcriptionHistory: (voice?.transcriptionHistory ?? []).filter((item) => item.id !== id),
        }));
    };

    public setRecordingState = (isRecording: boolean) => {
        this.updateState((voice) => ({
            ...voice,
            isRecording,
            recordingStartTime: isRecording ? Date.now() : undefined,
        }));
    };

    public transitionRecordingToTranscribing = () => {
        this.updateState((voice) => ({
            ...voice,
            isRecording: false,
            recordingStartTime: undefined,
            isTranscribing: true,
            transcribingStartTime: Date.now(),
        }));
    };

    public setTranscribingState = (isTranscribing: boolean) => {
        this.updateState((voice) => ({
            ...voice,
            isTranscribing,
            transcribingStartTime: isTranscribing ? Date.now() : undefined,
        }));
    };

    public transitionTranscribingToEnhancing = () => {
        this.updateState((voice) => ({
            ...voice,
            isTranscribing: false,
            transcribingStartTime: undefined,
            isEnhancing: true,
            enhancingStartTime: Date.now(),
        }));
    };

    public setEnhancingState = (isEnhancing: boolean) => {
        this.updateState((voice) => ({
            ...voice,
            isEnhancing,
            enhancingStartTime: isEnhancing ? Date.now() : undefined,
        }));
    };

    public setEnableAIEnhancement = (enableAIEnhancement: boolean) => {
        this.updateState((voice) => ({
            ...voice,
            enableAIEnhancement,
        }));
    }; //

    public transitionTranscribingToResponding = () => {
        this.updateState((voice) => ({
            ...voice,
            isTranscribing: false,
            transcribingStartTime: undefined,
            isResponding: true,
            respondingStartTime: Date.now(),
        }));
    };

    public setRespondingState = (isResponding: boolean) => {
        this.updateState((voice) => ({
            ...voice,
            isResponding,
            respondingStartTime: isResponding ? Date.now() : undefined,
        }));
    };

    public transitionRespondingToSpeaking = () => {
        this.updateState((voice) => ({
            ...voice,
            isResponding: false,
            respondingStartTime: undefined,
            isSpeaking: true,
            speakingStartTime: Date.now(),
        }));
    };

    public setSpeakingState = (isSpeaking: boolean) => {
        this.updateState((voice) => ({
            ...voice,
            isSpeaking,
            speakingStartTime: isSpeaking ? Date.now() : undefined,
        }));
    };

    public addConversationMessage = (message: ConversationMessage) => {
        this.updateState((voice) => ({
            ...voice,
            conversationHistory: [...(voice?.conversationHistory ?? []), message],
        }));
    };

    public clearConversationHistory = () => {
        this.updateState((voice) => ({
            ...voice,
            conversationHistory: [],
            activeConversationSessionId: undefined,
        }));
    };

    public addConversationSession = (session: ConversationSession) => {
        this.updateState((voice) => ({
            ...voice,
            conversationSessions: [...(voice?.conversationSessions ?? []), session],
            activeConversationSessionId: session.id,
        }));
    };

    public appendToConversationSession = (sessionId: string, userMsg: ConversationMessage, assistantMsg: ConversationMessage) => {
        this.updateState((voice) => ({
            ...voice,
            conversationSessions: (voice?.conversationSessions ?? []).map((s) => (s.id === sessionId ? {...s, messages: [...s.messages, userMsg, assistantMsg]} : s)),
        }));
    };

    public removeConversationSession = (sessionId: string) => {
        this.updateState((voice) => ({
            ...voice,
            conversationSessions: (voice?.conversationSessions ?? []).filter((s) => s.id !== sessionId),
            activeConversationSessionId: voice?.activeConversationSessionId === sessionId ? undefined : voice?.activeConversationSessionId,
        }));
    };

    public clearConversationSessions = () => {
        this.updateState((voice) => ({
            ...voice,
            conversationSessions: [],
            activeConversationSessionId: undefined,
        }));
    };
}
