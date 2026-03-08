import {DEFAULT_LICENSE_STATE} from "../license/interfaces/ILicenseState.ts";
import {PluginRegistry} from "../plugins/PluginRegistry.ts";
import {IGlobalState} from "./store/interfaces/IGlobalState.ts";

export class StateCleanup {
    public static cleanEphemeralState(state: IGlobalState): Partial<IGlobalState> {
        let cleaned: IGlobalState = {
            ...state,
            provider: state.provider,
            globalShortcuts: state.globalShortcuts,
            voice: {
                ...state.voice,
                isRecording: false,
                isProcessing: false,
                isTranscribing: false,
                isSpeaking: false,
            },
            license: DEFAULT_LICENSE_STATE,
        };

        cleaned = PluginRegistry.cleanupEphemeral(cleaned);

        return cleaned;
    }
}
