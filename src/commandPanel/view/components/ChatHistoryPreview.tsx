import {memo} from "react";
import {getMessageText} from "../../../shared/interfaces/IChatMessage.ts";
import type {IHistoryElement} from "../../../shared/interfaces/IHistoryElement.ts";

interface ChatHistoryPreviewProps {
    item: IHistoryElement;
}

export const ChatHistoryPreview = memo(function ChatHistoryPreview({item}: ChatHistoryPreviewProps) {
    const messageCount = item.conversation?.length || 0;

    return (
        <div className="flex flex-col h-full p-5 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 mb-3">
                <h3 className="text-sm font-semibold truncate">{item.name || "Untitled Chat"}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">
                        {new Date(item.date).toLocaleDateString(undefined, {month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"})}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{messageCount} messages</span>
                    {item.modelUsed && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{item.modelUsed.split("::").pop()}</span>}
                    {item.agentName && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{item.agentName}</span>}
                    {item.isFavorite && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600">★ Favorite</span>}
                </div>
            </div>

            {/* Conversation preview */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                {item.conversation?.slice(0, 6).map((msg, i) => {
                    if (msg.role === "system" || msg.role === "tool") return null;
                    const text = getMessageText(msg);
                    if (!text) return null;
                    return (
                        <div key={i} className={`text-xs leading-relaxed ${msg.role === "user" ? "text-foreground" : "text-muted-foreground"}`}>
                            <span className="font-medium text-[10px] uppercase tracking-wider opacity-50">{msg.role === "user" ? "You" : "AI"}</span>
                            <p className="mt-0.5 whitespace-pre-wrap">
                                {text.slice(0, 200)}
                                {text.length > 200 ? "..." : ""}
                            </p>
                        </div>
                    );
                })}
                {messageCount > 6 && <p className="text-[10px] text-muted-foreground italic">+{messageCount - 6} more messages</p>}
            </div>
        </div>
    );
});
