import {store} from "../../appInitializer/store";
import {ROUTE_PATH} from "../../navigation/const/ROUTE_PATH.ts";
import type {ICommandPanelItem} from "../interface/ICommandPanelItem.ts";

export function buildChatHistoryItems(navigate: (path: string) => void, onClose: () => void): ICommandPanelItem[] {
    const history = (store.getState() as any).chatHistory as any[] | undefined;
    if (!history?.length) return [];

    const sorted = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

    return sorted.map((item) => ({
        id: `chat-history-${item.id}`,
        label: item.name || "Untitled Chat",
        description: formatDate(item.date),
        icon: item.agentAvatar ? "Bot" : "MessageSquare",
        category: "Chat History",
        keywords: [item.name?.toLowerCase(), item.agentName?.toLowerCase(), "chat", "conversation"].filter(Boolean) as string[],
        metadata: {
            preview: {
                type: "chat-history",
                data: item,
            },
        },
        showInMainView: false,
        actions: [
            {
                id: "load",
                label: "Continue chat",
                icon: "MessageSquare",
                onAction: async () => {
                    const {getChatModule} = await import("../../../pro/chat/plugin.ts");
                    getChatModule().loadConversation(item.id, item.conversation, item.assistantId);
                    navigate(ROUTE_PATH.CHAT);
                    onClose();
                },
            },
        ],
    }));
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString(undefined, {month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"});
}
