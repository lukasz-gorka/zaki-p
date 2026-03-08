import {isRegistered, register, unregister} from "@tauri-apps/plugin-global-shortcut";
import {G} from "../appInitializer/module/G.ts";
import {store} from "../appInitializer/store";
import {createCompositeModelId, parseModelId} from "../integrations/ai/interface/AIModel.ts";
import {agentService} from "../integrations/ai/sdk";
import {Logger} from "../logger/Logger.ts";
import {PluginRegistry} from "../plugins/PluginRegistry.ts";
import type {AudioRecordingResult, AudioRecordingSession} from "../rustProxy/interface/AudioTypes.ts";
import {getSkillModule} from "../skills/plugin.ts";
import {copyToClipboard} from "../utils/clipboard.ts";
import {parseApiErrorMessage, showConfigError} from "../utils/configErrors.ts";
import {toast} from "../views/ui/use-toast.ts";
import {AudioPlayer} from "./audio/AudioPlayer.ts";
import {saveAudioFile} from "./audioFileStorage.ts";
import {IVoiceSettings, TranscriptionHistoryItem} from "./interfaces/IVoiceSettings.ts";
import {VoiceStoreManager} from "./store/VoiceStoreManager.ts";

interface VoiceModuleDeps {
    storeManager: VoiceStoreManager;
}

export class VoiceModule {
    private storeManager: VoiceStoreManager;

    private currentSession: AudioRecordingSession | null = null;
    private abortRequested: boolean = false;
    private isStartingRecording: boolean = false;
    private audioPlayer: AudioPlayer = new AudioPlayer();
    private pendingSkillId: string | null = null;

    constructor(deps: VoiceModuleDeps) {
        this.storeManager = deps.storeManager;
        G.statusPopup?.setPopupActionHandler((action) => this.handlePopupAction(action));
    }

    private chatResponseUnsub: (() => void) | null = null;

    public state = (): IVoiceSettings => this.storeManager.state();

    public toggleAutoReadResponses(): void {
        const current = this.state().autoReadResponses ?? false;
        this.storeManager.setAutoReadResponses(!current);

        if (!current) {
            this.setupChatResponseListener();
        } else {
            this.teardownChatResponseListener();
        }
    }

    public setupChatResponseListener(): void {
        if (this.chatResponseUnsub) return;
        this.chatResponseUnsub = G.events.on("chat:response-ready", (data: {content: string}) => {
            const settings = this.state();
            if (settings.autoReadResponses && settings.speechToSpeech.ttsModel?.trim()) {
                this.speak(data.content);
            }
        });
    }

    private teardownChatResponseListener(): void {
        if (this.chatResponseUnsub) {
            this.chatResponseUnsub();
            this.chatResponseUnsub = null;
        }
    }

    public async toggleRecordingForVoiceMode(): Promise<void> {
        const isRecording = this.currentSession !== null;
        const isStarting = this.isStartingRecording;

        if (isRecording) {
            await this.stopRecordingForVoiceMode();
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
            await this.startRecordingLightweight();
        }
    }

    private async startRecordingLightweight(): Promise<void> {
        if (this.isStartingRecording) return;
        this.isStartingRecording = true;

        try {
            this.storeManager.setRecordingState(true);

            const settings = this.state();
            this.currentSession = await G.rustProxy.startAudioRecording({
                echo_cancellation: true,
                noise_suppression: true,
                auto_gain_control: true,
                device_id: settings.speechToText.inputDeviceId || undefined,
            });

            if (settings.speechToText.playSoundNotification) {
                G.rustProxy.playNotificationSound("start");
            }

            this.isStartingRecording = false;
        } catch (error) {
            this.isStartingRecording = false;
            this.currentSession = null;
            this.storeManager.setRecordingState(false);
            Logger.error("[VoiceModule] Failed to start lightweight recording:", {error});

            const errorMessage = error instanceof Error ? error.message : String(error);
            toast({
                title: "Recording failed",
                description: errorMessage,
                variant: "destructive",
            });
        }
    }

