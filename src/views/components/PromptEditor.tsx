import {RotateCcw} from "lucide-react";
import {Button} from "../ui/button.tsx";
import {Label} from "../ui/label.tsx";
import {Textarea} from "../ui/textarea.tsx";

interface PromptEditorProps {
    label: string;
    value: string;
    defaultValue: string;
    onChange: (value: string) => void;
    description?: string;
    placeholder?: string;
    rows?: number;
    id?: string;
    className?: string;
}

export function PromptEditor({label, value, defaultValue, onChange, description, placeholder, rows, id, className}: PromptEditorProps) {
    return (
        <div className="grid gap-2">
            <div className="flex items-center justify-between">
                <Label htmlFor={id}>{label}</Label>
                <Button variant="ghost" size="sm" onClick={() => onChange(defaultValue)} className="h-7 px-2 text-xs">
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset to default
                </Button>
            </div>
            <Textarea
                id={id}
                value={value || defaultValue}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                className={className ?? "min-h-[200px] font-mono text-xs"}
            />
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
    );
}
