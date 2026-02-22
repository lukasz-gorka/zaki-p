import {invoke} from "@tauri-apps/api/core";
import {listen} from "@tauri-apps/api/event";
import {Logger} from "../logger/Logger.ts";
import type {AudioTranscriptionRequest, ChatCompletionRequest, ChatCompletionResponse, ProviderCredentials, TextToSpeechRequest} from "./interface/AITypes.ts";
import type {AudioRecordingConfig, AudioRecordingResult, AudioRecordingSession} from "./interface/AudioTypes.ts";
import type {LocalModelStatus} from "./interface/LocalModelTypes.ts";

export class RustProxy {
    public async chatCompletion(request: ChatCompletionRequest, operationId: string, credentials: ProviderCredentials): Promise<ChatCompletionResponse> {
        try {
            return await invoke<ChatCompletionResponse>("chat_completion", {request, operationId, credentials});
        } catch (error) {
            Logger.error("[RustProxy] chatCompletion failed", {error});
            throw new Error(`Chat completion failed: ${error}`);
        }
    }

    public async transcribeAudio(
        operationId: string,
        audioData: Uint8Array,
        request: AudioTranscriptionRequest,
        credentials: ProviderCredentials,
        audioFormat?: string,
    ): Promise<string> {
        try {
            const audioArray = Array.from(audioData);

            return await invoke<string>("transcribe_audio", {
                operationId,
                audioData: audioArray,
                model: request.model,
                language: request.language,
                prompt: request.prompt,
                audioFormat: audioFormat,
                credentials,
            });
        } catch (error) {
            Logger.error("[RustProxy] transcribeAudio failed", {error});
            throw new Error(`Audio transcription failed: ${error}`);
        }
    }

    public async abortOperation(operationId: string): Promise<void> {
        try {
            await invoke("abort_operation", {operationId});
        } catch (error) {
            Logger.error("[RustProxy] abortOperation failed", {error});
        }
    }

    public async localModelsList(): Promise<LocalModelStatus[]> {
        try {
            return await invoke<LocalModelStatus[]>("local_models_list");
        } catch (error) {
            Logger.error("[RustProxy] localModelsList failed", {error});
            throw new Error(`Failed to list local models: ${error}`);
        }
    }

    public async localModelDownload(modelId: string, onProgress: (progress: number) => void): Promise<void> {
        const unlisten = await listen<number>(`local-model-download-progress-${modelId}`, (event) => {
            onProgress(event.payload);
        });

        try {
            await invoke("local_model_download", {modelId});
        } finally {
            unlisten();
        }
    }

    public async localModelDelete(modelId: string): Promise<void> {
        try {
            await invoke("local_model_delete", {modelId});
        } catch (error) {
            Logger.error("[RustProxy] localModelDelete failed", {error});
            throw new Error(`Failed to delete model: ${error}`);
        }
    }

    public async startAudioRecording(config?: AudioRecordingConfig): Promise<AudioRecordingSession> {
        try {
            return await invoke<AudioRecordingSession>("start_audio_recording", {config});
        } catch (error) {
            Logger.error("[RustProxy] startAudioRecording failed", {error});
            throw new Error(`Failed to start audio recording: ${error}`);
        }
    }

    public async stopAudioRecording(sessionId: string): Promise<AudioRecordingResult> {
        try {
            return await invoke<AudioRecordingResult>("stop_audio_recording", {sessionId});
        } catch (error) {
            Logger.error("[RustProxy] stopAudioRecording failed", {error});
            throw new Error(`Failed to stop audio recording: ${error}`);
        }
    }

    public async cancelAudioRecording(sessionId: string): Promise<void> {
        try {
            await invoke<void>("cancel_audio_recording", {sessionId});
        } catch (error) {
            Logger.error("[RustProxy] cancelAudioRecording failed", {error});
            throw new Error(`Failed to cancel audio recording: ${error}`);
        }
    }

    public async resetAudioRecording(): Promise<boolean> {
        try {
            return await invoke<boolean>("reset_audio_recording");
        } catch (error) {
            Logger.error("[RustProxy] resetAudioRecording failed", {error});
            throw new Error(`Failed to reset audio recording: ${error}`);
        }
    }

