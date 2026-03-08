import {AlertTriangle, Check, Command, Pencil, X} from "lucide-react";
import {MouseEvent, useCallback, useEffect, useRef, useState} from "react";
import {G} from "../../appInitializer/module/G.ts";
import {isMacOS} from "../../utils/appEnvironment.ts";
import {formatKeyForDisplay, formatKeysForValue, MODIFIER_KEYS, parseKeystroke} from "../../utils/keystroke";
import {Button} from "./button.tsx";
import {Kbd} from "./kbd.tsx";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "./tooltip.tsx";

interface KeyboardShortcutInputProps {
    initialValue?: string;
    onSave: (keystroke: string) => void;
    onCancel?: () => void;
    placeholder?: string;
    checkConflict?: (keystroke: string) => string | undefined;
    className?: string;
    disabled?: boolean;
    editable?: boolean;
}
export function KeyboardShortcutInput({
    initialValue = "",
    onSave,
    onCancel,
    placeholder = "Press keys...",
    checkConflict,
    className = "",
    disabled = false,
    editable = true,
}: KeyboardShortcutInputProps) {
    const [keys, setKeys] = useState<string[]>(parseKeystroke(initialValue));
    const [isEditing, setIsEditing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const currentKeystroke = keys.length > 0 ? formatKeysForValue(keys) : "";
    const conflictingItem = checkConflict && currentKeystroke ? checkConflict(currentKeystroke) : undefined;
    const hasConflict = Boolean(conflictingItem);

    const handleCancel = useCallback(() => {
        setKeys(parseKeystroke(initialValue));
        setIsRecording(false);
        setIsEditing(false);
        onCancel?.();
    }, [initialValue, onCancel]);

    const startRecording = () => {
        if (disabled || !editable) return;
        setIsRecording(true);
        setKeys([]);
    };

    const stopRecording = () => {
        setIsRecording(false);
    };

    const handleSave = () => {
        const keystrokeValue = keys.length > 0 ? formatKeysForValue(keys) : "";
        onSave(keystrokeValue);
        setIsEditing(false);
        setIsRecording(false);
        G.globalShortcuts.refreshShortcuts();
    };

    const handleClearShortcut = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setKeys([]);
        onSave("");
        setIsEditing(false);
        G.globalShortcuts.refreshShortcuts();
    };

    const handleStartEdit = () => {
        if (disabled || !editable) return;
        setIsEditing(true);
    };

    useEffect(() => {
        if (!isEditing) return;

        const handleOutsideClick = (event: globalThis.MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                handleCancel();
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [isEditing, handleCancel]);

    const keydownHandler = (event: KeyboardEvent) => {
        if (!isRecording) return;

        event.preventDefault();
        event.stopPropagation();

        if (event.repeat) return;

        const key = event.key;

        if (key === "Escape" && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
            handleCancel();
            return;
        }

        const newKeys: string[] = [];

        const isMac = isMacOS();

        if (isMac ? event.metaKey : event.ctrlKey) {
            newKeys.push("CmdOrCtrl");
        }

        if (isMac && event.ctrlKey) {
            newKeys.push("Control");
        }

        if (!isMac && event.metaKey) {
            newKeys.push("Super");
        }

        if (event.altKey) newKeys.push("Alt");
        if (event.shiftKey) newKeys.push("Shift");

        const isModifierKey = ["Control", "Alt", "Shift", "Meta", "Super"].includes(key);

        if (!isModifierKey) {
            let normalizedKey = key;

            // Use event.code for letters to avoid Polish diacritics (ę, ą, etc.)
            if (event.code.startsWith("Key") && event.code.length === 4) {
                normalizedKey = event.code.slice(3); // "KeyB" -> "B"
            } else if (event.code.startsWith("Digit") && event.code.length === 6) {
                normalizedKey = event.code.slice(5); // "Digit1" -> "1"
            } else if (key === " " || event.code === "Space") {
                normalizedKey = "Space";
            } else if (key.length === 1 && /[a-zA-Z]/.test(key)) {
                normalizedKey = key.toUpperCase();
            }

            newKeys.push(normalizedKey);
        }

        setKeys(newKeys);

        const hasNonModifier = newKeys.some((k) => !MODIFIER_KEYS.includes(k));
        if (hasNonModifier) {
            setTimeout(() => {
                stopRecording();
            }, 150);
        }
    };

    useEffect(() => {
        if (isRecording) {
            window.addEventListener("keydown", keydownHandler, true);
        }

        return () => {
            window.removeEventListener("keydown", keydownHandler, true);
        };
    }, [isRecording]);

    useEffect(() => {
        if (isEditing && !isRecording) {
            startRecording();
        }
    }, [isEditing]);

    useEffect(() => {
        if (!isEditing) {
            setKeys(parseKeystroke(initialValue));
        }
    }, [initialValue, isEditing]);

    const displayValue = keys.length > 0 ? keys.map(formatKeyForDisplay).join(" + ") : "";

    // Read-only mode
    if (!editable) {
        return (
            <div className={`flex items-center gap-2 h-9 ${className}`}>
                {initialValue ? (
                    <div className="flex items-center gap-1">
                        {initialValue.split("+").map((key, index) => (
                            <Kbd key={index}>{formatKeyForDisplay(key)}</Kbd>
                        ))}
                    </div>
                ) : (
                    <span className="text-sm text-muted-foreground">Not set</span>
                )}
            </div>
        );
    }

    // View mode
    if (!isEditing) {
        if (initialValue) {
            return (
                <div className={`group flex items-center gap-1 ${disabled ? "opacity-50 pointer-events-none" : "cursor-pointer"} ${className}`} onClick={handleStartEdit}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-destructive/10 hover:text-destructive" onClick={(event) => handleClearShortcut(event)}>
                            <X className="h-3 w-3" />
                        </Button>
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-1">
                        {parseKeystroke(initialValue).map((key, index) => (
                            <Kbd key={index}>{formatKeyForDisplay(key)}</Kbd>
                        ))}
                    </div>
                </div>
            );
        }
        return (
            <div
                className={`flex items-center gap-2 h-9 px-3 rounded-md transition-colors hover:bg-muted/50 ${disabled ? "opacity-50 pointer-events-none" : "cursor-pointer"} ${className}`}
                onClick={handleStartEdit}
            >
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    <Command className="h-3.5 w-3.5" />
                    Add shortcut
                </span>
            </div>
        );
    }

    // Editing mode
    return (
        <TooltipProvider>
            <div ref={containerRef} className={`flex items-center gap-2 h-9 px-3 rounded-md bg-muted/30 ring-2 ring-ring/20 ${className}`}>
                <div className="flex-1 flex items-center justify-center min-h-[24px]">
                    {isRecording ? (
                        displayValue ? (
                            <div className="flex items-center gap-1">
                                {keys.map((key, index) => (
                                    <Kbd key={index}>{formatKeyForDisplay(key)}</Kbd>
                                ))}
                            </div>
                        ) : (
                            <span className="text-xs text-muted-foreground animate-pulse">{placeholder}</span>
                        )
                    ) : displayValue ? (
                        <div className="flex items-center gap-1 cursor-pointer" onClick={startRecording}>
                            {keys.map((key, index) => (
                                <Kbd key={index}>{formatKeyForDisplay(key)}</Kbd>
                            ))}
                            {hasConflict && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <AlertTriangle className="h-3.5 w-3.5 text-destructive ml-1" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-xs">Shortcut already used by: {conflictingItem}</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    ) : (
                        <span className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={startRecording}>
                            Click to record
                        </span>
                    )}
                </div>
                <div className="flex gap-1">
                    <Button variant="default" size="sm" className="h-6 w-6 p-0" onClick={handleSave} disabled={isRecording || hasConflict}>
                        <Check className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCancel}>
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            </div>
        </TooltipProvider>
    );
}
