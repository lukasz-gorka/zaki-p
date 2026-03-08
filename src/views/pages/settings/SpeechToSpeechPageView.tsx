import {Settings} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {useGlobalState} from "../../../hooks/useGlobalState.ts";
import {ROUTE_PATH} from "../../../navigation/const/ROUTE_PATH.ts";
import {SpeechToSpeechSettings} from "../../../voice/interfaces/IVoiceSettings.ts";
import {FormSelectUI} from "../../form/FormSelectUI.tsx";
import {ModelSelectUI} from "../../form/ModelSelectUI.tsx";
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

    const update = (updates: Partial<SpeechToSpeechSettings>) => {
        setVoice({
            speechToSpeech: {
                ...speechToSpeech,
                ...updates,
            },
        });
    };

    return (
        <div className="flex flex-col gap-8 py-2">
            <div className="grid gap-2">
                <Label>Shortcut</Label>
                <KeyboardShortcutInput
                    onSave={(value) => update({globalShortcut: value})}
                    initialValue={speechToSpeech?.globalShortcut ?? ""}
                    placeholder="Press keys..."
                    className="w-full"
                />
                <p className="text-xs text-muted-foreground">Record voice and send to chat (works with voice mode in Chat)</p>
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
        </div>
    );
}
