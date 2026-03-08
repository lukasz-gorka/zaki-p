import {memo} from "react";
import {IconView} from "../../../icons/IconView.tsx";
import type {ICommandPanelItem} from "../../interface/ICommandPanelItem.ts";
import {ChatHistoryPreview} from "./ChatHistoryPreview.tsx";
import {HistoryPreview} from "./HistoryPreview.tsx";
import {SkillPreview} from "./SkillPreview.tsx";

interface CommandPanelPreviewProps {
    item: ICommandPanelItem | null;
}

export const CommandPanelPreview = memo(function CommandPanelPreview({item}: CommandPanelPreviewProps) {
    if (!item) {
        return (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                <p>Select an item to preview</p>
            </div>
        );
    }

    const preview = item.metadata?.preview as {type: string; data: any} | undefined;

    if (preview?.type === "history" && preview.data) {
        return <HistoryPreview item={preview.data} />;
    }

    if (preview?.type === "skill" && preview.data) {
        return <SkillPreview skill={preview.data} />;
    }

    if (preview?.type === "chat-history" && preview.data) {
        return <ChatHistoryPreview item={preview.data} />;
    }

    // Fallback: simple command preview
    return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <IconView icon={item.icon} className="h-8 w-8" />
            <div className="text-center">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                {item.description && <p className="text-xs mt-1">{item.description}</p>}
            </div>
        </div>
    );
});
