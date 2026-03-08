import {getAppData} from "../integrations/storage/localStoreActions.ts";
import {SecureStorage} from "../integrations/storage/secureStorage.ts";
import {Logger} from "../logger/Logger.ts";
import {PluginRegistry} from "../plugins/PluginRegistry.ts";
import {DEFAULT_SKILL_STORE} from "../skills/interfaces/ISkill.ts";
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
        state = this.ensureDefaultSkills(state);

        store.setState(state);
    }

    private static ensureDefaultSkills(state: IGlobalState): IGlobalState {
        const skills = (state as any).skills;
        if (!skills?.list) return state;

        const defaultByUuid = new Map(DEFAULT_SKILL_STORE.list.map((d) => [d.uuid, d]));
        const existingUuids = new Set(skills.list.map((s: any) => s.uuid));
        const missing = DEFAULT_SKILL_STORE.list.filter((d) => !existingUuids.has(d.uuid));

        const updatedList = skills.list.map((s: any) => {
            const def = defaultByUuid.get(s.uuid);
            if (!def) return s;
            if (s.pro === def.pro) return s;
            return {...s, pro: def.pro ?? undefined};
        });

        const finalList = [...missing, ...updatedList];
        if (missing.length === 0 && finalList.every((s: any, i: number) => s === skills.list[i])) return state;

        if (missing.length > 0) Logger.info(`[StateInitializer] Adding ${missing.length} missing default skill(s)`);
        return {
            ...state,
            skills: {
                ...skills,
                list: finalList,
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
