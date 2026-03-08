import {ChevronDown, Plus, Wrench, X} from "lucide-react";
import {useState} from "react";
import {Badge} from "../ui/badge.tsx";
import {Button} from "../ui/button.tsx";
import {Card} from "../ui/card.tsx";
import {Input} from "../ui/input.tsx";
import {Label} from "../ui/label.tsx";

interface ToolsEditorProps {
    toolIds: string;
    onChange: (toolIds: string) => void;
}

export function ToolsEditor({toolIds, onChange}: ToolsEditorProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newToolId, setNewToolId] = useState("");

    const tools = toolIds
        ? toolIds
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
        : [];

    const addTool = () => {
        const trimmed = newToolId.trim();
        if (!trimmed || tools.includes(trimmed)) return;
        onChange([...tools, trimmed].join(","));
        setNewToolId("");
        setIsAdding(false);
    };

    const removeTool = (toolId: string) => {
        onChange(tools.filter((t) => t !== toolId).join(","));
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)} role="presentation">
                <div className="flex items-center gap-2">
                    <Label className="cursor-pointer">Tools</Label>
                    {tools.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                            {tools.length}
                        </Badge>
                    )}
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            </div>

            {isExpanded && (
                <div className="flex flex-col gap-2">
                    {tools.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {tools.map((toolId) => (
                                <div key={toolId} className="flex items-center gap-1.5 py-1 px-2.5 rounded-md bg-accent/50 border border-border/50 group">
                                    <Wrench className="w-3 h-3 text-primary" />
                                    <span className="text-sm font-mono">{toolId}</span>
                                    <button onClick={() => removeTool(toolId)} className="text-muted-foreground hover:text-destructive transition-colors">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {isAdding ? (
                        <Card className="p-3 flex flex-col gap-3">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Tool ID (e.g. notion, web_search)"
                                    value={newToolId}
                                    onChange={(e) => setNewToolId(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") addTool();
                                        if (e.key === "Escape") {
                                            setIsAdding(false);
                                            setNewToolId("");
                                        }
                                    }}
                                    className="h-9 flex-1 font-mono text-sm"
                                    autoFocus
                                />
                                <Button variant="outline" size="sm" disabled={!newToolId.trim()} onClick={addTool}>
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        </Card>
                    ) : (
                        <Button variant="outline" size="sm" className="w-fit gap-2" onClick={() => setIsAdding(true)}>
                            <Plus className="w-4 h-4" />
                            Add Tool
                        </Button>
                    )}

                    {tools.length === 0 && !isAdding && <p className="text-xs text-muted-foreground">Tool IDs are sent as tool_ids with chat requests to this provider.</p>}
                </div>
            )}
        </div>
    );
}
