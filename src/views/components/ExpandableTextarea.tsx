import {Expand} from "lucide-react";
import {useCallback, useState} from "react";
import {Button} from "../ui/button.tsx";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "../ui/dialog.tsx";
import {cn} from "../ui/lib/utils.ts";
import {Textarea} from "../ui/textarea.tsx";

interface ExpandableTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    className?: string;
    label?: string;
}

export function ExpandableTextarea({value, onChange, placeholder, rows = 6, className, label}: ExpandableTextareaProps) {
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleDialogChange = useCallback(
        (val: string) => {
            onChange(val);
        },
        [onChange],
    );

    return (
        <div className="relative">
            <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className={cn("font-mono text-xs pr-10", className)} />
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1.5 right-1.5 h-7 w-7 opacity-50 hover:opacity-100"
                onClick={() => setDialogOpen(true)}
                title="Expand editor"
            >
                <Expand className="w-3.5 h-3.5" />
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-[90vw] w-[90vw] h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{label || "Edit"}</DialogTitle>
                    </DialogHeader>
                    <Textarea value={value} onChange={(e) => handleDialogChange(e.target.value)} placeholder={placeholder} className="flex-1 font-mono text-xs resize-none" />
                </DialogContent>
            </Dialog>
        </div>
    );
}