    private async stopRecordingForVoiceMode(): Promise<void> {
        try {
            if (!this.currentSession) throw new Error("No active recording");

            const result = await G.rustProxy.stopAudioRecording(this.currentSession.session_id);
            const audioBlob = this.audioResultToBlob(result);

            this.currentSession = null;
            this.storeManager.transitionRecordingToTranscribing();

            const settings = this.state();
            if (settings.speechToText.playSoundNotification) {
                G.rustProxy.playNotificationSound("stop");
            }

            const transcribeOperationId = `transcribe-${Date.now()}`;

            const sttParsed = parseModelId(settings.speechToText.sttModel);
            if (!sttParsed) throw new Error("STT model not configured");

            const {text: transcription} = await agentService.transcribeAudio(
                audioBlob,
                {
                    providerId: sttParsed.providerId,
                    model: sttParsed.modelId,
                    language: settings.speechToText.language,
                    prompt: settings.speechToText.prompt,
                },
                transcribeOperationId,
            );

            this.storeManager.setTranscribingState(false);

            if (this.abortRequested) {
                this.abortRequested = false;
                return;
            }

            G.events.emit("voice:transcription-ready", {text: transcription});
        } catch (error) {
            this.currentSession = null;
            this.storeManager.setRecordingState(false);
            this.storeManager.setTranscribingState(false);
            Logger.error("[VoiceModule] Voice mode transcription failed:", {error});

            const errorMessage = error instanceof Error ? error.message : String(error);
            toast({
                title: "Transcription failed",
                description: errorMessage,
                variant: "destructive",
            });
        }
    }

    public async speak(text: string): Promise<void> {
        const settings = this.state();
        const s2s = settings.speechToSpeech;

        const ttsParsed = parseModelId(s2s.ttsModel);
        if (!ttsParsed) {
            Logger.warn("[VoiceModule] No TTS model configured for speak()");
            return;
        }

        try {
            this.storeManager.setSpeakingState(true);
            const compositeModelId = createCompositeModelId(ttsParsed.providerId, ttsParsed.modelId);

            const audioData = await agentService.textToSpeech({
                compositeModelId,
                text,
                voice: s2s.ttsVoice,
                speed: s2s.ttsSpeed,
            });

            await this.audioPlayer.play(audioData);
            this.storeManager.setSpeakingState(false);
        } catch (error) {
            this.storeManager.setSpeakingState(false);
            Logger.error("[VoiceModule] speak() failed:", {error});
            showConfigError({title: "Text-to-Speech Failed", description: parseApiErrorMessage(error)});
        }
    }

    public async executeSkillWithVoice(skillId: string): Promise<void> {
        this.pendingSkillId = skillId;
        await this.toggleRecordingForChat();
    }

    public async toggleRecordingForChat(): Promise<void> {
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
                this.pendingSkillId = null;
                return;
            }

