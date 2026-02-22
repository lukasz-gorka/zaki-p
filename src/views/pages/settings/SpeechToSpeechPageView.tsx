import {MessageCircle, Settings} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {useGlobalState} from "../../../hooks/useGlobalState.ts";
import {ROUTE_PATH} from "../../../navigation/const/ROUTE_PATH.ts";
import {DEFAULT_SPEECH_TO_SPEECH_SYSTEM_PROMPT, SpeechToSpeechSettings} from "../../../voice/interfaces/IVoiceSettings.ts";
import {PromptEditor} from "../../components/PromptEditor.tsx";
import {FormSelectUI} from "../../form/FormSelectUI.tsx";
import {ModelSelectUI} from "../../form/ModelSelectUI.tsx";
import {ContentPageLayout} from "../../templates/ContentPageLayout.tsx";
import {Button} from "../../ui/button.tsx";
import {KeyboardShortcutInput} from "../../ui/keyboard-shortcut-input.tsx";
import {Label} from "../../ui/label.tsx";
import {Separator} from "../../ui/separator.tsx";

const TTS_VOICES = [
    {value: "alloy", name: "Alloy"},
    {value: "echo", name: "Echo"},
    {value: "fable", name: "Fable"},
    {value: "onyx", name: "Onyx"},
    {value: "nova", name: "Nova"},
    {value: "shimmer", name: "Shimmer"},
];

export function SpeechToSpeechPageView() {
    const navigate = useNavigate();
    const [voice, setVoice] = useGlobalState("voice");
    const {speechToSpeech} = voice;

    const hasS2SConfigured = Boolean(speechToSpeech?.chatModel?.trim() && speechToSpeech?.ttsModel?.trim());

    const update = (updates: Partial<SpeechToSpeechSettings>) => {
        setVoice({
            speechToSpeech: {
                ...speechToSpeech,
                ...updates,
            },
        });
    };

    return (
        <ContentPageLayout title="Speech-to-Speech" icon={MessageCircle}>
            <div className="flex flex-col gap-8">
                <div className="grid gap-2">
                    <Label>Shortcut</Label>
                    <KeyboardShortcutInput
                        onSave={(value) => update({globalShortcut: value})}
                        initialValue={speechToSpeech?.globalShortcut ?? ""}
                        placeholder="Press keys..."
                        className="w-full"
                        disabled={!hasS2SConfigured}
                    />
                    {hasS2SConfigured ? (
                        <p className="text-xs text-muted-foreground">Start/stop voice conversation with AI assistant</p>
                    ) : (
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">Configure chat and TTS models below first</p>
                    )}
                </div>

                <Separator />

                <div className="flex items-end gap-2">
                    <ModelSelectUI tag="chat" label="Chat Model" value={speechToSpeech.chatModel} onValueChange={(value) => update({chatModel: value})} />
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate(ROUTE_PATH.MODELS)}>
                        <Settings className="w-4 h-4" />
                    </Button>
                </div>

                <Separator />

                <div className="flex items-end gap-2">
                    <ModelSelectUI tag="text-to-speech" label="TTS Model" value={speechToSpeech.ttsModel} onValueChange={(value) => update({ttsModel: value})} />
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate(ROUTE_PATH.MODELS)}>
                        <Settings className="w-4 h-4" />
                    </Button>
                </div>

                <FormSelectUI label="Voice" value={speechToSpeech.ttsVoice} onValueChange={(value) => update({ttsVoice: value})} items={TTS_VOICES} />

                <div className="grid gap-2">
                    <Label>Speed: {speechToSpeech.ttsSpeed.toFixed(2)}x</Label>
                    <input
                        type="range"
                        value={speechToSpeech.ttsSpeed}
                        onChange={(e) => update({ttsSpeed: parseFloat(e.target.value)})}
                        min={0.25}
                        max={4.0}
                        step={0.25}
                        className="w-[300px] accent-primary"
                    />
                    <p className="text-xs text-muted-foreground">0.25x to 4.0x speed</p>
                </div>

                <Separator />

                <PromptEditor
                    label="System Prompt"
                    value={speechToSpeech.systemPrompt}
                    defaultValue={DEFAULT_SPEECH_TO_SPEECH_SYSTEM_PROMPT}
                    onChange={(value) => update({systemPrompt: value})}
                    placeholder="System prompt for the assistant..."
                    rows={4}
                    className="w-full resize-y"
                    description="Instructions for the AI assistant during conversations."
                />
            </div>
        </ContentPageLayout>
    );
}