    public async secureStorageSet(key: string, value: string): Promise<void> {
        try {
            await invoke("secure_storage_set", {key, value});
        } catch (error) {
            Logger.error(`[RustProxy] secureStorageSet failed: ${key}`, {error});
            throw new Error(`Failed to store secure credential: ${error}`);
        }
    }

    public async secureStorageGet(key: string): Promise<string> {
        try {
            return await invoke<string>("secure_storage_get", {key});
        } catch (error) {
            Logger.error(`[RustProxy] secureStorageGet failed: ${key}`, {error});
            throw new Error(`Failed to retrieve secure credential: ${error}`);
        }
    }

    public async secureStorageDelete(key: string): Promise<void> {
        try {
            await invoke("secure_storage_delete", {key});
        } catch (error) {
            Logger.error(`[RustProxy] secureStorageDelete failed: ${key}`, {error});
            throw new Error(`Failed to delete secure credential: ${error}`);
        }
    }

    public async secureStorageHas(key: string): Promise<boolean> {
        try {
            return await invoke<boolean>("secure_storage_has", {key});
        } catch (error) {
            Logger.error(`[RustProxy] secureStorageHas failed: ${key}`, {error});
            return false;
        }
    }

    public async secureStorageSetProviderKeys(providerKeys: Record<string, string>): Promise<void> {
        try {
            await invoke("secure_storage_set_provider_keys", {providerKeys});
        } catch (error) {
            Logger.error("[RustProxy] secureStorageSetProviderKeys failed", {error});
            throw new Error(`Failed to store provider keys: ${error}`);
        }
    }

    public async secureStorageGetProviderKeys(providerUuids: string[]): Promise<Record<string, string>> {
        try {
            return await invoke<Record<string, string>>("secure_storage_get_provider_keys", {providerUuids});
        } catch (error) {
            Logger.error("[RustProxy] secureStorageGetProviderKeys failed", {error});
            return {};
        }
    }
    public async playNotificationSound(soundType: "start" | "stop" | "copy"): Promise<void> {
        try {
            await invoke("play_notification_sound", {soundType});
        } catch (error) {
            Logger.error("[RustProxy] playNotificationSound failed", {error});
        }
    }

    public async readAudioFileAsWav(filePath: string): Promise<Uint8Array> {
        try {
            const data = await invoke<number[]>("read_audio_file_as_wav", {filePath});
            return new Uint8Array(data);
        } catch (error) {
            Logger.error("[RustProxy] readAudioFileAsWav failed", {error});
            throw error;
        }
    }

    public async simulatePaste(): Promise<void> {
        try {
            await invoke("simulate_paste");
        } catch (error) {
            Logger.error("[RustProxy] simulatePaste failed", {error});
            throw error;
        }
    }

    public async checkAccessibilityPermission(): Promise<boolean> {
        try {
            return await invoke<boolean>("check_accessibility_permission");
        } catch (error) {
            Logger.error("[RustProxy] checkAccessibilityPermission failed", {error});
            return false;
        }
    }

    public async fetchProviderModels(apiKey: string, baseUrl: string): Promise<{id: string; object: string; owned_by?: string}[]> {
        try {
            return await invoke<{id: string; object: string; owned_by?: string}[]>("fetch_provider_models", {apiKey, baseUrl});
        } catch (error) {
            Logger.error("[RustProxy] fetchProviderModels failed", {error});
            throw error;
        }
    }

    public async textToSpeech(operationId: string, request: TextToSpeechRequest, credentials: ProviderCredentials): Promise<Uint8Array> {
        try {
            const audioData = await invoke<number[]>("text_to_speech", {
                operationId,
                text: request.text,
                model: request.model,
                voice: request.voice,
                speed: request.speed,
                credentials,
            });
            return new Uint8Array(audioData);
        } catch (error) {
            Logger.error("[RustProxy] textToSpeech failed", {error});
            throw new Error(`Text-to-speech failed: ${error}`);
        }
    }

    public async localTranscribeAudio(operationId: string, audioData: Uint8Array, modelId: string, language?: string): Promise<string> {
        try {
            const audioArray = Array.from(audioData);

            return await invoke<string>("local_transcribe_audio", {
                operationId,
                audioData: audioArray,
                modelId,
                language,
            });
        } catch (error) {
            Logger.error("[RustProxy] localTranscribeAudio failed", {error});
            throw new Error(`Local transcription failed: ${error}`);
        }
    }
}
