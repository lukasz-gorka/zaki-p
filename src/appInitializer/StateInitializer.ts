import {createCompositeModelId} from "../integrations/ai/interface/AIModel.ts";
import {getAppData} from "../integrations/storage/localStoreActions.ts";
import {SecureStorage} from "../integrations/storage/secureStorage.ts";
import {Logger} from "../logger/Logger.ts";
import {PluginRegistry} from "../plugins/PluginRegistry.ts";
import {DEFAULT_ENHANCEMENT_PROMPT} from "../voice/const/TRANSCRIPTION_ENHANCEMENT_PROMPT.ts";
import {StateAutoSaver} from "./StateAutoSaver.ts";
import {StateCleanup} from "./StateCleanup.ts";
import {store} from "./store";
import {INITIAL_GLOBAL_STATE} from "./store/const/INITIAL_GLOBAL_STATE.ts";
import {IGlobalState} from "./store/interfaces/IGlobalState.ts";

export class StateInitializer {
    public static async init(): Promise<void> {
        let state = await this.mergeWithLocalData();
        state = await this.mergeWithSecureStorage(state);
        state = StateCleanup.cleanEphemeralState(state) as IGlobalState;
        state = this.migrateVoiceSettings(state);
        state = this.migrateEnhancerToSkill(state);

        store.setState(state);
    }

    private static migrateVoiceSettings(state: IGlobalState): IGlobalState {
        const stt = state.voice?.speechToText as any;
        const s2s = state.voice?.speechToSpeech as any;
        if (!stt && !s2s) return state;

        let changed = false;
        const newStt = {...stt};
        const newS2s = {...s2s};

        // Migrate STT: old providerId + model -> sttModel composite
        if (stt?.providerId && stt?.model && !stt.sttModel) {
            newStt.sttModel = createCompositeModelId(stt.providerId, stt.model);
            changed = true;
        }
        delete newStt.providerId;
        delete newStt.model;

        // Migrate enhancement: old enhancementProviderId + enhancementModel -> enhancementModel composite
        if (stt?.enhancementProviderId && stt?.enhancementModel && !stt.enhancementModel?.includes("::")) {
            newStt.enhancementModel = createCompositeModelId(stt.enhancementProviderId, stt.enhancementModel);
            changed = true;
        }
        delete newStt.enhancementProviderId;

        // Migrate S2S chat: old chatProviderId + chatModel -> chatModel composite
        if (s2s?.chatProviderId && s2s?.chatModel && !s2s.chatModel?.includes("::")) {
            newS2s.chatModel = createCompositeModelId(s2s.chatProviderId, s2s.chatModel);
            changed = true;
        }
        delete newS2s.chatProviderId;

        // Migrate S2S TTS: old ttsProviderId + ttsModel -> ttsModel composite
        if (s2s?.ttsProviderId && s2s?.ttsModel && !s2s.ttsModel?.includes("::")) {
            newS2s.ttsModel = createCompositeModelId(s2s.ttsProviderId, s2s.ttsModel);
            changed = true;
        }
        delete newS2s.ttsProviderId;

        if (changed) {
            Logger.info("[StateInitializer] Migrated voice settings to composite model IDs");
        }

        return {
            ...state,
            voice: {
                ...state.voice,
                speechToText: newStt,
                speechToSpeech: newS2s,
            },
        };
    }

    private static migrateEnhancerToSkill(state: IGlobalState): IGlobalState {
        // One-time migration: move enhancer settings to the default-enhancer skill
        const stt = state.voice?.speechToText as any;
        if (!stt?.enhancementModel?.trim()) return state;

        const skills = (state as any).skills;
        if (!skills?.list) return state;

        const enhancerSkill = skills.list.find((s: any) => s.uuid === "default-enhancer");
        if (!enhancerSkill) return state;

        // Already migrated if skill has a model set
        if (enhancerSkill.model?.trim()) return state;

        Logger.info("[StateInitializer] Migrating enhancer settings to default-enhancer skill");

        const updatedList = skills.list.map((s: any) => {
            if (s.uuid !== "default-enhancer") return s;
            return {
                ...s,
                model: stt.enhancementModel,
                instruction: stt.enhancementPrompt || DEFAULT_ENHANCEMENT_PROMPT,
                keystroke: stt.globalShortcutWithAI || "",
            };
        });

        // Clean up old fields from voice settings
        const newStt = {...stt};
        delete newStt.enhancementModel;
        delete newStt.enhancementPrompt;
        delete newStt.globalShortcutWithAI;

        // Clean up old enableAIEnhancement flag
        const newVoice = {...state.voice, speechToText: newStt};
        delete (newVoice as any).enableAIEnhancement;
        delete (newVoice as any).isEnhancing;
        delete (newVoice as any).enhancingStartTime;

        return {
            ...state,
            voice: newVoice,
            skills: {
                ...skills,
                list: updatedList,
            },
        } as IGlobalState;
    }

    private static async mergeWithLocalData(): Promise<IGlobalState> {
        const pluginDefaults = PluginRegistry.getStoreDefaults();
        const defaultState = {...INITIAL_GLOBAL_STATE, ...pluginDefaults};
        const localData = await getAppData();
        return this.deepMerge(defaultState, localData);
    }

    private static async mergeWithSecureStorage(state: IGlobalState): Promise<IGlobalState> {
        if (!state.provider?.collection || state.provider.collection.length === 0) {
            return state;
        }

        try {
            const uuids = state.provider.collection.map((p) => p.uuid);
            const secureKeys = await SecureStorage.getProviderKeys(uuids);

            state = {
                ...state,
                provider: {
                    ...state.provider,
                    collection: state.provider.collection.map((provider) => ({
                        ...provider,
                        apiKey: secureKeys[provider.uuid] || "",
                    })),
                },
            };

            StateAutoSaver.initializeLastSavedKeys(secureKeys);

            return state;
        } catch (error) {
            Logger.error("[StateInitializer] Failed to load API keys from secure storage", {error});
            return state;
        }
    }

    protected static deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
        const result = {...target} as T;

        for (const key in source) {
            const sourceValue = source[key];
            const targetValue = target[key];

            if (sourceValue === undefined) {
                continue;
            }

            if (sourceValue === null) {
                result[key] = sourceValue as T[Extract<keyof T, string>];
                continue;
            }

            if (this.isPlainObject(targetValue) && this.isPlainObject(sourceValue)) {
                result[key] = this.deepMerge(targetValue, sourceValue) as T[Extract<keyof T, string>];
            } else {
                result[key] = sourceValue as T[Extract<keyof T, string>];
            }
        }

        return result;
    }

    protected static isPlainObject(value: any): value is Record<string, any> {
        return value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
    }
}
