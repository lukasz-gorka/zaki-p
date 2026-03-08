import {RotateCcw} from "lucide-react";
import {useMemo} from "react";
import {G} from "../../../appInitializer/module/G.ts";
import {UpdateSettingsSection} from "../../../autoUpdate/view/UpdateSettingsSection.tsx";
import {useGlobalState} from "../../../hooks/useGlobalState.ts";
import {SpeechToTextSettings} from "../../../voice/interfaces/IVoiceSettings.ts";
import {DebugConsoleView} from "../../settings/DebugConsoleView.tsx";
import {Button} from "../../ui/button.tsx";
import {KeyboardShortcutInput} from "../../ui/keyboard-shortcut-input.tsx";
import {Label} from "../../ui/label.tsx";
import {Separator} from "../../ui/separator.tsx";
import {LicenseSection} from "./LicenseSection.tsx";

export function GeneralSettingsPageView() {
    const [voice, setVoice] = useGlobalState("voice");
    const {speechToText} = voice;

    const isProActive = useMemo(() => G.license?.isProActive(), []);

    const updateSpeechToText = (updates: Partial<SpeechToTextSettings>) => {
        setVoice({
            speechToText: {
                ...speechToText,
                ...updates,
            },
        });
    };

    return (
        <div className="flex flex-col gap-10">
            <div className="grid gap-2">
                <Label>Toggle App Visibility</Label>
                <KeyboardShortcutInput
                    onSave={(value) => updateSpeechToText({globalShortcutToggleApp: value})}
                    initialValue={speechToText.globalShortcutToggleApp}
                    placeholder="Press keys..."
                    className="w-full"
                />
                <p className="text-xs text-muted-foreground">Show or hide the application window</p>
            </div>

            {isProActive && (
                <div className="grid gap-2">
                    <Label>Toggle Quick Chat</Label>
                    <KeyboardShortcutInput
                        onSave={(value) => updateSpeechToText({globalShortcutQuickChat: value})}
                        initialValue={speechToText.globalShortcutQuickChat}
                        placeholder="Press keys..."
                        className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">Open Quick Chat popup for fast AI conversations</p>
                </div>
            )}

            <Separator />

            <UpdateSettingsSection />

            <Separator />

            <LicenseSection />

            <Separator />

            <div className="flex flex-col gap-4">
                <div>
                    <p className="text-sm font-medium">Actions</p>
                    <p className="text-xs text-muted-foreground">Troubleshooting and maintenance</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => G.voice.forceReset()}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset App State
                    </Button>
                    <DebugConsoleView />
                </div>
            </div>
        </div>
    );
}
