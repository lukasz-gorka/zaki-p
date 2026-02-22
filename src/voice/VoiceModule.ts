import {emitTo, listen} from "@tauri-apps/api/event";
import {WebviewWindow} from "@tauri-apps/api/webviewWindow";
import {isRegistered, register, unregister} from "@tauri-apps/plugin-global-shortcut";
import {G} from "../appInitializer/module/G.ts";
import {store} from "../appInitializer/store";
import {AIService} from "../integrations/ai/AIService.ts";
import {parseModelId} from "../integrations/ai/interface/AIModel.ts";
import {Logger} from "../logger/Logger.ts";
import {ChatCompletionRequest, ProviderCredentials} from "../rustProxy/interface/AITypes.ts";
import type {AudioRecordingResult, AudioRecordingSession} from "../rustProxy/interface/AudioTypes.ts";
import {copyToClipboard} from "../utils/clipboard.ts";
import {toast} from "../views/ui/use-toast.ts";
import {AudioPlayer} from "./audio/AudioPlayer.ts";
import {saveAudioFile} from "./audioFileStorage.ts";
import {RECORDING_POPUP_LABEL} from "./const/RECORDING_POPUP_LABEL.ts";
import {DEFAULT_ENHANCEMENT_PROMPT} from "./const/TRANSCRIPTION_ENHANCEMENT_PROMPT.ts";
import {IVoiceSettings, TranscriptionHistoryItem} from "./interfaces/IVoiceSettings.ts";
import {VoiceStoreManager} from "./store/VoiceStoreManager.ts";

interface VoiceModuleDeps {
    storeManager: VoiceStoreManager;
    ai: AIService;
}

export class VoiceModule {
    private storeManager: VoiceStoreManager;
    private ai: AIService;

    private currentSession: AudioRecordingSession | null = null;
    private popupActionUnlisten: (() => void) | null = null;
    private currentOperationId: string | null = null;
    private abortRequested: boolean = false;
    private isStartingRecording: boolean = false;
    private audioPlayer: AudioPlayer = new AudioPlayer();
    private isConversationMode: boolean = false;

    constructor(deps: VoiceModuleDeps) {
        this.storeManager = deps.storeManager;
        this.ai = deps.ai;
    }

    public state = (): IVoiceSettings => this.storeManager.state();

    public setEnableAIEnhancement = (enable: boolean): void => {
        this.storeManager.setEnableAIEnhancement(enable);
    };

    public async toggleRecordingForChat(withAI?: boolean): Promise<void> {
        if (withAI !== undefined) {
            this.storeManager.setEnableAIEnhancement(withAI);
        }

        const isRecording = this.currentSession !== null;
        const isStarting = this.isStartingRecording;

        if (isRecording) {
            await this.stopRecordingAndTranscribe();
        } else if (!isStarting) {
            const settings = this.state();

            const sttParsed = parseModelId(settings.speechToText.sttModel);
            if (!sttParsed) {
                toast({
                    title: "No transcription model selected",
                    description: "Please select a Speech-to-Text model in settings before recording.",
                    variant: "destructive",
                });
                return;
            }

            const enableAI = withAI ?? settings.enableAIEnhancement ?? false;
            if (enableAI) {
                const enhancementParsed = parseModelId(settings.speechToText.enhancementModel);
                if (!enhancementParsed || !this.isEnhancementProviderValid(enhancementParsed.providerId)) {
                    toast({
                        title: "AI Enhancement not configured",
                        description: "Please select an enhancement model in settings, or disable AI Enhancement.",
                        variant: "destructive",
                    });
                    return;
                }
            }

            await this.startRecording();
        } else {
            Logger.warn("[VoiceModule] Recording start already in progress, ignoring duplicate call");
        }
    }

