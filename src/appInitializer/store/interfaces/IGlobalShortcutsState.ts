import {GlobalShortcut} from "../../../globalShortcuts/GlobalShortcut.ts";

export interface IGlobalShortcutsState {
    shortcuts: GlobalShortcut[];
    isInitialized: boolean;
}
