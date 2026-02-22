import {Keyboard, Wrench} from "lucide-react";
import {UpdateSettingsSection} from "../../../autoUpdate/view/UpdateSettingsSection.tsx";
import {useGlobalState} from "../../../hooks/useGlobalState.ts";
import {SpeechToTextSettings} from "../../../voice/interfaces/IVoiceSettings.ts";
import {DebugConsoleView} from "../../settings/DebugConsoleView.tsx";
import {ContentPageLayout} from "../../templates/ContentPageLayout.tsx";
import {KeyboardShortcutInput} from "../../ui/keyboard-shortcut-input.tsx";
import {Label} from "../../ui/label.tsx";
import {Separator} from "../../ui/separator.tsx";

export function SettingsPageView() {
    const [voice, setVoice] = useGlobalState("voice");
    const {speechToText} = voice;

    const updateSpeechToText = (updates: Partial<SpeechToTextSettings>) => {
        setVoice({
            speechToText: {
                ...speechToText,
                ...updates,
            },
        });
    };

    return (
        <ContentPageLayout title="Advanced" icon={Wrench} customActionButton={<DebugConsoleView />}>
            <div className="flex flex-col gap-10">
                <section className="flex flex-col gap-6">
                    <div className="flex items-center gap-2">
                        <Keyboard className="h-5 w-5 text-muted-foreground" />
                        <h2 className="text-lg font-semibold">Global Shortcuts</h2>
                    </div>

                    <div className="flex flex-col gap-6">
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

                        <div className="grid gap-2">
                            <Label>Abort Transcription</Label>
                            <KeyboardShortcutInput
                                onSave={(value) => updateSpeechToText({globalShortcutAbort: value})}
                                initialValue={speechToText.globalShortcutAbort}
                                placeholder="Press keys..."
                                className="w-full"
                            />
                            <p className="text-xs text-muted-foreground">Cancel ongoing transcription or AI enhancement</p>
                        </div>
                    </div>
                </section>

                <Separator />

                <UpdateSettingsSection />
            </div>
        </ContentPageLayout>
    );
}
