import {load, Store} from "@tauri-apps/plugin-store";

export const storeFileName = import.meta.env.DEV ? "zakip-voice-store.dev.json" : "zakip-voice-store.json";

let _appStore: Store | null = null;

export async function getAppStore(): Promise<Store> {
    if (_appStore) return _appStore;

    try {
        _appStore = await load(storeFileName, {autoSave: false, defaults: {}});
    } catch (error) {
        console.error("[Store] Failed to load store, attempting recovery:", error);
        try {
            const {remove, BaseDirectory} = await import("@tauri-apps/plugin-fs");
            await remove(storeFileName, {baseDir: BaseDirectory.AppData});
        } catch {
            // Ignore removal errors
        }
        _appStore = await load(storeFileName, {autoSave: false, defaults: {}});
    }

    return _appStore;
}