            if (this.pendingSkillId) {
                const skill = getSkillModule().getSkillById(this.pendingSkillId);
                if (!skill) {
                    showConfigError({title: "Skill not found", description: "The selected skill no longer exists."});
                    this.pendingSkillId = null;
                    return;
                }
                if (!skill.model) {
                    showConfigError({title: `Skill "${skill.label}" has no model`, description: "Please assign a model in skill settings."});
                    this.pendingSkillId = null;
                    return;
                }
                const skillModelParsed = parseModelId(skill.model);
                if (skillModelParsed) {
                    const providers = store.getState().provider?.collection || [];
                    const providerExists = providers.some((p: any) => p.uuid === skillModelParsed.providerId || p.id === skillModelParsed.providerId);
                    if (!providerExists) {
                        showConfigError({title: "Provider not found", description: `Provider for skill "${skill.label}" may have been removed.`});
                        this.pendingSkillId = null;
                        return;
                    }
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
            this.pendingSkillId = null;

            this.storeManager.setRecordingState(false);
            this.storeManager.setTranscribingState(false);
            await this.unregisterEscapeShortcut();
            await G.statusPopup.hide();
        } catch (error) {
            this.currentSession = null;
            this.pendingSkillId = null;
            this.storeManager.setRecordingState(false);
            this.storeManager.setTranscribingState(false);
            await this.unregisterEscapeShortcut();
            await G.statusPopup.hide();
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

        // AI operations now use AbortController (handled by AgentService)
        // No explicit abort needed — forceReset clears the state

        await this.forceReset();
    }

    private async handlePopupAction(action: string): Promise<void> {
        if (PluginRegistry.handlePopupAction(action)) {
            return;
        }

        if (action === "stop") {
            await this.toggleRecordingForChat();
        } else if (action === "stop-speaking") {
            this.stopSpeaking();
            await G.statusPopup.hide();
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
            await G.statusPopup.show();

            const settings = this.state();
            this.currentSession = await G.rustProxy.startAudioRecording({
                echo_cancellation: true,
                noise_suppression: true,
                auto_gain_control: true,
                device_id: settings.speechToText.inputDeviceId || undefined,
            });

            await G.statusPopup.setState("recording");

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
            this.pendingSkillId = null;
            this.storeManager.setRecordingState(false);
            await G.statusPopup.hide();
            await this.unregisterEscapeShortcut();
            Logger.error("[VoiceModule] Failed to start recording:", {error});

            const isPermissionError =
                errorMessage.toLowerCase().includes("permission") || errorMessage.toLowerCase().includes("access") || errorMessage.toLowerCase().includes("denied");

            if (isPermissionError) {
                toast({
                    title: "Microphone access required",
                    description: "Please grant microphone permission in System Settings > Privacy & Security > Microphone, then restart the app.",
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
            PluginRegistry.handleForceReset();
            const wasReset = await G.rustProxy.resetAudioRecording();
            this.currentSession = null;
            this.isStartingRecording = false;
            this.abortRequested = false;
            this.pendingSkillId = null;
            this.audioPlayer.stop();
            this.storeManager.setRecordingState(false);
            this.storeManager.setTranscribingState(false);
            this.storeManager.setProcessingState(false);
            this.storeManager.setSpeakingState(false);
            await this.unregisterEscapeShortcut();
            await G.statusPopup.hide();

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
            await G.statusPopup.setState("transcribing");

            const settings = this.state();

            if (settings.speechToText.playSoundNotification) {
                G.rustProxy.playNotificationSound("stop");
            }

            const transcribeOperationId = `transcribe-${Date.now()}`;

            const sttParsed = parseModelId(settings.speechToText.sttModel);
            if (!sttParsed) {
                throw new Error("STT model not configured");
            }

            const {text: transcription} = await agentService.transcribeAudio(
                audioBlob,
                {
                    providerId: sttParsed.providerId,
                    model: sttParsed.modelId,
                    language: settings.speechToText.language,
                    prompt: settings.speechToText.prompt,
                },
                transcribeOperationId,
            );

            if (this.abortRequested) {
                this.abortRequested = false;
                this.pendingSkillId = null;
                return;
            }

            let finalText = transcription;
            const skillId = this.pendingSkillId;
            this.pendingSkillId = null;

            // If a skill is pending, process through the skill
            if (skillId) {
                const skill = getSkillModule().getSkillById(skillId);
                if (skill && skill.model) {
                    this.storeManager.transitionTranscribingToProcessing();
                    await G.statusPopup.setState("processing");

                    let clipboardForSkill;
                    try {
                        const {readSmartClipboard} = await import("../utils/clipboard.ts");
                        clipboardForSkill = await readSmartClipboard();
                    } catch {
                        /* clipboard unavailable */
                    }
                    const skillResult = await getSkillModule().executeSkill(skill, transcription, {clipboard: clipboardForSkill});

                    if (this.abortRequested) {
                        this.abortRequested = false;
                        return;
                    }

                    if (skillResult) {
                        finalText = skillResult;
                    }

                    this.storeManager.setProcessingState(false);
                } else {
                    this.storeManager.setTranscribingState(false);
                    Logger.warn("[VoiceModule] Pending skill not found or no model configured, using raw transcription");
                }
            } else {
                this.storeManager.setTranscribingState(false);
            }

            await G.statusPopup.hide();

            const historyItem: TranscriptionHistoryItem = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                text: finalText,
                timestamp: Date.now(),
                modelName: sttParsed.modelId,
                ...(skillId &&
                    finalText !== transcription && {
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
            this.pendingSkillId = null;

            if (this.abortRequested) {
                this.abortRequested = false;
                return;
            }

            this.currentSession = null;
            this.storeManager.setRecordingState(false);
            this.storeManager.setTranscribingState(false);
            this.storeManager.setProcessingState(false);
            await this.unregisterEscapeShortcut();
            await G.statusPopup.hide();
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

                Logger.warn("[VoiceModule] Accessibility permissions not granted. User should:", {
                    data: {
                        steps: ["1. Open System Settings", "2. Go to Privacy & Security > Accessibility", "3. Enable zaki-p", "4. Restart the app"],
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

    public stopSpeaking(): void {
        this.audioPlayer.stop();
        this.storeManager.setSpeakingState(false);
    }

    public async clearHistory(): Promise<void> {
        this.storeManager.clearTranscriptionHistory();
    }

    public async removeTranscription(id: string): Promise<void> {
        this.storeManager.removeTranscriptionFromHistory(id);
    }
}
