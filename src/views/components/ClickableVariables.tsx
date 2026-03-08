import {Badge} from "../ui/badge.tsx";

interface ClickableVariablesProps {
    variables: string[];
    onInsert: (variable: string) => void;
}

export function ClickableVariables({variables, onInsert}: ClickableVariablesProps) {
    return (
        <div className="flex flex-wrap gap-2 py-1">
            {variables.map((v) => (
                <Badge key={v} variant="secondary" className="cursor-pointer hover:bg-secondary/80 font-mono text-xs" onClick={() => onInsert(v)}>
                    {v}
                </Badge>
            ))}
        </div>
    );
}
