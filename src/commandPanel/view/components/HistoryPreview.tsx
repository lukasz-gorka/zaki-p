import {memo} from "react";
import type {TranscriptionHistoryItem} from "../../../voice/interfaces/IVoiceSettings.ts";

interface HistoryPreviewProps {
    item: TranscriptionHistoryItem;
}

function formatDate(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"});
}

function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

export const HistoryPreview = memo(function HistoryPreview({item}: HistoryPreviewProps) {
    return (
        <div className="flex flex-col h-full p-5 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 mb-3">
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">{formatDate(item.timestamp)}</span>
                    {item.modelName && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{item.modelName}</span>}
                    <span className="text-[10px] text-muted-foreground">{countWords(item.text)} words</span>
                    {item.isEnhanced && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">AI Enhanced</span>}
                </div>
            </div>

            {/* Text content */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{item.text.slice(0, 500)}</div>

                {item.rawText && item.rawText !== item.text && (
                    <div className="mt-3">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase mb-1 block">Original</span>
                        <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-md p-3">{item.rawText.slice(0, 300)}</div>
                    </div>
                )}
            </div>
        </div>
    );
});
