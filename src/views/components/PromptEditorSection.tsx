import {useCallback} from "react";
import {Label} from "../ui/label.tsx";
import {ClickableVariables} from "./ClickableVariables.tsx";
import {ExpandableTextarea} from "./ExpandableTextarea.tsx";

interface PromptEditorSectionProps {
    value: string;
    onChange: (value: string) => void;
    variables?: string[];
    label?: string;
    placeholder?: string;
    rows?: number;
}

const DEFAULT_VARIABLES = ["{{{MESSAGE}}}", "{{{DATETIME}}}", "{{{SESSION_ID}}}", "{{{CLIPBOARD}}}"];

export function PromptEditorSection({
    value,
    onChange,
    variables = DEFAULT_VARIABLES,
    label = "System Prompt",
    placeholder = "Enter the instruction for the AI...",
    rows,
}: PromptEditorSectionProps) {
    const handleInsert = useCallback(
        (variable: string) => {
            onChange(value + variable);
        },
        [value, onChange],
    );

    return (
        <div className="space-y-2">
            {label && <Label>{label}</Label>}
            <ExpandableTextarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} label={label} />
            {variables.length > 0 && (
                <>
                    <ClickableVariables variables={variables} onInsert={handleInsert} />
                    <p className="text-[10px] text-muted-foreground">Click a variable to insert it. Variables inject dynamic values at runtime.</p>
                </>
            )}
        </div>
    );
}
