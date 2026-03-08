import {Check, ImagePlus, Sparkles, X} from "lucide-react";
import {useCallback, useEffect, useState} from "react";
import {getChatModule} from "../../../pro/chat/plugin.ts";
import {EventBus} from "../../events/EventBus.ts";
import {useGlobalState} from "../../hooks/useGlobalState.ts";
import {useLicense} from "../../hooks/useLicense.ts";
import {IChatStoreModel} from "../../shared/interfaces/IChatStoreModel.ts";
import {NotificationSoundName} from "../../sound/NotificationSoundName.ts";
import {playNotificationSound} from "../../sound/sounds.ts";
import {AGENT_DEFAULT_AVATAR, isImageAvatar, selectAvatar} from "../../utils/avatarUtils.ts";
import {PromptEditorSection} from "../../views/components/PromptEditorSection.tsx";
import {ModelSelectUI} from "../../views/form/ModelSelectUI.tsx";
import {Avatar, AvatarImage} from "../../views/ui/avatar.tsx";
import {Button} from "../../views/ui/button.tsx";
import {Checkbox} from "../../views/ui/checkbox.tsx";
import {Input} from "../../views/ui/input.tsx";
import {KeyboardShortcutInput} from "../../views/ui/keyboard-shortcut-input.tsx";
import {Label} from "../../views/ui/label.tsx";
import {ScrollArea} from "../../views/ui/scroll-area.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "../../views/ui/select.tsx";
import {Sheet, SheetContent, SheetHeader, SheetTitle} from "../../views/ui/sheet.tsx";
import {Switch} from "../../views/ui/switch.tsx";
import {Textarea} from "../../views/ui/textarea.tsx";
import {SKILL_ICON_LIST} from "../const/SKILL_ICON_LIST.ts";
import {ISkill} from "../interfaces/ISkill.ts";
import {DynamicIcon} from "./DynamicIcon.tsx";
import {SkillSingleCard} from "./SkillSingleCard.tsx";

interface SkillEditSheetProps {
    skill: ISkill;
    open: boolean;
    onSave: (skill: ISkill) => void;
    onClose: () => void;
}

const SOUND_OPTIONS: {value: NotificationSoundName; label: string}[] = [
    {value: NotificationSoundName.NONE, label: "None"},
    {value: NotificationSoundName.COMPLETE, label: "Complete"},
    {value: NotificationSoundName.SUCCESS, label: "Success"},
    {value: NotificationSoundName.ATTENTION, label: "Attention"},
    {value: NotificationSoundName.BELL, label: "Bell"},
    {value: NotificationSoundName.CHIME, label: "Chime"},
    {value: NotificationSoundName.GENTLE, label: "Gentle"},
    {value: NotificationSoundName.ALERT, label: "Alert"},
];

const INPUT_SOURCE_OPTIONS: {value: "clipboard" | "voice"; label: string; description: string}[] = [
    {value: "clipboard", label: "Clipboard", description: "Read input from clipboard"},
    {value: "voice", label: "Voice", description: "Record audio, transcribe, then process"},
];

