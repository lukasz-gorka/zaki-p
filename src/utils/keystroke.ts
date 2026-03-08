import {isMacOS} from "./appEnvironment.ts";

export const MODIFIER_KEYS = ["Alt", "Shift", "Super", "CmdOrCtrl", "Control"];

export const KEY_DISPLAY_NAMES: Record<string, string> = {
    CmdOrCtrl: isMacOS() ? "⌘" : "Ctrl",
    Control: isMacOS() ? "⌃" : "Ctrl",
    Super: isMacOS() ? "⌘" : "Win",
    Alt: isMacOS() ? "⌥" : "Alt",
    Shift: isMacOS() ? "⇧" : "Shift",

    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",

    Escape: isMacOS() ? "⎋" : "Esc",
    Space: "␣",
    " ": "␣",
    Backspace: isMacOS() ? "⌫" : "Backspace",
    Delete: isMacOS() ? "⌦" : "Del",
    Enter: "⏎",
    Tab: isMacOS() ? "⇥" : "Tab",
    CapsLock: isMacOS() ? "⇪" : "CapsLock",

    Home: isMacOS() ? "↖" : "Home",
    End: isMacOS() ? "↘" : "End",
    PageUp: isMacOS() ? "⇞" : "PgUp",
    PageDown: isMacOS() ? "⇟" : "PgDn",
};

export const parseKeystroke = (keystroke: string): string[] => {
    if (!keystroke) return [];
    return keystroke.split("+");
};

export const formatKeyForDisplay = (key: string): string => {
    return KEY_DISPLAY_NAMES[key] || key;
};

export const formatKeysForValue = (keysArray: string[]): string => {
    return keysArray.join("+");
};
