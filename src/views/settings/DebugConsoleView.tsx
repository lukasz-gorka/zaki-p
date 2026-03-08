import * as DialogPrimitive from "@radix-ui/react-dialog";
import {VisuallyHidden} from "@radix-ui/react-visually-hidden";
import {Bug, ChevronRight, Search, Trash2, X} from "lucide-react";
import {ReactNode, useEffect, useRef, useState} from "react";
import {SystemLogVariant} from "../../logger/interfaces/SystemLogVariant.ts";
import {ILogEntry, Logger} from "../../logger/Logger.ts";
import {Button} from "../ui/button.tsx";
import {Dialog, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger} from "../ui/dialog.tsx";

const LEVEL_COLORS: Record<SystemLogVariant, string> = {
    info: "text-blue-400",
    warn: "text-yellow-400",
    error: "text-red-400",
    debug: "text-zinc-500",
};

const LEVEL_PREFIX: Record<SystemLogVariant, string> = {
    info: "INF",
    warn: "WRN",
    error: "ERR",
    debug: "DBG",
};

const FILTER_LEVELS: Array<SystemLogVariant | "all"> = ["all", "info", "warn", "error", "debug"];

function highlightText(text: string, query: string): ReactNode {
    if (!query.trim()) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded-sm">
                {part}
            </mark>
        ) : (
            part
        ),
    );
}

function CollapsibleData({data, searchQuery}: {data: unknown; searchQuery: string}) {
    const [expanded, setExpanded] = useState(false);
    const text = JSON.stringify(data, null, 2);
    const preview = JSON.stringify(data);
    const isExpandable = preview.length > 60 || text.includes("\n");

    if (!isExpandable) {
        return <pre className="ml-[7.5ch] text-zinc-600 text-[11px] overflow-x-auto whitespace-pre-wrap">{highlightText(preview, searchQuery)}</pre>;
    }

    return (
        <div className="ml-[7.5ch]">
            <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-zinc-600 hover:text-zinc-400 text-[11px] transition-colors">
                <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
                {expanded ? null : <span className="truncate max-w-[60ch] opacity-60">{preview}</span>}
            </button>
            {expanded && <pre className="text-zinc-600 text-[11px] overflow-x-auto whitespace-pre-wrap pl-4">{highlightText(text, searchQuery)}</pre>}
        </div>
    );
}

function DebugConsoleContent() {
    const [logs, setLogs] = useState<ILogEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [levelFilter, setLevelFilter] = useState<SystemLogVariant | "all">("all");
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = Logger.subscribe((newLogs) => {
            setLogs(newLogs);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const filteredLogs = logs.filter((log) => {
        const matchesLevel = levelFilter === "all" || log.level === levelFilter;
        const matchesSearch =
            searchQuery === "" ||
            log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.data !== undefined && JSON.stringify(log.data).toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesLevel && matchesSearch;
    });

    const formatTimestamp = (iso: string) => {
        const date = new Date(iso);
        const time = date.toLocaleTimeString("en-US", {hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit"});
        const ms = date.getMilliseconds().toString().padStart(3, "0");
        return `${time}.${ms}`;
    };

    const formatError = (error: unknown): string => {
        if (error instanceof Error) {
            return error.stack || error.message;
        }
        return JSON.stringify(error, null, 2);
    };

    return (
        <div className="flex flex-col h-full font-mono">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-950 shrink-0">
                {/* Filter tabs */}
                <div className="flex">
                    {FILTER_LEVELS.map((level) => (
                        <button
                            key={level}
                            onClick={() => setLevelFilter(level)}
                            className={`px-2 py-1 text-[11px] uppercase tracking-wider border border-zinc-700 -ml-px first:ml-0 first:rounded-l-sm last:rounded-r-sm transition-colors ${
                                levelFilter === level ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                            }`}
                        >
                            {level}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-600" />
                    <input
                        type="text"
                        placeholder="Filter..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-sm text-[11px] text-zinc-300 pl-7 pr-2 py-1 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                    />
                </div>

                <div className="flex-1" />

                {/* Log count */}
                <span className="text-[10px] text-zinc-600">
                    {filteredLogs.length}/{logs.length}
                </span>

                {/* Clear */}
                <button onClick={() => Logger.clearLogs()} className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors" title="Clear logs">
                    <Trash2 className="h-3.5 w-3.5" />
                </button>

                {/* Close */}
                <DialogPrimitive.Close className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors" title="Close">
                    <X className="h-3.5 w-3.5" />
                </DialogPrimitive.Close>
            </div>

            {/* Log output */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto bg-zinc-950 p-2 text-[12px] leading-[1.6]" style={{scrollbarGutter: "stable"}}>
                {filteredLogs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-zinc-700 text-[11px]">{logs.length === 0 ? "No logs recorded." : "No matching logs."}</div>
                ) : (
                    filteredLogs.map((log, index) => (
                        <div key={index} className="hover:bg-zinc-900/50 px-1 group">
                            <div className="flex gap-2">
                                <span className="text-zinc-600 shrink-0 select-none">{formatTimestamp(log.timestamp)}</span>
                                <span className={`shrink-0 w-7 ${LEVEL_COLORS[log.level]}`}>{LEVEL_PREFIX[log.level]}</span>
                                <span className="text-zinc-300 break-all">{highlightText(log.message, searchQuery)}</span>
                            </div>
                            {log.data !== undefined && <CollapsibleData data={log.data} searchQuery={searchQuery} />}
                            {log.error !== undefined && (
                                <pre className="ml-[7.5ch] text-red-400/80 text-[11px] overflow-x-auto whitespace-pre-wrap">
                                    {highlightText(formatError(log.error), searchQuery)}
                                </pre>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export function DebugConsoleView() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                    <Bug className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogPortal>
                <DialogOverlay className="bg-black/80" />
                <DialogPrimitive.Content
                    aria-describedby={undefined}
                    className="fixed inset-3 z-50 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98] duration-150"
                >
                    <VisuallyHidden>
                        <DialogTitle>Debug Console</DialogTitle>
                    </VisuallyHidden>
                    <DebugConsoleContent />
                </DialogPrimitive.Content>
            </DialogPortal>
        </Dialog>
    );
}
