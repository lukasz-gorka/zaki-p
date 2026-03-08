import {AIProviderConfig} from "../integrations/ai/interface/AIProviderConfig.ts";
import {LocalStoreKey} from "../integrations/storage/consts/LocalStoreKey.ts";
import {IAppLocalData} from "../integrations/storage/interfaces/IAppLocalData.ts";
import {getAppData, setLocalDataByKey} from "../integrations/storage/localStoreActions.ts";
import {SecureStorage} from "../integrations/storage/secureStorage.ts";
import {Logger} from "../logger/Logger.ts";
import {StateCleanup} from "./StateCleanup.ts";
import {store} from "./store";
import {IGlobalState} from "./store/interfaces/IGlobalState.ts";

export class StateAutoSaver {
    private static unsubscribe: (() => void) | null = null;
    private static saveTimeout: ReturnType<typeof setTimeout> | null = null;
    private static readonly DEBOUNCE_MS = 500;
    private static isSaving = false;
    private static lastSavedKeys: Record<string, string> = {};

    public static init() {
        this.unsubscribe = store.subscribe((state: IGlobalState) => {
            this.scheduleSave(state);
        });
    }

    public static cleanup() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
    }

    private static scheduleSave(state: IGlobalState) {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.saveTimeout = setTimeout(() => {
            this.saveState(state);
        }, this.DEBOUNCE_MS);
    }

    private static async saveState(state: IGlobalState) {
        if (this.isSaving) {
            return;
        }

        this.isSaving = true;
        try {
            const cleanedState = StateCleanup.cleanEphemeralState(state);
            await this.saveProviderApiKeys(cleanedState.provider?.collection || []);

            const stateWithoutApiKeys = {
                ...cleanedState,
                provider: cleanedState.provider
                    ? {
                          ...cleanedState.provider,
                          collection: cleanedState.provider.collection.map((p) => ({
                              ...p,
                              apiKey: "",
                          })),
                      }
                    : cleanedState.provider,
            };

            const existingData = await getAppData();
            const localData: IAppLocalData = {
                meta: {
                    version: existingData.meta?.version || 0,
                    lastUpdated: new Date().toISOString(),
                },
                ...stateWithoutApiKeys,
            };

            await setLocalDataByKey(LocalStoreKey.APP_DATA, localData);
        } catch (error) {
            Logger.error("[StateAutoSaver] Failed to save state", {error});
        } finally {
            this.isSaving = false;
        }
    }

    private static async saveProviderApiKeys(providers: AIProviderConfig[]) {
        try {
            const keysToSave: Record<string, string> = {};

            for (const provider of providers) {
                if (provider.apiKey && provider.apiKey.trim().length > 0) {
                    keysToSave[provider.uuid] = provider.apiKey;
                }
            }

            const keysChanged = this.hasKeysChanged(keysToSave);
            if (!keysChanged) {
                return;
            }

            if (Object.keys(keysToSave).length > 0) {
                await SecureStorage.setProviderKeys(keysToSave);
                this.lastSavedKeys = keysToSave;
            }
        } catch (error) {
            Logger.error("[StateAutoSaver] Failed to save provider API keys to secure storage", {error});
        }
    }

    private static hasKeysChanged(newKeys: Record<string, string>): boolean {
        if (Object.keys(newKeys).length !== Object.keys(this.lastSavedKeys).length) {
            return true;
        }

        for (const [uuid, key] of Object.entries(newKeys)) {
            if (this.lastSavedKeys[uuid] !== key) {
                return true;
            }
        }

        return false;
    }

    public static async forceSave() {
        const state = store.getState();
        await this.saveState(state);
    }

    public static initializeLastSavedKeys(keys: Record<string, string>) {
        this.lastSavedKeys = {...keys};
    }
}
