import {store} from "../../appInitializer/store";

import type {ICommandPanelItem} from "../interface/ICommandPanelItem.ts";

export function buildHistoryItems(onClose: () => void): ICommandPanelItem[] {
    const voiceState = store.getState().voice;
    const history = voiceState.transcriptionHistory || [];

    const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp).slice(0, 15);

    return sorted.map((item) => ({
        id: `history-${item.id}`,
        label: item.text.slice(0, 80) + (item.text.length > 80 ? "..." : ""),
        description: formatTimestamp(item.timestamp),
        icon: item.isEnhanced ? "Sparkles" : "FileText",
        category: "History",
        keywords: item.text.toLowerCase().split(/\s+/).slice(0, 10),
        metadata: {
            preview: {
                type: "history",
                data: item,
            },
        },
        showInMainView: false,
        actions: [
            {
                id: "copy",
                label: "Copy text",
                icon: "Copy",
                onAction: async () => {
                    await navigator.clipboard.writeText(item.text);
                    onClose();
                },
            },
        ],
    }));
}

function formatTimestamp(ts: number): string {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString(undefined, {month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"});
}
