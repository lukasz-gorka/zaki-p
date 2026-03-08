import {useCallback, useState} from "react";
import {NotificationSoundName} from "../../sound/NotificationSoundName.ts";
import {playNotificationSound} from "../../sound/sounds.ts";
import {ModelSelectUI} from "../../views/form/ModelSelectUI.tsx";
import {Button} from "../../views/ui/button.tsx";
import {Checkbox} from "../../views/ui/checkbox.tsx";
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from "../../views/ui/dialog.tsx";
import {Input} from "../../views/ui/input.tsx";
import {Label} from "../../views/ui/label.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "../../views/ui/select.tsx";
import {Textarea} from "../../views/ui/textarea.tsx";
import {ISkill} from "../interfaces/ISkill.ts";

interface SkillEditModalProps {
    skill: ISkill;
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

export function SkillEditModal({skill, onSave, onClose}: SkillEditModalProps) {
    const [draft, setDraft] = useState<ISkill>({...skill});

    const update = useCallback((partial: Partial<ISkill>) => {
        setDraft((prev) => ({...prev, ...partial}));
    }, []);

    const handleSave = useCallback(() => {
        onSave(draft);
    }, [draft, onSave]);

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{skill.label ? `Edit: ${skill.label}` : "New Skill"}</DialogTitle>
                </DialogHeader>

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
                        <ModelSelectUI tag="chat" value={draft.model} onValueChange={(v) => update({model: v})} label="AI Model" placeholder="Select model" />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Keyboard Shortcut</Label>
                        <Input value={draft.keystroke || ""} onChange={(e) => update({keystroke: e.target.value})} placeholder="e.g. CmdOrCtrl+Shift+T" />
                        <p className="text-[10px] text-muted-foreground">Global shortcut to execute this skill</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Input Source</Label>
                        <Select value={draft.inputSource || "clipboard"} onValueChange={(v) => update({inputSource: v as "clipboard" | "voice"})}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="clipboard">Clipboard</SelectItem>
                                <SelectItem value="voice">Voice</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label>System Prompt / Instruction</Label>
                        <Textarea
                            value={draft.instruction}
                            onChange={(e) => update({instruction: e.target.value})}
                            placeholder="Enter the instruction for the AI..."
                            rows={6}
                            className="font-mono text-xs"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Available variables: {"{{{"}
                            <span className="font-mono">DATETIME</span>
                            {"}}}"}, {"{{{"}
                            <span className="font-mono">MESSAGE</span>
                            {"}}}"}, {"{{{"}
                            <span className="font-mono">SESSION_ID</span>
                            {"}}}"}, {"{{{"}
                            <span className="font-mono">CLIPBOARD</span>
                            {"}}}"}
                        </p>
                    </div>

                    <div className="space-y-3 border-t pt-3">
                        <div className="flex items-center gap-2">
                            <Checkbox id="silent" checked={draft.silentMode || false} onCheckedChange={(checked) => update({silentMode: !!checked})} />
                            <Label htmlFor="silent" className="text-sm cursor-pointer">
                                Silent mode (run without chat UI)
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox id="clipboard" checked={draft.copyToClipboard !== false} onCheckedChange={(checked) => update({copyToClipboard: !!checked})} />
                            <Label htmlFor="clipboard" className="text-sm cursor-pointer">
                                Copy result to clipboard
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox id="isolated" checked={draft.isolatedContext || false} onCheckedChange={(checked) => update({isolatedContext: !!checked})} />
                            <Label htmlFor="isolated" className="text-sm cursor-pointer">
                                Isolated context (no conversation history)
                            </Label>
                        </div>
                    </div>

                    <div className="space-y-1.5 border-t pt-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Checkbox id="sound" checked={draft.playSoundNotification || false} onCheckedChange={(checked) => update({playSoundNotification: !!checked})} />
                            <Label htmlFor="sound" className="text-sm cursor-pointer">
                                Play sound on completion
                            </Label>
                        </div>
                        {draft.playSoundNotification && (
                            <div className="flex items-center gap-2">
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
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
