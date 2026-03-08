import {IActivitiesState} from "../../../activities/ActivityRegistry.ts";
import {IAutoUpdateState} from "../../../autoUpdate/interfaces/IAutoUpdateState.ts";
import {AIProviderConfig} from "../../../integrations/ai/interface/AIProviderConfig.ts";
import {ILicenseState} from "../../../license/interfaces/ILicenseState.ts";
import {IVoiceSettings} from "../../../voice/interfaces/IVoiceSettings.ts";
import {IGlobalShortcutsState} from "./IGlobalShortcutsState.ts";

export interface IViewState {
    sidebarOpen: boolean;
}

export interface IGlobalState {
    provider: {
        collection: AIProviderConfig[];
    };
    view: IViewState;
    globalShortcuts: IGlobalShortcutsState;
    voice: IVoiceSettings;
    autoUpdate: IAutoUpdateState;
    activities: IActivitiesState;
    license: ILicenseState;
    // Pro plugin store sections (optional — only populated when pro plugins are loaded)
    [key: string]: any;
}
