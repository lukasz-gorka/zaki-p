import {emit, listen} from "@tauri-apps/api/event";
import {getCurrentWebviewWindow} from "@tauri-apps/api/webviewWindow";
import {writeText} from "@tauri-apps/plugin-clipboard-manager";
import {icons, X, Copy, Check} from "lucide-react";
import {useEffect, useState} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {Button} from "../../views/ui/button.tsx";
import {ScrollArea} from "../../views/ui/scroll-area.tsx";

interface TextContent {
    title: string;
    text: string;
    icon?: string;
}

function DynamicIcon({name, className, size}: {name: string; className?: string; size?: number}) {
    const Icon = icons[name as keyof typeof icons];
    if (!Icon) return null;
    return <Icon className={className} size={size} />;
}

export function PopupApp() {
    const [content, setContent] = useState<TextContent | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const window = getCurrentWebviewWindow();
        const label = window.label;

        const contentListener = listen(`popup-content-${label}`, (event) => {
            const payload = event.payload as {type: string; content: TextContent};
            if (payload.type === "text") {
                setContent(payload.content);
            }
        });

        emit(`popup-ready-${label}`, {});

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "w") {
                e.preventDefault();
                window.close();
            }
            if (e.key === "Escape") {
                window.close();
            }
        };
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            contentListener.then((unlisten) => unlisten());
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    const handleClose = async () => {
        const window = getCurrentWebviewWindow();
        await window.close();
    };

    const handleCopy = async () => {
        if (!content?.text) return;
        await writeText(content.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="h-full w-full flex flex-col rounded overflow-hidden bg-background text-foreground border border-border">
            {/* Title bar */}
            <div className="flex items-center justify-between h-10 px-3 border-b border-border bg-card select-none flex-shrink-0" data-tauri-drag-region>
                <div className="flex items-center gap-2 min-w-0" data-tauri-drag-region>
                    {content?.icon ? (
                        <DynamicIcon name={content.icon} size={14} className="text-primary flex-shrink-0" />
                    ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    )}
                    {content?.title && (
                        <span className="text-xs font-medium truncate text-foreground" data-tauri-drag-region>
                            {content.title}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0" data-tauri-drag-region="false">
                    <Button variant="ghost" size="icon" onClick={handleCopy} className="h-7 w-7 text-muted-foreground" title="Copy (Cmd+C)">
                        {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleClose} className="h-7 w-7 text-muted-foreground" title="Close (Esc)">
                        <X size={13} />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="p-4">
                    {content ? (
                        <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-foreground">
                            <Markdown remarkPlugins={[remarkGfm]}>{content.text}</Markdown>
                        </div>
                    ) : (
                        <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