    public async cancelRecording(): Promise<void> {
        if (!this.currentSession) {
            Logger.warn("[VoiceModule] No active recording to cancel");
            return;
        }

        try {
            await G.rustProxy.cancelAudioRecording(this.currentSession.session_id);
            this.currentSession = null;

            this.storeManager.setRecordingState(false);
            this.storeManager.setTranscribingState(false);
            await this.unregisterEscapeShortcut();
            await this.closeRecordingPopup();
        } catch (error) {
            this.currentSession = null;
            this.storeManager.setRecordingState(false);
            this.storeManager.setTranscribingState(false);
            await this.unregisterEscapeShortcut();
            await this.closeRecordingPopup();
            Logger.error("[VoiceModule] Failed to cancel recording:", {error});
        }
    }

    public async cancelProcessing(): Promise<void> {
        if (this.currentSession) {
            try {
                await G.rustProxy.cancelAudioRecording(this.currentSession.session_id);
            } catch (error) {
                Logger.warn("[VoiceModule] Failed to cancel recording session:", {error});
            }
        }

        if (this.currentOperationId) {
            try {
                await G.rustProxy.abortOperation(this.currentOperationId);
            } catch (error) {
                Logger.warn("[VoiceModule] Failed to abort operation (may have already finished):", {error});
            }
        }

        await this.forceReset();
    }

    private async handlePopupAction(action: string): Promise<void> {
        if (action === "stop") {
            if (this.isConversationMode) {
                await this.toggleRecordingForConversation();
            } else {
                await this.toggleRecordingForChat();
            }
        } else if (action === "stop-speaking") {
            this.stopSpeaking();
            await this.closeRecordingPopup();
        } else if (action === "cancel") {
            this.audioPlayer.stop();
            await this.cancelProcessing();
        }
    }

    private async registerEscapeShortcut(): Promise<void> {
        const settings = this.state();
        if (!settings.speechToText.enableEscapeShortcut) {
            return;
        }

        try {
            const alreadyRegistered = await isRegistered("Escape");
            if (alreadyRegistered) {
                await unregister("Escape");
            }

            await register("Escape", (event) => {
                if (event.state === "Pressed") {
                    this.cancelRecording();
                }
            });
        } catch (error) {
            Logger.error("[VoiceModule] Failed to register Escape shortcut:", {error});
        }
    }

    private async unregisterEscapeShortcut(): Promise<void> {
        try {
            const registered = await isRegistered("Escape");
            if (registered) {
                await unregister("Escape");
            }
        } catch (error) {
            Logger.error("[VoiceModule] Failed to unregister Escape shortcut:", {error});
        }
    }

    private async startRecording(isRetry: boolean = false): Promise<void> {
        if (this.isStartingRecording) {
            Logger.warn("[VoiceModule] Recording start already in progress, skipping");
            return;
        }

        this.isStartingRecording = true;

        try {
            this.storeManager.setRecordingState(true);
            await this.showRecordingPopup();

            this.currentSession = await G.rustProxy.startAudioRecording({
                echo_cancellation: true,
                noise_suppression: true,
                auto_gain_control: true,
            });

            await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "recording"});

            const settings = this.state();
            if (settings.speechToText.playSoundNotification) {
                G.rustProxy.playNotificationSound("start");
            }

            await this.registerEscapeShortcut();

