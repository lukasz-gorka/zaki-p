import {DEFAULT_AUTO_UPDATE_STATE} from "../../../autoUpdate/interfaces/IAutoUpdateState.ts";
import {DEFAULT_IMAGE_GENERATION_SETTINGS} from "../../../consts/IMAGE_GENERATION_CONFIG.ts";
import {DEFAULT_LICENSE_STATE} from "../../../license/interfaces/ILicenseState.ts";
import {DEFAULT_VOICE_SETTINGS} from "../../../voice/interfaces/IVoiceSettings.ts";
import {IGlobalState} from "../interfaces/IGlobalState.ts";

export const INITIAL_GLOBAL_STATE: IGlobalState = {
    provider: {
        collection: [],
    },
    view: {
        sidebarOpen: true,
    },
    globalShortcuts: {
        shortcuts: [],
        isInitialized: false,
    },
    voice: DEFAULT_VOICE_SETTINGS,
    autoUpdate: DEFAULT_AUTO_UPDATE_STATE,
    activities: {activities: []},
    license: DEFAULT_LICENSE_STATE,
    imageGeneration: DEFAULT_IMAGE_GENERATION_SETTINGS,
};
