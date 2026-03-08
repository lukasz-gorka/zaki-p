import {useEffect} from "react";

export enum FUNCTION_KEY_NAME {
    SHIFT = "Shift",
    CONTROL = "Control",
    CMD_OR_CTRL = "CmdOrCtrl",
    META = "Meta",
    ALT = "Alt",
    ENTER = "Enter",
}

export type ShortcutConfig = {
    action: (event: KeyboardEvent) => void;
    triggerKey: string;
    modifierKey?: FUNCTION_KEY_NAME;
    requireModifier?: boolean;
};

export const useRegisterShortcut = (config: ShortcutConfig | ShortcutConfig[] | null) => {
    useEffect(() => {
        if (!config) return;

        const isModifierCorrect = (event: KeyboardEvent, modifierKey?: FUNCTION_KEY_NAME, requireModifier = true): boolean => {
            if (!modifierKey) return !requireModifier;

            let modifierPressed = false;
            switch (modifierKey) {
                case FUNCTION_KEY_NAME.SHIFT:
                    modifierPressed = event.shiftKey;
                    break;
                case FUNCTION_KEY_NAME.CONTROL:
                    modifierPressed = event.ctrlKey;
                    break;
                case FUNCTION_KEY_NAME.CMD_OR_CTRL:
                    modifierPressed = event.metaKey || event.ctrlKey;
                    break;
                case FUNCTION_KEY_NAME.META:
                    modifierPressed = event.metaKey;
                    break;
                case FUNCTION_KEY_NAME.ALT:
                    modifierPressed = event.altKey;
                    break;
                default:
                    return false;
            }
            return requireModifier ? modifierPressed : !modifierPressed;
        };

        const handleKeyPress = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

            const configs = Array.isArray(config) ? config : [config];
            configs.forEach(({action, triggerKey, modifierKey, requireModifier = true}) => {
                if (isInput && !modifierKey && !requireModifier) return;

                const modifierMatch = isModifierCorrect(event, modifierKey, requireModifier);
                if (!modifierMatch) return;

                // Use event.code for letter/digit keys since event.key can return unicode on macOS with Cmd
                const keyMatch =
                    triggerKey.length === 1
                        ? event.code === `Key${triggerKey.toUpperCase()}` || event.code === `Digit${triggerKey}` || event.key.toLowerCase() === triggerKey.toLowerCase()
                        : event.key.toLowerCase() === triggerKey.toLowerCase();
                if (!keyMatch) return;

                event.preventDefault();
                event.stopPropagation();
                action(event);
            });
        };

        document.addEventListener("keydown", handleKeyPress);
        return () => document.removeEventListener("keydown", handleKeyPress);
    }, [config]);
};
