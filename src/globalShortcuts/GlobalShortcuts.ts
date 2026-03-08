import {G} from "../appInitializer/module/G.ts";
import {store} from "../appInitializer/store";
import {Logger} from "../logger/Logger.ts";
import {PluginRegistry} from "../plugins/PluginRegistry.ts";
import {toggleWindow} from "../utils/windowUtils.ts";
import {GlobalShortcut} from "./GlobalShortcut.ts";
import {clearAllGlobalShortcuts, refreshGlobalShortcuts, ShortcutRegistrationError} from "./globalShortcutsConfig.ts";

export class GlobalShortcuts {
    private registrationErrors: ShortcutRegistrationError[] = [];

    public getRegistrationErrors(): ShortcutRegistrationError[] {
        return this.registrationErrors;
    }

    public async refreshShortcuts(): Promise<void> {
        const allShortcuts: GlobalShortcut[] = [];

        const voiceState = store.getState().voice;
        const stt = voiceState.speechToText;

        if (stt?.globalShortcut?.trim()) {
            allShortcuts.push(
                new GlobalShortcut(
                    stt.globalShortcut,
                    async () => {
                        await G.voice.toggleRecordingForChat();
                    },
                    {
                        id: "voice-transcription-toggle",
                        label: "Toggle Voice Transcription",
                        editable: true,
                    },
                ),
            );
        }

        if (stt?.globalShortcutAbort?.trim()) {
            allShortcuts.push(
                new GlobalShortcut(
                    stt.globalShortcutAbort,
                    async () => {
                        await G.voice.cancelProcessing();
                    },
                    {
                        id: "voice-abort",
                        label: "Abort Voice Processing",
                        editable: true,
                    },
                ),
            );
        }

        if (stt?.globalShortcutToggleApp?.trim()) {
            allShortcuts.push(
                new GlobalShortcut(
                    stt.globalShortcutToggleApp,
                    async () => {
                        await toggleWindow();
                    },
                    {
                        id: "toggle-app-visibility",
                        label: "Toggle App Visibility",
                        editable: true,
                    },
                ),
            );
        }

        const pluginShortcuts = PluginRegistry.getShortcuts(voiceState);
        allShortcuts.push(...pluginShortcuts);

        this.registrationErrors = await refreshGlobalShortcuts(allShortcuts);

        const successCount = allShortcuts.length - this.registrationErrors.length;
        if (this.registrationErrors.length > 0) {
            Logger.warn(`[GlobalShortcuts] Registered ${successCount}/${allShortcuts.length} shortcuts (${this.registrationErrors.length} failed)`, {
                data: {shortcuts: allShortcuts, failures: this.registrationErrors},
            });
        } else {
            Logger.info(`[GlobalShortcuts] Registered ${allShortcuts.length} shortcuts`, {data: allShortcuts});
        }
    }

    public async clearAllShortcuts(): Promise<void> {
        await clearAllGlobalShortcuts();
    }
}
