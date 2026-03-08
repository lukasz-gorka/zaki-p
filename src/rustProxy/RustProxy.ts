import {invoke} from "@tauri-apps/api/core";
import {listen} from "@tauri-apps/api/event";
import {Logger} from "../logger/Logger.ts";
import type {AudioDeviceInfo, AudioRecordingConfig, AudioRecordingResult, AudioRecordingSession} from "./interface/AudioTypes.ts";
import type {CachedLicense, LicenseValidationResponse} from "./interface/LicenseTypes.ts";
import type {LocalModelStatus} from "./interface/LocalModelTypes.ts";

export class RustProxy {
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

    public async listAudioDevices(): Promise<AudioDeviceInfo[]> {
        try {
            return await invoke<AudioDeviceInfo[]>("list_audio_devices");
        } catch (error) {
            Logger.error("[RustProxy] listAudioDevices failed", {error});
            throw new Error(`Failed to list audio devices: ${error}`);
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

    public async executeWebhook(args: {url: string; data: string}): Promise<string> {
        try {
            return await invoke<string>("execute_webhook", {url: args.url, data: args.data});
        } catch (error) {
            Logger.error("[RustProxy] executeWebhook failed", {error});
            throw new Error(`Webhook execution failed: ${error}`);
        }
    }

    public async downloadImage(args: {url: string}): Promise<string> {
        try {
            return await invoke<string>("download_image", {url: args.url});
        } catch (error) {
            Logger.error("[RustProxy] downloadImage failed", {error});
            throw new Error(`Image download failed: ${error}`);
        }
    }

    public async localTranscribeAudio(audioData: Uint8Array, modelId: string, language?: string): Promise<string> {
        try {
            const audioArray = Array.from(audioData);

            return await invoke<string>("local_transcribe_audio", {
                audioData: audioArray,
                modelId,
                language,
            });
        } catch (error) {
            Logger.error("[RustProxy] localTranscribeAudio failed", {error});
            throw new Error(`Local transcription failed: ${error}`);
        }
    }

    public async validateLicense(key: string, backendUrl: string): Promise<LicenseValidationResponse> {
        try {
            return await invoke<LicenseValidationResponse>("license_validate", {key, backendUrl});
        } catch (error) {
            Logger.error("[RustProxy] validateLicense failed", {error});
            throw new Error(`License validation failed: ${error}`);
        }
    }

    public async getLicenseCached(): Promise<CachedLicense | null> {
        try {
            return await invoke<CachedLicense | null>("license_get_cached");
        } catch (error) {
            Logger.error("[RustProxy] getLicenseCached failed", {error});
            return null;
        }
    }

    public async getStoredLicenseKey(): Promise<string | null> {
        try {
            return await invoke<string | null>("license_get_stored_key");
        } catch (error) {
            Logger.error("[RustProxy] getStoredLicenseKey failed", {error});
            return null;
        }
    }

    public async deactivateLicense(backendUrl: string): Promise<void> {
        try {
            await invoke("license_deactivate", {backendUrl});
        } catch (error) {
            Logger.error("[RustProxy] deactivateLicense failed", {error});
            throw new Error(`License deactivation failed: ${error}`);
        }
    }
}
