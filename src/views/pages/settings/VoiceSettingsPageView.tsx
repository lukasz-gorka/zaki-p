import {invoke} from "@tauri-apps/api/core";
import {AlertTriangle, AudioLines, ExternalLink, RotateCcw, Settings} from "lucide-react";
import {useCallback, useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {G} from "../../../appInitializer/module/G.ts";
import type {ShortcutRegistrationError} from "../../../globalShortcuts/globalShortcutsConfig.ts";
import {useGlobalState} from "../../../hooks/useGlobalState.ts";
import {AIModelTag} from "../../../integrations/ai/interface/AIModelConfig.ts";
import {AIModelForUI} from "../../../integrations/ai/interface/AIProviderConfig.ts";
import {ROUTE_PATH} from "../../../navigation/const/ROUTE_PATH.ts";
import type {LocalModelStatus} from "../../../rustProxy/interface/LocalModelTypes.ts";
import {isMacOS} from "../../../utils/appEnvironment.ts";
import {SpeechToTextSettings} from "../../../voice/interfaces/IVoiceSettings.ts";
import {FormSwitchUI} from "../../form/FormSwitchUI.tsx";
import {ModelSelectUI} from "../../form/ModelSelectUI.tsx";
import {ContentPageLayout} from "../../templates/ContentPageLayout.tsx";
import {Alert, AlertDescription, AlertTitle} from "../../ui/alert.tsx";
import {Button} from "../../ui/button.tsx";
import {KeyboardShortcutInput} from "../../ui/keyboard-shortcut-input.tsx";
import {Label} from "../../ui/label.tsx";
import {Separator} from "../../ui/separator.tsx";

export function VoiceSettingsPageView() {
    const navigate = useNavigate();
    const [voice, setVoice] = useGlobalState("voice");
    const {speechToText} = voice;
    const [localModels, setLocalModels] = useState<LocalModelStatus[]>([]);
    const [shortcutErrors, setShortcutErrors] = useState<ShortcutRegistrationError[]>([]);

    const fetchLocalModels = useCallback(async () => {
        try {
            const models = await G.rustProxy.localModelsList();
            setLocalModels(models.filter((m) => m.downloaded));
        } catch {
            // Local models not available
        }
    }, []);

    useEffect(() => {
        fetchLocalModels();
        setShortcutErrors(G.globalShortcuts.getRegistrationErrors());
    }, [fetchLocalModels]);

    const localExtraItems: AIModelForUI[] = localModels.map((m) => ({
        id: m.id,
        name: m.name,
        compositeId: `local::${m.id}`,
        providerId: "local",
        providerName: "Local (Free)",
        providerUuid: "local",
        enabled: true,
        tags: ["speech-to-text" as AIModelTag],
    }));

    const updateSpeechToText = (updates: Partial<SpeechToTextSettings>) => {
        setVoice({
            speechToText: {
                ...speechToText,
                ...updates,
            },
        });
    };

    return (
        <ContentPageLayout title="Speech-to-Text" icon={AudioLines}>
            <div className="flex flex-col gap-8">
                {shortcutErrors.length > 0 && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Keyboard Shortcut Conflict</AlertTitle>
                        <AlertDescription>
                            <p className="mb-2">The following keyboard shortcuts could not be registered because they are already in use by another application:</p>
                            <ul className="list-disc list-inside text-xs space-y-1">
                                {shortcutErrors.map((error, index) => (
                                    <li key={index}>
                                        <strong>{error.keystroke}</strong> ({error.label})
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-3 text-xs">Please configure different shortcuts in Settings to enable this functionality.</p>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-2">
                    <Label>Plain Transcription Shortcut</Label>
                    <KeyboardShortcutInput
                        onSave={(value) => updateSpeechToText({globalShortcut: value})}
                        initialValue={speechToText.globalShortcut}
                        placeholder="Press keys..."
                        className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">Start/stop voice recording without AI enhancement</p>
                </div>

                <div className="flex items-end gap-2">
                    <ModelSelectUI
                        tag="speech-to-text"
                        label="STT Model"
                        value={speechToText.sttModel}
                        onValueChange={(value) => updateSpeechToText({sttModel: value})}
                        extraItems={localExtraItems}
                    />
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate(ROUTE_PATH.MODELS)}>
                        <Settings className="w-4 h-4" />
                    </Button>
                </div>

                <Separator />

                <FormSwitchUI
                    value={speechToText.copyToClipboard}
                    label="Copy to Clipboard"
                    description="Automatically copy transcription to clipboard for use in other apps"
                    onValueChange={(checked) => updateSpeechToText({copyToClipboard: checked})}
                />
                <FormSwitchUI
                    value={speechToText.autoPasteAfterTranscription}
                    label="Auto-Paste After Transcription"
                    description="Automatically paste transcription where cursor is focused (requires 'Copy to Clipboard' enabled)"
                    onValueChange={(checked) => updateSpeechToText({autoPasteAfterTranscription: checked})}
                    disabled={!speechToText.copyToClipboard}
                />
                {speechToText.autoPasteAfterTranscription && isMacOS() && (
                    <button
                        type="button"
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors -mt-2 ml-1"
                        onClick={() => invoke("open_accessibility_settings")}
                    >
                        <ExternalLink className="w-3 h-3" />
                        Open Accessibility Settings (required for auto-paste)
                    </button>
                )}
                <FormSwitchUI
                    value={speechToText.playSoundNotification}
                    label="Play Sound Notifications"
                    description="Play sound effects when starting/stopping recording and copying to clipboard"
                    onValueChange={(checked) => updateSpeechToText({playSoundNotification: checked})}
                />
                <FormSwitchUI
                    value={speechToText.enableEscapeShortcut}
                    label="Enable Escape to Cancel"
                    description="Press Escape during recording to cancel the transcription process"
                    onValueChange={(checked) => updateSpeechToText({enableEscapeShortcut: checked})}
                />

                <Separator />

                <div className="grid gap-2">
                    <Button variant="outline" size="sm" onClick={() => G.voice.forceReset()} className="w-fit">
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset Stuck Recording
                    </Button>
                    <p className="text-xs text-muted-foreground">Use this if recording gets stuck and won't start</p>
                </div>
            </div>
        </ContentPageLayout>
    );
}