            this.isStartingRecording = false;
        } catch (error) {
            this.isStartingRecording = false;
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (!isRetry && errorMessage.includes("already in progress")) {
                const wasReset = await this.forceReset();
                if (wasReset) {
                    return this.startRecording(true);
                }
            }

            this.currentSession = null;
            this.storeManager.setRecordingState(false);
            await this.closeRecordingPopup();
            await this.unregisterEscapeShortcut();
            Logger.error("[VoiceModule] Failed to start recording:", {error});

            // Check if it's a permissions error
            const isPermissionError =
                errorMessage.toLowerCase().includes("permission") || errorMessage.toLowerCase().includes("access") || errorMessage.toLowerCase().includes("denied");

            if (isPermissionError) {
                toast({
                    title: "Microphone access required",
                    description: "Please grant microphone permission in System Settings → Privacy & Security → Microphone, then restart the app.",
                    variant: "destructive",
                    duration: 10000,
                });
            } else {
                toast({
                    title: "Recording failed",
                    description: errorMessage,
                    variant: "destructive",
                });
            }

            throw error;
        }
    }

    public async forceReset(): Promise<boolean> {
        try {
            const wasReset = await G.rustProxy.resetAudioRecording();
            this.currentSession = null;
            this.isStartingRecording = false;
            this.abortRequested = false;
            this.isConversationMode = false;
            this.currentOperationId = null;
            this.audioPlayer.stop();
            this.storeManager.setRecordingState(false);
            this.storeManager.setTranscribingState(false);
            this.storeManager.setEnhancingState(false);
            this.storeManager.setRespondingState(false);
            this.storeManager.setSpeakingState(false);
            await this.unregisterEscapeShortcut();
            await this.closeRecordingPopup();

            if (wasReset) {
                Logger.info("[VoiceModule] Force reset cleared stuck recording");
                toast({
                    title: "Recording reset",
                    description: "Stuck recording state was cleared",
                });
            }

            return wasReset;
        } catch (error) {
            Logger.error("[VoiceModule] Force reset failed:", {error});
            return false;
        }
    }

    private async setupPopupActionListener(): Promise<void> {
        if (this.popupActionUnlisten) return;

        try {
            this.popupActionUnlisten = await listen<{action: string}>("voice-popup-action", (event) => {
                this.handlePopupAction(event.payload.action);
            });
        } catch (error) {
            Logger.error("[VoiceModule] Failed to setup popup action listener:", {error});
        }
    }

    private cleanupPopupActionListener(): void {
        if (this.popupActionUnlisten) {
            this.popupActionUnlisten();
            this.popupActionUnlisten = null;
        }
    }

    private async showRecordingPopup(): Promise<void> {
        try {
            await this.setupPopupActionListener();

            const existing = await WebviewWindow.getByLabel(RECORDING_POPUP_LABEL);

            if (existing) {
                // Reposition to bottom-center of current monitor
                const {primaryMonitor, currentMonitor} = await import("@tauri-apps/api/window");
                const {PhysicalPosition} = await import("@tauri-apps/api/window");
                let mon = await currentMonitor().catch(() => null);
                if (!mon) mon = await primaryMonitor().catch(() => null);

                if (mon) {
                    const actualSize = await existing.outerSize();
                    const offsetY = 12;
                    const fx = (mon.position?.x || 0) + ((mon.size?.width || 1920) - actualSize.width) / 2;
                    const fy = (mon.position?.y || 0) + (mon.size?.height || 1080) - actualSize.height - offsetY;
                    await existing.setPosition(new PhysicalPosition(fx, fy));
                }

                await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "initializing"});
                await existing.show();
                return;
            }

            const {primaryMonitor, currentMonitor} = await import("@tauri-apps/api/window");
            let monitor = null;

            try {
                monitor = await currentMonitor();
            } catch (error) {
                // Fallback to primary monitor
            }

            if (!monitor) {
                try {
                    monitor = await primaryMonitor();
                } catch (error) {
                    Logger.warn("[VoiceModule] Could not get primary monitor, using defaults", {error});
                }
            }

            const width = 280;
            const height = 48;
            const screenWidth = monitor?.size?.width || 1920;
            const screenHeight = monitor?.size?.height || 1080;
            const monitorX = monitor?.position?.x || 0;
            const monitorY = monitor?.position?.y || 0;

            const offsetY = 12;
            const x = monitorX + (screenWidth - width) / 2;
            const y = monitorY + screenHeight - height - offsetY;

            await emitTo("main", "popup-diagnostic", {
                action: "creating",
                position: {x, y},
                size: {width, height},
                monitor: {size: monitor?.size, position: monitor?.position},
            });

            const window = new WebviewWindow(RECORDING_POPUP_LABEL, {
                url: "/recording-popup.html",
                title: "Recording",
                width,
                height,
                x,
                y,
                resizable: false,
                alwaysOnTop: true,
                decorations: false,
                skipTaskbar: true,
                focus: false,
                visible: false,
                transparent: false,
            });

            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Window creation timeout"));
                }, 5000);

                window.once("tauri://created", () => {
                    clearTimeout(timeout);
                    resolve();
                });

                window.once("tauri://error", (e) => {
                    clearTimeout(timeout);
                    Logger.error("[VoiceModule] Window creation error", {error: e});
                    reject(e);
                });
            });

            // Wait a bit for the page to load
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Get actual window size and recalculate position
            const {PhysicalPosition} = await import("@tauri-apps/api/window");
            const actualSize = await window.outerSize();
            const actualWidth = actualSize.width;
            const actualHeight = actualSize.height;

            // Bottom-center position using actual window size
            const finalX = monitorX + (screenWidth - actualWidth) / 2;
            const finalY = monitorY + screenHeight - actualHeight - offsetY;

            await window.setPosition(new PhysicalPosition(finalX, finalY));

            // Emit to main window for visibility
            await emitTo("main", "popup-diagnostic", {
                action: "positioning",
                actualSize: {width: actualWidth, height: actualHeight},
                finalPosition: {x: finalX, y: finalY},
            });

            await window.show();

            await new Promise((resolve) => setTimeout(resolve, 200));

            await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "initializing"});

            await new Promise((resolve) => setTimeout(resolve, 200));

            const isVisible = await window.isVisible();
            const position = await window.outerPosition();

            // Emit final status to main window
            await emitTo("main", "popup-diagnostic", {
                action: "shown",
                isVisible,
                position: {x: position.x, y: position.y},
            });

            if (!isVisible) {
                Logger.warn("[VoiceModule] Window is not visible after show() call - trying to show again");
                await emitTo("main", "popup-diagnostic", {
                    action: "warning",
                    message: "Window not visible after show() - retrying",
                });
                await window.show();
                await window.setFocus();
            }
        } catch (error) {
            Logger.error("[VoiceModule] Failed to show recording popup:", {error});
        }
    }

    private async closeRecordingPopup(): Promise<void> {
        try {
            const existing = await WebviewWindow.getByLabel(RECORDING_POPUP_LABEL);
            if (existing) {
                await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "initializing"});
                await existing.hide();
            }
            this.cleanupPopupActionListener();
        } catch (error) {
            Logger.error("[VoiceModule] Failed to close recording popup:", {error});
        }
    }

    private async stopRecordingAndTranscribe(): Promise<void> {
        try {
            if (!this.currentSession) {
                throw new Error("No active recording");
            }

            const result = await G.rustProxy.stopAudioRecording(this.currentSession.session_id);
            const audioBlob = this.audioResultToBlob(result);

            this.currentSession = null;
            this.storeManager.transitionRecordingToTranscribing();
            await this.unregisterEscapeShortcut();
            await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "transcribing"});

            const settings = this.state();

            if (settings.speechToText.playSoundNotification) {
                G.rustProxy.playNotificationSound("stop");
            }

            const transcribeOperationId = `transcribe-${Date.now()}`;
            this.currentOperationId = transcribeOperationId;

            const sttParsed = parseModelId(settings.speechToText.sttModel);
            if (!sttParsed) {
                throw new Error("STT model not configured");
            }

            const {text: transcription} = await this.ai.audio.transcribe(
                audioBlob,
                {
                    providerId: sttParsed.providerId,
                    model: sttParsed.modelId,
                    language: settings.speechToText.language,
                    prompt: settings.speechToText.prompt,
                },
                transcribeOperationId,
            );

            this.currentOperationId = null;

            if (this.abortRequested) {
                this.abortRequested = false;
                return;
            }

            let finalText = transcription;
            const enableAI = settings.enableAIEnhancement ?? true;
            const enhancementParsed = parseModelId(settings.speechToText.enhancementModel);
            const enhancementProviderExists = enhancementParsed && this.isEnhancementProviderValid(enhancementParsed.providerId);

            if (enableAI && enhancementProviderExists) {
                this.storeManager.transitionTranscribingToEnhancing();
                await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "enhancing"});

                finalText = await this.enhanceTranscription(transcription);

                if (this.abortRequested) {
                    this.abortRequested = false;
                    return;
                }

                this.storeManager.setEnhancingState(false);
            } else {
                this.storeManager.setTranscribingState(false);
            }

            await this.closeRecordingPopup();

            const historyItem: TranscriptionHistoryItem = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                text: finalText,
                timestamp: Date.now(),
                modelName: sttParsed.modelId,
                ...(enableAI &&
                    enhancementProviderExists && {
                        rawText: transcription,
                        isEnhanced: true,
                    }),
            };

            // Save audio file
            try {
                const audioFilePath = await saveAudioFile(historyItem.id, Array.from(result.audio_data), result.audio_format || "wav");
                historyItem.audioFilePath = audioFilePath;
            } catch (saveError) {
                Logger.warn("[VoiceModule] Failed to save audio file:", {error: saveError});
            }

            this.storeManager.addTranscriptionToHistory(historyItem);

            if (settings.speechToText.copyToClipboard) {
                await this.copyToClipboardInternal(finalText);
            }
        } catch (error) {
            this.currentOperationId = null;

            if (this.abortRequested) {
                this.abortRequested = false;
                return;
            }

            this.currentSession = null;
            this.storeManager.setRecordingState(false);
            this.storeManager.setTranscribingState(false);
            this.storeManager.setEnhancingState(false);
            await this.unregisterEscapeShortcut();
            await this.closeRecordingPopup();
            Logger.error("[VoiceModule] Failed to transcribe audio:", {error});

            const errorMessage = error instanceof Error ? error.message : String(error);
            toast({
                title: "Transcription failed",
                description: errorMessage,
                variant: "destructive",
            });

            throw error;
        }
    }

    private async copyToClipboardInternal(text: string): Promise<void> {
        try {
            await copyToClipboard(text);

            const settings = this.state();

            if (settings.speechToText.playSoundNotification) {
                G.rustProxy.playNotificationSound("copy");
            }

            // Auto-paste if enabled
            if (settings.speechToText.autoPasteAfterTranscription) {
                await this.simulatePaste();
            }
        } catch (error) {
            Logger.error("[VoiceModule] Failed to copy to clipboard:", {error});
        }
    }

    private async simulatePaste(): Promise<void> {
        try {
            await new Promise((resolve) => setTimeout(resolve, 200));
            await G.rustProxy.simulatePaste();
        } catch (error) {
            Logger.error("[VoiceModule] Failed to simulate paste:", {error});

            const hasShownPermissionToast = localStorage.getItem("accessibility_permission_toast_shown");

            if (!hasShownPermissionToast) {
                toast({
                    title: "Auto-Paste Requires Accessibility Permissions",
                    description:
                        "Please grant accessibility permissions in System Settings > Privacy & Security > Accessibility, then restart the app. The system dialog should appear only once.",
                    variant: "destructive",
                    duration: 15000,
                });
                localStorage.setItem("accessibility_permission_toast_shown", "true");

                // Log helpful instructions
                Logger.warn("[VoiceModule] Accessibility permissions not granted. User should:", {
                    data: {
                        steps: ["1. Open System Settings", "2. Go to Privacy & Security > Accessibility", "3. Enable ai-assistant-app", "4. Restart the app"],
                    },
                });
            } else {
                Logger.warn("[VoiceModule] Auto-paste failed (permissions likely not granted yet)");
            }
        }
    }

    private audioResultToBlob(result: AudioRecordingResult): Blob {
        const uint8Array = new Uint8Array(result.audio_data);
        const mimeType = result.audio_format === "flac" ? "audio/flac" : "audio/wav";
        return new Blob([uint8Array], {type: mimeType});
    }

    private isEnhancementProviderValid(providerId: string): boolean {
        const globalState = store.getState();
        return globalState.provider.collection.some((p) => p.id === providerId);
    }

    private getEnhancementCredentials(): ProviderCredentials {
        const settings = this.state();
        const parsed = parseModelId(settings.speechToText.enhancementModel);

        if (!parsed) {
            throw new Error("Enhancement model not configured");
        }

        return this.getProviderCredentials(parsed.providerId);
    }

    private async enhanceTranscription(rawText: string): Promise<string> {
        try {
            const operationId = `enhance-${Date.now()}`;
            this.currentOperationId = operationId;
            const settings = this.state();

            const enhancementParsed = parseModelId(settings.speechToText.enhancementModel);
            if (!enhancementParsed) {
                throw new Error("Enhancement model not configured");
            }

            const credentials = this.getEnhancementCredentials();
            const enhancementPrompt = settings.speechToText.enhancementPrompt || DEFAULT_ENHANCEMENT_PROMPT;
            const model = enhancementParsed.modelId;

            const promptWithText = enhancementPrompt.replace("{{{MESSAGE}}}", rawText);

            const request: ChatCompletionRequest = {
                model,
                messages: [
                    {
                        role: "user",
                        content: promptWithText,
                    },
                ],
            };

            const response = await G.rustProxy.chatCompletion(request, operationId, credentials);

            this.currentOperationId = null;

            const enhancedText = response.choices[0]?.message?.content?.trim();

            if (!enhancedText) {
                Logger.warn("[VoiceModule] Enhancement returned empty, using raw text");
                return rawText;
            }

            return enhancedText;
        } catch (error) {
            this.currentOperationId = null;
            Logger.error("[VoiceModule] Enhancement failed, using raw text:", {error});

            const errorMessage = error instanceof Error ? error.message : String(error);
            const userMessage = errorMessage.includes("404")
                ? "Model not available on this provider. Check enhancement model settings."
                : errorMessage.includes("401") || errorMessage.includes("403")
                  ? "Authentication failed. Check provider API key."
                  : "Unexpected error. Check logs for details.";
            toast({
                title: "AI Enhancement failed",
                description: `Using raw transcription. ${userMessage}`,
                variant: "destructive",
            });

            return rawText;
        }
    }

    public async toggleRecordingForConversation(): Promise<void> {
        const isRecording = this.currentSession !== null;
        const isStarting = this.isStartingRecording;

        if (isRecording) {
            this.isConversationMode = true;
            await this.stopRecordingAndConverse();
        } else if (!isStarting) {
            this.isConversationMode = true;
            await this.startRecording();
        } else {
            Logger.warn("[VoiceModule] Recording start already in progress, ignoring duplicate call");
        }
    }

    public stopSpeaking(): void {
        this.audioPlayer.stop();
        this.storeManager.setSpeakingState(false);
    }

    public clearConversationHistory(): void {
        this.storeManager.clearConversationHistory();
    }

    public removeConversationSession(sessionId: string): void {
        this.storeManager.removeConversationSession(sessionId);
    }

    public clearConversationSessions(): void {
        this.storeManager.clearConversationSessions();
        this.storeManager.clearConversationHistory();
    }

    private async stopRecordingAndConverse(): Promise<void> {
        try {
            if (!this.currentSession) {
                throw new Error("No active recording");
            }

            const result = await G.rustProxy.stopAudioRecording(this.currentSession.session_id);
            const audioBlob = this.audioResultToBlob(result);

            this.currentSession = null;
            this.storeManager.transitionRecordingToTranscribing();
            await this.unregisterEscapeShortcut();
            await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "transcribing"});

            const settings = this.state();

            if (settings.speechToText.playSoundNotification) {
                G.rustProxy.playNotificationSound("stop");
            }

            const transcribeOperationId = `transcribe-${Date.now()}`;
            this.currentOperationId = transcribeOperationId;

            const convSttParsed = parseModelId(settings.speechToText.sttModel);
            if (!convSttParsed) {
                throw new Error("STT model not configured");
            }

            const {text: transcription} = await this.ai.audio.transcribe(
                audioBlob,
                {
                    providerId: convSttParsed.providerId,
                    model: convSttParsed.modelId,
                    language: settings.speechToText.language,
                    prompt: settings.speechToText.prompt,
                },
                transcribeOperationId,
            );

            this.currentOperationId = null;

            if (this.abortRequested) {
                this.abortRequested = false;
                return;
            }

            // 2. Send to chat model
            this.storeManager.transitionTranscribingToResponding();
            await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "responding"});

            const s2s = settings.speechToSpeech;
            const chatParsed = parseModelId(s2s.chatModel);
            if (!chatParsed) {
                throw new Error("Chat model not configured");
            }
            const chatCredentials = this.getProviderCredentials(chatParsed.providerId);

            const conversationHistory = this.state().conversationHistory ?? [];
            const messages: any[] = [{role: "system", content: s2s.systemPrompt}, ...conversationHistory, {role: "user", content: transcription}];

            const chatOperationId = `chat-${Date.now()}`;
            this.currentOperationId = chatOperationId;

            const chatResponse = await G.rustProxy.chatCompletion({model: chatParsed.modelId, messages}, chatOperationId, chatCredentials);

            this.currentOperationId = null;

            if (this.abortRequested) {
                this.abortRequested = false;
                return;
            }

            const assistantText = chatResponse.choices[0]?.message?.content?.trim();
            if (!assistantText) {
                throw new Error("Chat model returned empty response");
            }

            // Save conversation history (for context in next turn)
            const userMsg = {role: "user" as const, content: transcription};
            const assistantMsg = {role: "assistant" as const, content: assistantText};
            this.storeManager.addConversationMessage(userMsg);
            this.storeManager.addConversationMessage(assistantMsg);

            // Save to conversation session
            const currentState = this.state();
            const activeSessionId = currentState.activeConversationSessionId;
            if (activeSessionId) {
                this.storeManager.appendToConversationSession(activeSessionId, userMsg, assistantMsg);
            } else {
                const sessionId = `conv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                this.storeManager.addConversationSession({
                    id: sessionId,
                    startedAt: Date.now(),
                    messages: [userMsg, assistantMsg],
                    modelName: chatParsed.modelId,
                });
            }

            // 3. TTS
            this.storeManager.transitionRespondingToSpeaking();
            await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "speaking"});

            const ttsParsed = parseModelId(s2s.ttsModel);
            if (!ttsParsed) {
                throw new Error("TTS model not configured");
            }
            const ttsCredentials = this.getProviderCredentials(ttsParsed.providerId);
            const ttsOperationId = `tts-${Date.now()}`;
            this.currentOperationId = ttsOperationId;

            const audioData = await G.rustProxy.textToSpeech(
                ttsOperationId,
                {model: ttsParsed.modelId, text: assistantText, voice: s2s.ttsVoice, speed: s2s.ttsSpeed},
                ttsCredentials,
            );

            this.currentOperationId = null;

            if (this.abortRequested) {
                this.abortRequested = false;
                this.storeManager.setSpeakingState(false);
                await this.closeRecordingPopup();
                return;
            }

            await this.audioPlayer.play(audioData);

            this.storeManager.setSpeakingState(false);
            await this.closeRecordingPopup();
        } catch (error) {
            this.currentOperationId = null;

            if (this.abortRequested) {
                this.abortRequested = false;
                return;
            }

            this.currentSession = null;
            this.storeManager.setRecordingState(false);
            this.storeManager.setTranscribingState(false);
            this.storeManager.setRespondingState(false);
            this.storeManager.setSpeakingState(false);
            await this.unregisterEscapeShortcut();
            await this.closeRecordingPopup();
            Logger.error("[VoiceModule] Conversation failed:", {error});

            const errorMessage = error instanceof Error ? error.message : String(error);
            toast({
                title: "Conversation failed",
                description: errorMessage,
                variant: "destructive",
            });

            throw error;
        }
    }

    private getProviderCredentials(providerId: string): ProviderCredentials {
        const globalState = store.getState();
        const provider = globalState.provider.collection.find((p) => p.id === providerId);
        if (!provider) {
            throw new Error(`Provider "${providerId}" not found`);
        }
        return {
            api_key: provider.apiKey,
            base_url: provider.baseURL || "https://api.openai.com/v1",
        };
    }

    public async clearHistory(): Promise<void> {
        this.storeManager.clearTranscriptionHistory();
    }

    public async removeTranscription(id: string): Promise<void> {
        this.storeManager.removeTranscriptionFromHistory(id);
    }
}
