import {Settings, Sparkles} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {useGlobalState} from "../../hooks/useGlobalState.ts";
import {ROUTE_PATH} from "../../navigation/const/ROUTE_PATH.ts";
import {DEFAULT_ENHANCEMENT_PROMPT} from "../../voice/const/TRANSCRIPTION_ENHANCEMENT_PROMPT.ts";
import {SpeechToTextSettings} from "../../voice/interfaces/IVoiceSettings.ts";
import {PromptEditor} from "../components/PromptEditor.tsx";
import {ModelSelectUI} from "../form/ModelSelectUI.tsx";
import {ContentPageLayout} from "../templates/ContentPageLayout.tsx";
import {Button} from "../ui/button.tsx";
import {KeyboardShortcutInput} from "../ui/keyboard-shortcut-input.tsx";
import {Label} from "../ui/label.tsx";

export function EnhancerPageView() {
    const navigate = useNavigate();
    const [voice, setVoice] = useGlobalState("voice");
    const {speechToText} = voice;

    const hasEnhancementConfigured = Boolean(speechToText.enhancementModel?.trim());

    const updateSpeechToText = (updates: Partial<SpeechToTextSettings>) => {
        setVoice({
            speechToText: {
                ...speechToText,
                ...updates,
            },
        });
    };

    return (
        <ContentPageLayout title="Enhancer" icon={Sparkles}>
            <div className="flex flex-col gap-8">
                <div className="grid gap-2">
                    <Label>AI-Enhanced Transcription Shortcut</Label>
                    <KeyboardShortcutInput
                        onSave={(value) => updateSpeechToText({globalShortcutWithAI: value})}
                        initialValue={speechToText.globalShortcutWithAI}
                        placeholder="Press keys..."
                        className="w-full"
                        disabled={!hasEnhancementConfigured}
                    />
                    {hasEnhancementConfigured ? (
                        <p className="text-xs text-muted-foreground">Transcription with AI enhancement — cleans up grammar and formatting</p>
                    ) : (
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">Configure enhancement model below first</p>
                    )}
                </div>

                <div className="flex items-end gap-2">
                    <ModelSelectUI
                        tag="chat"
                        label="Enhancement Model"
                        value={speechToText.enhancementModel}
                        onValueChange={(value) => updateSpeechToText({enhancementModel: value})}
                    />
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate(ROUTE_PATH.MODELS)}>
                        <Settings className="w-4 h-4" />
                    </Button>
                </div>

                <PromptEditor
                    label="Enhancement Prompt"
                    id="stt-enhancement-prompt"
                    value={speechToText.enhancementPrompt}
                    defaultValue={DEFAULT_ENHANCEMENT_PROMPT}
                    onChange={(value) => updateSpeechToText({enhancementPrompt: value})}
                    placeholder="Enter the AI enhancement prompt..."
                    description={`Prompt used by AI to enhance transcriptions. Use {{{MESSAGE}}} as placeholder for the transcribed text.`}
                />
            </div>
        </ContentPageLayout>
    );
}
