import {AudioLines, History, Trash2} from "lucide-react";
import {useMemo, useState} from "react";
import {G} from "../../appInitializer/module/G.ts";
import {useGlobalState} from "../../hooks/useGlobalState.ts";
import {Logger} from "../../logger/Logger.ts";
import {TabbedListPageTemplate, TabConfig} from "../templates/TabbedListPageTemplate.tsx";
import {TranscriptionCard} from "./TranscriptionCard.tsx";

export function VoiceHistoryView() {
    const [voice] = useGlobalState("voice");
    const [searchQuery, setSearchQuery] = useState("");

    const handleClearHistory = async () => {
        try {
            await G.voice.clearHistory();
        } catch (error) {
            Logger.error("Failed to clear history", {error});
        }
    };

    const sortedHistory = useMemo(() => {
        return [...voice.transcriptionHistory].sort((a, b) => b.timestamp - a.timestamp);
    }, [voice.transcriptionHistory]);

    const filteredHistory = useMemo(() => {
        if (!searchQuery.trim()) return sortedHistory;
        const query = searchQuery.toLowerCase();
        return sortedHistory.filter((item) => item.text.toLowerCase().includes(query));
    }, [sortedHistory, searchQuery]);

    const tabs: TabConfig<any>[] = [
        {
            value: "stt",
            label: "Transcriptions",
            icon: AudioLines,
            items: filteredHistory,
            renderItem: (item) => <TranscriptionCard key={item.id} item={item} searchQuery={searchQuery} onDelete={() => G.voice.removeTranscription(item.id)} />,
            emptyIcon: History,
            emptyTitle: "No transcriptions yet",
            emptyDescription: "Start recording to see your transcriptions here",
        },
    ];

    return (
        <TabbedListPageTemplate
            title="Transcription History"
            icon={History}
            tabs={tabs}
            searchPlaceholder="Search transcriptions..."
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeTab="stt"
            onTabChange={() => {}}
            actions={voice.transcriptionHistory.length > 0 ? [{label: "Clear All", icon: Trash2, onClick: handleClearHistory, variant: "destructive" as const}] : undefined}
        />
    );
}
