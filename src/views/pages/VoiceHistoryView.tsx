import {AudioLines, ChevronDown, Clock, History, MessageCircle, MessagesSquare, Search, Trash2} from "lucide-react";
import {useEffect, useMemo, useRef, useState} from "react";
import {G} from "../../appInitializer/module/G.ts";
import {useGlobalState} from "../../hooks/useGlobalState.ts";
import {Logger} from "../../logger/Logger.ts";
import {ConversationSession} from "../../voice/interfaces/IVoiceSettings.ts";
import {ContentPageLayout} from "../templates/ContentPageLayout.tsx";
import {Badge} from "../ui/badge.tsx";
import {Button} from "../ui/button.tsx";
import {Card, CardContent, CardFooter, CardHeader} from "../ui/card.tsx";
import {Input} from "../ui/input.tsx";
import {Kbd} from "../ui/kbd.tsx";
import {ScrollArea} from "../ui/scroll-area.tsx";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "../ui/tabs.tsx";
import {TranscriptionCard} from "./TranscriptionCard.tsx";

type HistoryTab = "stt" | "s2s";

function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
}

function ConversationSessionCard({session, onDelete}: {session: ConversationSession; onDelete: () => void}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const messageCount = session.messages.length;
    const turnCount = Math.floor(messageCount / 2);
    const preview = session.messages[0]?.content?.slice(0, 100) ?? "";

    return (
        <Card className="group relative flex flex-col bg-gradient-to-br from-muted/40 to-muted/20 border-border/50 w-full transition-all duration-300 hover:border-primary/40 hover:shadow-md">
            <CardHeader className="p-4 pb-2 flex-shrink-0 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                            {turnCount} turn{turnCount !== 1 ? "s" : ""}
                        </Badge>
                        {session.modelName && <span className="text-xs text-muted-foreground/60">{session.modelName}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 h-6 w-6"
                            title="Delete conversation"
                        >
                            <Trash2 className="w-3 h-3" />
                        </Button>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                </div>
            </CardHeader>

            {!isExpanded && (
                <CardContent className="p-4 pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-2">{preview}...</p>
                </CardContent>
            )}

            {isExpanded && (
                <CardContent className="p-4 pt-0 overflow-hidden" style={{maxHeight: 400}}>
                    <ScrollArea className="h-full">
                        <div className="flex flex-col gap-3 pr-2">
                            {session.messages.map((msg, i) => (
                                <div key={i} className={`flex flex-col gap-1 ${msg.role === "assistant" ? "pl-4 border-l-2 border-primary/30" : ""}`}>
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{msg.role === "user" ? "You" : "Assistant"}</span>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            )}

            <CardFooter className="p-4 pt-2 flex-shrink-0">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {getTimeAgo(new Date(session.startedAt))}
                </div>
            </CardFooter>
        </Card>
    );
}

export function VoiceHistoryView() {
    const [voice] = useGlobalState("voice");
    const [searchQuery, setSearchQuery] = useState("");
    const [tab, setTab] = useState<HistoryTab>("stt");
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
                searchInputRef.current?.blur();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

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

    const sortedSessions = useMemo(() => {
        return [...(voice.conversationSessions ?? [])].sort((a, b) => b.startedAt - a.startedAt);
    }, [voice.conversationSessions]);

    const clearActions =
        tab === "stt" && voice.transcriptionHistory.length > 0
            ? [{label: "Clear All", icon: Trash2, onClick: handleClearHistory, variant: "destructive" as const}]
            : tab === "s2s" && sortedSessions.length > 0
              ? [{label: "Clear All", icon: Trash2, onClick: () => G.voice.clearConversationSessions(), variant: "destructive" as const}]
              : undefined;

    return (
        <ContentPageLayout title="History" icon={History} actions={clearActions}>
            <div className="h-full flex flex-col">
                <Tabs value={tab} onValueChange={(v) => setTab(v as HistoryTab)} className="flex flex-col h-full">
                    <TabsList className="mb-4 self-start">
                        <TabsTrigger value="stt">
                            <AudioLines className="w-4 h-4" />
                            Speech to Text
                        </TabsTrigger>
                        <TabsTrigger value="s2s">
                            <MessageCircle className="w-4 h-4" />
                            Speech to Speech
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="stt" className="flex-1 flex flex-col mt-0">
                        {sortedHistory.length > 0 ? (
                            <>
                                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 mb-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            ref={searchInputRef}
                                            placeholder="Search transcriptions..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 pr-12"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <Kbd>/</Kbd>
                                        </div>
                                    </div>
                                </div>
                                <ScrollArea className="flex-1">
                                    <div className="space-y-3 pr-4">
                                        {filteredHistory.map((item) => (
                                            <TranscriptionCard key={item.id} item={item} searchQuery={searchQuery} onDelete={() => G.voice.removeTranscription(item.id)} />
                                        ))}
                                    </div>
                                </ScrollArea>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                                <History className="w-12 h-12 mb-4 opacity-50" />
                                <p className="text-lg">No transcriptions yet</p>
                                <p className="text-sm">Start recording to see your transcriptions here</p>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="s2s" className="flex-1 flex flex-col mt-0">
                        {sortedSessions.length > 0 ? (
                            <ScrollArea className="flex-1">
                                <div className="space-y-3 pr-4">
                                    {sortedSessions.map((session) => (
                                        <ConversationSessionCard key={session.id} session={session} onDelete={() => G.voice.removeConversationSession(session.id)} />
                                    ))}
                                </div>
                            </ScrollArea>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                                <MessagesSquare className="w-12 h-12 mb-4 opacity-50" />
                                <p className="text-lg">No conversations yet</p>
                                <p className="text-sm">Use Speech-to-Speech mode to start a conversation</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </ContentPageLayout>
    );
}
