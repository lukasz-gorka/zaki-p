import {ChevronDown, Clock, MessagesSquare, Trash2} from "lucide-react";
import {useMemo, useState} from "react";
import {G} from "../../appInitializer/module/G.ts";
import {useGlobalState} from "../../hooks/useGlobalState.ts";
import {ConversationSession} from "../../voice/interfaces/IVoiceSettings.ts";
import {ContentPageLayout} from "../templates/ContentPageLayout.tsx";
import {Badge} from "../ui/badge.tsx";
import {Button} from "../ui/button.tsx";
import {Card, CardContent, CardFooter, CardHeader} from "../ui/card.tsx";
import {ScrollArea} from "../ui/scroll-area.tsx";

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
                <CardContent className="p-4 pt-0">
                    <ScrollArea className="max-h-[400px]">
                        <div className="flex flex-col gap-3">
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

export function ConversationsView() {
    const [voice] = useGlobalState("voice");

    const sortedSessions = useMemo(() => {
        return [...(voice.conversationSessions ?? [])].sort((a, b) => b.startedAt - a.startedAt);
    }, [voice.conversationSessions]);

    return (
        <ContentPageLayout
            title="Conversations"
            icon={MessagesSquare}
            actions={
                sortedSessions.length > 0
                    ? [
                          {
                              label: "Clear All",
                              icon: Trash2,
                              onClick: () => G.voice.clearConversationSessions(),
                              variant: "destructive",
                          },
                      ]
                    : undefined
            }
        >
            <div className="h-full flex flex-col">
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
                        <p className="text-sm">Use the Speech-to-Speech shortcut to start a conversation</p>
                    </div>
                )}
            </div>
        </ContentPageLayout>
    );
}
