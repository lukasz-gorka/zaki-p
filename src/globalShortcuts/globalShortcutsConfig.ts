import {isRegistered, register, unregister, unregisterAll} from "@tauri-apps/plugin-global-shortcut";
import {Logger} from "../logger/Logger.ts";
import {GlobalShortcut} from "./GlobalShortcut.ts";

const registerKeystroke = async (shortcut: GlobalShortcut): Promise<{success: boolean; error?: string}> => {
    if (!shortcut.keystroke || shortcut.keystroke.trim() === "") {
        return {success: true};
    }

    try {
        const alreadyRegistered = await isRegistered(shortcut.keystroke);

        if (alreadyRegistered) {
            try {
                await unregister(shortcut.keystroke);
            } catch (unregisterError) {
                const errorMsg = `Failed to unregister shortcut ${shortcut.keystroke} (${shortcut.label}). It may be in use by another application.`;
                Logger.warn(errorMsg, {error: unregisterError});
                return {success: false, error: errorMsg};
            }
        }

        await register(shortcut.keystroke, (event) => {
            if (event.state === "Pressed") {
                return shortcut.action();
            }
        });
        return {success: true};
    } catch (error) {
        const errorMsg = `Failed to register shortcut ${shortcut.keystroke} (${shortcut.label}). It may be in use by another application.`;
        Logger.warn(errorMsg, {error});
        return {success: false, error: errorMsg};
    }
};

interface RegistrationResult {
    shortcut: GlobalShortcut;
    success: boolean;
    error?: string;
}

const registerAllGlobalShortcuts = async (shortcuts: Array<GlobalShortcut>): Promise<RegistrationResult[]> => {
    return await Promise.all(
        shortcuts
            .filter((item) => !!item.keystroke)
            .map(async (shortcut: GlobalShortcut): Promise<RegistrationResult> => {
                const result = await registerKeystroke(shortcut);
                return {
                    shortcut,
                    success: result.success,
                    error: result.error,
                };
            }),
    );
};

export const clearAllGlobalShortcuts = async (): Promise<void> => {
    try {
        await unregisterAll();
    } catch (error) {
        Logger.error("Failed to clear all shortcuts", {error});
    }
};

export interface ShortcutRegistrationError {
    keystroke: string;
    label: string;
    error: string;
}

export const refreshGlobalShortcuts = async (shortcuts: Array<GlobalShortcut>): Promise<ShortcutRegistrationError[]> => {
    try {
        await clearAllGlobalShortcuts();
    } catch (error) {
        Logger.error("Failed to clear all shortcuts", {error});
    }

    const results = await registerAllGlobalShortcuts(shortcuts);

    const failures = results
        .filter((r) => !r.success)
        .map(
            (r): ShortcutRegistrationError => ({
                keystroke: r.shortcut.keystroke,
                label: r.shortcut.label || r.shortcut.id || "Unknown",
                error: r.error || "Unknown error",
            }),
        );

    if (failures.length > 0) {
        Logger.warn(`Failed to register ${failures.length} shortcut(s)`, {data: failures});
    }

    return failures;
};
