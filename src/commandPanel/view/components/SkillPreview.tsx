import {memo} from "react";
import type {ISkill} from "../../../skills/interfaces/ISkill.ts";
import {Kbd} from "../../../views/ui/kbd.tsx";

interface SkillPreviewProps {
    skill: ISkill;
}

const KEY_MAP: Record<string, string> = {
    CmdOrCtrl: "⌘",
    CommandOrControl: "⌘",
    Shift: "⇧",
    Alt: "⌥",
    Control: "⌃",
};

function parseKeystroke(keystroke: string): string[] {
    return keystroke
        .replace(/CommandOrControl/gi, "CmdOrCtrl")
        .split("+")
        .map((k) => k.trim())
        .filter(Boolean);
}

function formatKey(key: string): string {
    return KEY_MAP[key] || key.toUpperCase();
}

export const SkillPreview = memo(function SkillPreview({skill}: SkillPreviewProps) {
    const keystrokeKeys = skill.keystroke ? parseKeystroke(skill.keystroke) : [];

    // Extract variables from instruction
    const variables = skill.instruction?.match(/\{\{\{(\w+)\}\}\}/g)?.map((v) => v.replace(/\{|\}/g, "")) || [];

    return (
        <div className="flex flex-col h-full p-5 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <h3 className="text-sm font-semibold truncate">{skill.label}</h3>
                {skill.category && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium flex-shrink-0">{skill.category}</span>}
            </div>

            {/* Metadata badges */}
            <div className="flex flex-wrap gap-1.5 mb-3 flex-shrink-0">
                {skill.model && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{skill.model}</span>}
                {skill.jsonMode && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">JSON</span>}
                {skill.silentMode && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">Silent</span>}
                {skill.isolatedContext && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600">Isolated</span>}
                {variables.length > 0 &&
                    variables.map((v) => (
                        <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">
                            {v}
                        </span>
                    ))}
                {keystrokeKeys.length > 0 && (
                    <div className="flex gap-0.5 items-center">
                        {keystrokeKeys.map((key, i) => (
                            <Kbd key={i} className="rounded-xs text-[10px]">
                                {formatKey(key)}
                            </Kbd>
                        ))}
                    </div>
                )}
            </div>

            {/* Instruction body */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words font-mono leading-relaxed bg-muted/30 rounded-md p-3">
                    {skill.instruction || "No instruction defined."}
                </pre>
            </div>
        </div>
    );
});