export function SkillEditSheet({skill, open, onSave, onClose}: SkillEditSheetProps) {
    const [draft, setDraft] = useState<ISkill>({...skill});
    const isNew = !skill.label || skill.label === "New Skill";
    const isVoice = draft.inputSource === "voice";
    const {isPro} = useLicense();

    // Sync draft when skill prop changes
    const [prevSkill, setPrevSkill] = useState(skill);
    if (skill !== prevSkill) {
        setPrevSkill(skill);
        setDraft({...skill});
    }

    const update = useCallback((partial: Partial<ISkill>) => {
        setDraft((prev) => ({...prev, ...partial}));
    }, []);

    const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

    useEffect(() => {
        if (!open) {
            setSaveStatus("idle");
            return;
        }
        const debounce = setTimeout(() => {
            onSave(draft);
            setSaveStatus("saved");
            const fadeTimer = setTimeout(() => setSaveStatus("idle"), 2000);
            return () => clearTimeout(fadeTimer);
        }, 400);
        return () => clearTimeout(debounce);
    }, [draft, open, onSave]);

    const handleShortcutChange = useCallback(
        (keystroke: string) => {
            update({keystroke});
        },
        [update],
    );

    return (
        <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
            <SheetContent className="w-[90vw] min-w-[500px] max-w-[80vw] p-6 border-border flex flex-col overflow-hidden">
                <SheetHeader className="mb-2">
                    <SheetTitle>{isNew ? "New Skill" : `Edit: ${draft.label}`}</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-grow min-h-0">
                    <div className="flex flex-col gap-1 pr-4">
                        <SkillSingleCard title="General Settings" defaultOpen={true}>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label>Name</Label>
                                    <Input value={draft.label} onChange={(e) => update({label: e.target.value})} placeholder="Skill name" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Category</Label>
                                    <Input value={draft.category} onChange={(e) => update({category: e.target.value})} placeholder="e.g. Translation, Writing, Code" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Keyboard Shortcut</Label>
                                    <KeyboardShortcutInput onSave={handleShortcutChange} initialValue={draft.keystroke} placeholder="Press keys..." className="w-full" />
                                </div>
                                <ModelSelectUI tag="chat" value={draft.model} onValueChange={(v) => update({model: v})} label="AI Model" placeholder="Select model" />
                                <div className="space-y-1.5">
                                    <Label>Input Source</Label>
                                    <Select
                                        value={draft.inputSource || "clipboard"}
                                        onValueChange={(v) => {
                                            const source = v as "clipboard" | "voice";
                                            if (source === "voice") {
                                                update({inputSource: source, isolatedContext: true, silentMode: true, copyToClipboard: true, showGlobalPopup: true});
                                            } else {
                                                update({inputSource: source});
                                            }
                                        }}
                                        disabled={!isPro}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {INPUT_SOURCE_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground">
                                        {draft.inputSource === "voice"
                                            ? "Records audio via microphone, transcribes it, then processes with this skill"
                                            : "Reads text from clipboard as input"}
                                    </p>
                                    {!isPro && <p className="text-[10px] text-muted-foreground italic">Pro license required to change input source</p>}
                                </div>
                            </div>
                        </SkillSingleCard>

                        <SkillSingleCard title="System Prompt" defaultOpen={true}>
                            <PromptEditorSection value={draft.instruction} onChange={(v) => update({instruction: v})} />
                        </SkillSingleCard>

                        {isVoice ? null : (
                            <SkillSingleCard title="Behavior">
                                <SwitchRow
                                    label="Isolated Context"
                                    description="Run without conversation history"
                                    checked={!!draft.isolatedContext}
                                    onCheckedChange={(v) => update({isolatedContext: v})}
                                />
                                <SwitchRow
                                    label="Silent Mode"
                                    description="Execute in background without affecting current chat"
                                    checked={!!draft.silentMode}
                                    onCheckedChange={(v) => {
                                        if (v) {
                                            update({silentMode: v, copyToClipboard: true});
                                        } else {
                                            update({silentMode: v});
                                        }
                                    }}
                                />
                            </SkillSingleCard>
                        )}

                        <SkillSingleCard title="Response Settings">
                            <SwitchRow label="JSON Mode" description="Require JSON format response" checked={!!draft.jsonMode} onCheckedChange={(v) => update({jsonMode: v})} />
                            <SwitchRow
                                label="Copy to Clipboard"
                                description={draft.silentMode ? "Always enabled in silent mode" : "Copy AI response to clipboard"}
                                checked={draft.copyToClipboard !== false}
                                onCheckedChange={(v) => update({copyToClipboard: v})}
                                disabled={!!draft.silentMode}
                            />
                            <SwitchRow
                                label="Show in Popup"
                                description="Display response in a pop-up window"
                                checked={!!draft.showInPopup}
                                onCheckedChange={(v) => update({showInPopup: v})}
                            />
                            <SwitchRow
                                label="Show Status Bar"
                                description={isVoice ? "Always enabled for voice input" : "Display a floating status bar while the skill is running"}
                                checked={isVoice ? true : !!draft.showGlobalPopup}
                                onCheckedChange={(v) => update({showGlobalPopup: v})}
                                disabled={isVoice}
                            />
                            <div className="space-y-3">
                                <SwitchRow
                                    label="Sound Notification"
                                    description="Play a sound when skill completes"
                                    checked={!!draft.playSoundNotification}
                                    onCheckedChange={(v) => update({playSoundNotification: v})}
                                />
                                {draft.playSoundNotification && (
                                    <div className="ml-6 flex items-center gap-2">
                                        <Select
                                            value={draft.soundNotificationId || NotificationSoundName.COMPLETE}
                                            onValueChange={(v) => update({soundNotificationId: v as NotificationSoundName})}
                                        >
                                            <SelectTrigger className="w-[150px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {SOUND_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => playNotificationSound((draft.soundNotificationId as NotificationSoundName) || NotificationSoundName.COMPLETE)}
                                        >
                                            Preview
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </SkillSingleCard>

                        {!isVoice && (
                            <SkillSingleCard title="External Mode (Webhook)">
                                <SwitchRow
                                    label="Enable Webhook"
                                    description="Send AI response to an external webhook endpoint"
                                    checked={!!draft.remoteAction}
                                    onCheckedChange={(v) => update({remoteAction: v})}
                                />
                                {draft.remoteAction && (
                                    <div className="flex flex-col gap-3 mt-2">
                                        <div className="space-y-1.5">
                                            <Label>Webhook URL</Label>
                                            <Input value={draft.webhook || ""} onChange={(e) => update({webhook: e.target.value})} placeholder="https://..." />
                                        </div>
                                        <SwitchRow
                                            label="Direct Webhook"
                                            description="Skip AI, send directly to webhook"
                                            checked={!!draft.directWebhook}
                                            onCheckedChange={(v) => update({directWebhook: v})}
                                        />
                                        {draft.directWebhook && (
                                            <WebhookPayloadField
                                                value={draft.webhookPayloadTemplate || '{"message": "{{{MESSAGE}}}"}'}
                                                onChange={(v) => update({webhookPayloadTemplate: v})}
                                            />
                                        )}
                                        <SwitchRow
                                            label="Show Full Response"
                                            description="Display complete raw JSON instead of 'output' field"
                                            checked={!!draft.showFullWebhookResponse}
                                            onCheckedChange={(v) => update({showFullWebhookResponse: v})}
                                        />
                                    </div>
                                )}
                            </SkillSingleCard>
                        )}

                        {!isVoice && <SkillAgentsCard skillUuid={draft.uuid} />}

                        <SkillSingleCard title="Appearance">
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label>Avatar</Label>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-16 w-16 rounded-md">
                                            {draft.avatar ? (
                                                <AvatarImage src={draft.avatar} />
                                            ) : (
                                                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                                                    <DynamicIcon name={draft.icon || "Zap"} className="w-6 h-6 text-primary" />
                                                </div>
                                            )}
                                        </Avatar>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-1.5"
                                                onClick={async () => {
                                                    const dataUri = await selectAvatar();
                                                    if (dataUri) update({avatar: dataUri});
                                                }}
                                            >
                                                <ImagePlus className="w-3.5 h-3.5" />
                                                Select Image
                                            </Button>
                                            {draft.avatar && (
                                                <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => update({avatar: ""})}>
                                                    <X className="w-3.5 h-3.5" />
                                                    Remove
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Icon (fallback)</Label>
                                    <div className="flex gap-1.5" style={{flexWrap: "wrap"}}>
                                        {SKILL_ICON_LIST.map((icon) => (
                                            <Button
                                                key={icon}
                                                variant={icon === draft.icon ? "default" : "ghost"}
                                                size="icon"
                                                className="h-8 w-8 shrink-0"
                                                onClick={() => update({icon})}
                                            >
                                                <DynamicIcon name={icon} size={14} />
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </SkillSingleCard>
                    </div>
                </ScrollArea>
                <div className="flex justify-between items-center gap-2 pt-4 border-t mt-2">
                    <div className="flex items-center gap-2">
                        {isPro && (
                            <Button
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => {
                                    onClose();
                                    EventBus.emit("system-agent:activate", {
                                        agentId: "system:skill-builder",
                                        context: {type: "skill-builder", payload: {skill: draft}},
                                    });
                                }}
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                Build with AI
                            </Button>
                        )}
                        <div
                            className={`flex items-center gap-1.5 text-xs text-muted-foreground transition-opacity duration-300 ${saveStatus === "saved" ? "opacity-100" : "opacity-0"}`}
                        >
                            <Check className="w-3 h-3" />
                            Auto-saved
                        </div>
                    </div>
                    <Button variant="ghost" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function SkillAgentsCard({skillUuid}: {skillUuid: string}) {
    const [chatState] = useGlobalState("chat" as any) as [IChatStoreModel, any];
    const agents = (chatState?.assistants || []).filter((a) => !a.system);
    const chat = getChatModule();

    if (agents.length === 0) return null;

    const handleToggle = (agentId: string, checked: boolean) => {
        const agent = agents.find((a) => a.id === agentId);
        if (!agent) return;
        const skills = agent.skills || [];
        const updated = checked ? [...skills, skillUuid] : skills.filter((id) => id !== skillUuid);
        chat.updateAgent({...agent, skills: updated});
    };

    return (
        <SkillSingleCard title="Agents">
            <div className="space-y-2">
                {agents.map((agent) => {
                    const isAssigned = (agent.skills || []).includes(skillUuid);
                    return (
                        <label key={agent.id} className="flex items-center gap-2 cursor-pointer py-1">
                            <Checkbox checked={isAssigned} onCheckedChange={(v) => handleToggle(agent.id, !!v)} />
                            <img src={isImageAvatar(agent.avatar) ? agent.avatar : AGENT_DEFAULT_AVATAR} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                            <span className="text-sm">{agent.name || "Unnamed"}</span>
                        </label>
                    );
                })}
            </div>
        </SkillSingleCard>
    );
}

function validateJsonTemplate(template: string): string | null {
    // Replace variables with sample values to validate JSON structure
    const testValue = template.replace(/\{\{\{[A-Z_]+\}\}\}/g, "test");
    try {
        JSON.parse(testValue);
        return null;
    } catch (e) {
        return (e as Error).message;
    }
}

function WebhookPayloadField({value, onChange}: {value: string; onChange: (v: string) => void}) {
    const error = validateJsonTemplate(value);

    const handleFormat = () => {
        const placeholders: string[] = [];
        // Replace "{{{VAR}}}" (with surrounding quotes) with a unique token
        const escaped = value.replace(/"\{\{\{([A-Z_]+)\}\}\}"/g, (_, name) => {
            placeholders.push(`{{{${name}}}}`);
            return `"__PH_${placeholders.length - 1}__"`;
        });
        try {
            const parsed = JSON.parse(escaped);
            let formatted = JSON.stringify(parsed, null, 2);
            placeholders.forEach((p, i) => {
                formatted = formatted.replace(`__PH_${i}__`, p);
            });
            onChange(formatted);
        } catch {
            // can't format invalid JSON
        }
    };

    return (
        <div className="space-y-1.5 ml-4">
            <div className="flex items-center justify-between">
                <Label>Payload Template</Label>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={handleFormat} disabled={!!error}>
                    Format
                </Button>
            </div>
            <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={3}
                className={`font-mono text-xs ${error ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {error ? <p className="text-[10px] text-red-500">Invalid JSON: {error}</p> : <p className="text-[10px] text-green-600">Valid JSON</p>}
            <p className="text-[10px] text-muted-foreground">
                Variables: {"{{{MESSAGE}}}"}, {"{{{SESSION_ID}}}"}, {"{{{DATETIME}}}"}, {"{{{CLIPBOARD}}}"}
            </p>
        </div>
    );
}

function SwitchRow({
    label,
    description,
    checked,
    onCheckedChange,
    disabled,
}: {
    label: string;
    description: string;
    checked: boolean;
    onCheckedChange: (value: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex items-center justify-between gap-4 py-1.5">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
        </div>
    );
}
