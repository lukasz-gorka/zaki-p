import {listen} from "@tauri-apps/api/event";
import {Loader2, MessageCircle, Mic, Settings, Sparkles, Square, Trash2} from "lucide-react";
import {useCallback, useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {G} from "../../appInitializer/module/G.ts";
import {useGlobalState} from "../../hooks/useGlobalState.ts";
import {getProvidersWithTag} from "../../integrations/ai/aiModels/aiModels.ts";
import {Logger} from "../../logger/Logger.ts";
import {ROUTE_PATH} from "../../navigation/const/ROUTE_PATH.ts";
import {PageLayout} from "../templates/PageLayout.tsx";
import {Badge} from "../ui/badge.tsx";
import {Button} from "../ui/button.tsx";
import {Card, CardContent, CardHeader} from "../ui/card.tsx";
import {Label} from "../ui/label.tsx";
import {ScrollArea} from "../ui/scroll-area.tsx";
import {Switch} from "../ui/switch.tsx";
import {ToastAction} from "../ui/toast.tsx";
import {useToast} from "../ui/use-toast.ts";
import {TranscriptionCard} from "./TranscriptionCard.tsx";

type VoicePhase = "idle" | "recording" | "transcribing" | "enhancing" | "responding" | "speaking";
type HomeMode = "stt" | "s2s";

function formatElapsedTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const secondsStr = seconds < 10 ? ` ${seconds}s` : `${seconds}s`;

    if (minutes > 0) {
        return `${minutes}m ${secondsStr}`;
    }
    return secondsStr;
}

function useElapsedTimer(startTime: number | undefined, active: boolean): number {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!active || !startTime) {
            setElapsed(0);
            return;
        }

        const initialElapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsed(initialElapsed);

        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [active, startTime]);

    return elapsed;
}

function useAudioLevel(active: boolean): number {
    const [level, setLevel] = useState(0);

    useEffect(() => {
        if (!active) {
            setLevel(0);
            return;
        }

        let unlisten: (() => void) | null = null;

        listen<{level: number}>("audio-level", (event) => {
            setLevel(event.payload.level);
        }).then((fn) => {
            unlisten = fn;
        });

        return () => {
            if (unlisten) unlisten();
        };
    }, [active]);

    return level;
}

const AUDIO_THRESHOLD = 0.005;
const BAR_COUNT = 24;

export function VoiceHomeView() {
    const navigate = useNavigate();
    const {toast} = useToast();
    const [voice] = useGlobalState("voice");
    const [mounted, setMounted] = useState(false);
    const [mode, setMode] = useState<HomeMode>("stt");

    const sttProviders = getProvidersWithTag("speech-to-text");
    const chatProviders = getProvidersWithTag("chat");
    const isLocalProvider = voice.speechToText?.sttModel?.startsWith("local::");
    const hasSttModels = isLocalProvider || sttProviders.length > 0;
    const hasChatModels = chatProviders.length > 0;

    const isRecording = voice.isRecording ?? false;
    const isTranscribing = voice.isTranscribing ?? false;
    const isEnhancing = voice.isEnhancing ?? false;
    const isResponding = voice.isResponding ?? false;
    const isSpeakingState = voice.isSpeaking ?? false;
    const enableAIEnhancement = voice.enableAIEnhancement ?? true;

    const phase: VoicePhase = isSpeakingState
        ? "speaking"
        : isResponding
          ? "responding"
          : isEnhancing
            ? "enhancing"
            : isTranscribing
              ? "transcribing"
              : isRecording
                ? "recording"
                : "idle";

    const isProcessing = phase !== "idle" && phase !== "recording";

    const activeStartTime =
        phase === "recording"
            ? voice.recordingStartTime
            : phase === "transcribing"
              ? voice.transcribingStartTime
              : phase === "enhancing"
                ? voice.enhancingStartTime
                : phase === "responding"
                  ? voice.respondingStartTime
                  : phase === "speaking"
                    ? voice.speakingStartTime
                    : undefined;

    const elapsedSeconds = useElapsedTimer(activeStartTime, phase !== "idle");
    const audioLevel = useAudioLevel(phase === "recording");

    const isSpeaking = audioLevel > AUDIO_THRESHOLD;
    const boostedLevel = Math.pow(audioLevel, 0.6);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!hasSttModels) {
            toast({
                title: "No Speech-to-Text models configured",
                description: "Add a provider with STT models to start transcribing.",
                action: (
                    <ToastAction altText="Configure models" onClick={() => navigate(ROUTE_PATH.MODELS)}>
                        <Settings className="w-3.5 h-3.5 mr-1.5" />
                        Configure
                    </ToastAction>
                ),
            });
        } else if (voice.enableAIEnhancement && !hasChatModels) {
            toast({
                title: "No chat models configured for enhancement",
                description: "Add a provider with chat models or disable AI Enhancement.",
                action: (
                    <ToastAction altText="Configure models" onClick={() => navigate(ROUTE_PATH.MODELS)}>
                        <Settings className="w-3.5 h-3.5 mr-1.5" />
                        Configure
                    </ToastAction>
                ),
            });
        }
    }, []);

    const handleToggleRecording = useCallback(async () => {
        if (isProcessing) return;
        try {
            if (mode === "s2s") {
                await G.voice.toggleRecordingForConversation();
            } else {
                await G.voice.toggleRecordingForChat();
            }
        } catch (error) {
            Logger.error("Failed to toggle recording", {error});
        }
    }, [isProcessing, mode]);

    const handleToggleAIEnhancement = useCallback((checked: boolean) => {
        try {
            G.voice.setEnableAIEnhancement(checked);
        } catch (error) {
            Logger.error("Failed to toggle AI enhancement", {error});
        }
    }, []);

    const lastItem = useMemo(() => {
        const sorted = [...voice.transcriptionHistory].sort((a, b) => b.timestamp - a.timestamp);
        return sorted[0];
    }, [voice.transcriptionHistory]);

    const conversationCount = voice.conversationHistory?.length ?? 0;
    const lastAssistantMessage = useMemo(() => {
        const history = voice.conversationHistory ?? [];
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].role === "assistant") return history[i].content;
        }
        return null;
    }, [voice.conversationHistory]);

    const phaseLabel =
        phase === "recording"
            ? "Recording..."
            : phase === "transcribing"
              ? "Transcribing..."
              : phase === "enhancing"
                ? "Enhancing with AI..."
                : phase === "responding"
                  ? "Thinking..."
                  : phase === "speaking"
                    ? "Speaking..."
                    : "";

    const phaseColor =
        phase === "recording"
            ? "text-red-500"
            : phase === "transcribing"
              ? "text-blue-500"
              : phase === "enhancing" || phase === "responding"
                ? "text-purple-500"
                : phase === "speaking"
                  ? "text-green-500"
                  : "";

    const phaseBgColor =
        phase === "recording"
            ? "bg-red-500"
            : phase === "transcribing"
              ? "bg-blue-500"
              : phase === "enhancing" || phase === "responding"
                ? "bg-purple-500"
                : phase === "speaking"
                  ? "bg-green-500"
                  : "";

    const buttonConfig = {
        idle: {
            gradient:
                mode === "s2s"
                    ? "bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                    : "bg-gradient-to-br from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700",
            shadow: mode === "s2s" ? "shadow-2xl shadow-green-500/30" : "shadow-2xl shadow-primary/30",
            icon: <Mic className="w-16 h-16" />,
            float: true,
        },
        recording: {
            gradient: "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
            shadow: "shadow-2xl shadow-red-500/50",
            icon: <Square className="w-16 h-16" />,
            float: false,
        },
        transcribing: {
            gradient: "bg-gradient-to-br from-blue-500 to-blue-600",
            shadow: "shadow-2xl shadow-blue-500/30",
            icon: <Loader2 className="w-16 h-16 animate-spin" />,
            float: false,
        },
        enhancing: {
            gradient: "bg-gradient-to-br from-purple-500 to-purple-600",
            shadow: "shadow-2xl shadow-purple-500/30",
            icon: <Loader2 className="w-16 h-16 animate-spin" />,
            float: false,
        },
        responding: {
            gradient: "bg-gradient-to-br from-purple-500 to-purple-600",
            shadow: "shadow-2xl shadow-purple-500/30",
            icon: <Loader2 className="w-16 h-16 animate-spin" />,
            float: false,
        },
        speaking: {
            gradient: "bg-gradient-to-br from-green-500 to-green-600",
            shadow: "shadow-2xl shadow-green-500/30",
            icon: <Loader2 className="w-16 h-16 animate-spin" />,
            float: false,
        },
    };
    const btn = buttonConfig[phase];

    const idleGlow =
        mode === "s2s" ? (
            <>
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/30 blur-xl animate-pulse" />
                <div
                    className="absolute -inset-2 rounded-full bg-gradient-to-tr from-green-500/20 to-emerald-500/20 blur-2xl"
                    style={{animation: "float 6s ease-in-out infinite"}}
                />
            </>
        ) : (
            <>
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/30 blur-xl animate-pulse" />
                <div className="absolute -inset-2 rounded-full bg-gradient-to-tr from-primary/20 to-purple-500/20 blur-2xl" style={{animation: "float 6s ease-in-out infinite"}} />
            </>
        );

    const renderRecordingButton = () => (
        <div className="min-h-[224px] flex items-center justify-center w-[500px] max-w-[100%]">
            <div className="relative">
                {phase === "recording" && (
                    <>
                        <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                        <div className="absolute -inset-4 rounded-full bg-red-500/10 animate-pulse" />
                        <div className="absolute -inset-8 rounded-full bg-red-500/5 animate-pulse delay-150" />
                    </>
                )}
                {phase === "transcribing" && (
                    <>
                        <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                        <div className="absolute -inset-4 rounded-full bg-blue-500/10 animate-pulse" />
                        <div className="absolute -inset-8 rounded-full bg-blue-500/5 animate-pulse delay-150" />
                    </>
                )}
                {(phase === "enhancing" || phase === "responding") && (
                    <>
                        <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" />
                        <div className="absolute -inset-4 rounded-full bg-purple-500/10 animate-pulse" />
                        <div className="absolute -inset-8 rounded-full bg-purple-500/5 animate-pulse delay-150" />
                    </>
                )}
                {phase === "speaking" && (
                    <>
                        <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
                        <div className="absolute -inset-4 rounded-full bg-green-500/10 animate-pulse" />
                        <div className="absolute -inset-8 rounded-full bg-green-500/5 animate-pulse delay-150" />
                    </>
                )}
                {phase === "idle" && idleGlow}

                <Button
                    onClick={handleToggleRecording}
                    variant={phase === "recording" ? "destructive" : "default"}
                    size="lg"
                    disabled={isProcessing}
                    className={`
                        relative w-40 h-40 rounded-full transition-all duration-500 z-10 group
                        ${btn.gradient} ${btn.shadow}
                        ${isProcessing ? "cursor-not-allowed opacity-80" : ""}
                    `}
                    style={btn.float ? {animation: "float 4s ease-in-out infinite"} : {}}
                >
                    <div className={`transition-transform duration-300 ${phase === "idle" ? "group-hover:scale-110" : ""}`}>{btn.icon}</div>
                </Button>
            </div>
        </div>
    );

    const renderStatusArea = () => (
        <div className="h-[88px] overflow-hidden flex items-center justify-center mt-4">
            {phase === "idle" ? (
                <div className="flex flex-col items-center gap-2 animate-in fade-in duration-500">
                    <span className="text-xl font-medium bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">Click to start recording</span>
                    <p className="text-sm text-muted-foreground/70">{mode === "s2s" ? "Voice will be transcribed and answered" : "Audio will be transcribed automatically"}</p>
                </div>
            ) : (
                <div className="relative w-full flex items-center justify-center animate-in fade-in duration-300">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="flex gap-2 items-center h-4">
                            {phase === "recording"
                                ? Array.from({length: BAR_COUNT}, (_, i) => (
                                      <div
                                          key={i}
                                          className="w-2 rounded-full"
                                          style={{
                                              height: isSpeaking ? `${Math.max(3, Math.min(boostedLevel * 160, 16)) + Math.random() * 2}px` : "3px",
                                              opacity: isSpeaking ? 0.2 : 0.08,
                                              transition: isSpeaking ? "height 0.08s ease-out" : "none",
                                          }}
                                      />
                                  ))
                                : Array.from({length: BAR_COUNT}, (_, i) => (
                                      <div
                                          key={i}
                                          className={`w-[2px] rounded-full ${phaseBgColor}`}
                                          style={{
                                              height: "5px",
                                              animation: "pulse-dot 1s ease-in-out infinite",
                                              animationDelay: `${(i % 4) * 0.15}s`,
                                              opacity: 0.15,
                                          }}
                                      />
                                  ))}
                        </div>
                    </div>

                    <div className="relative z-10 flex flex-col items-center gap-1">
                        <span className={`text-lg font-medium ${phaseColor}`}>{phaseLabel}</span>
                        <span className="text-sm font-mono text-muted-foreground">{formatElapsedTime(elapsedSeconds)}</span>
                        {phase === "recording" && <p className="text-xs text-muted-foreground/70">Click to stop and {mode === "s2s" ? "converse" : "transcribe"}</p>}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <PageLayout maxWidth="xl">
            <div className="flex flex-col h-full items-center justify-center relative z-10">
                <div className="absolute top-2 right-2 z-20 flex gap-1">
                    <button
                        onClick={() => setMode("stt")}
                        className={`text-[11px] px-2 py-1 rounded transition-colors ${mode === "stt" ? "text-foreground bg-muted/60" : "text-muted-foreground/50 hover:text-muted-foreground"}`}
                    >
                        STT
                    </button>
                    <button
                        onClick={() => setMode("s2s")}
                        className={`text-[11px] px-2 py-1 rounded transition-colors ${mode === "s2s" ? "text-foreground bg-muted/60" : "text-muted-foreground/50 hover:text-muted-foreground"}`}
                    >
                        S2S
                    </button>
                </div>
                <div className={`flex flex-col items-center transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
                    {renderRecordingButton()}

                    <div className={`h-10 flex items-center justify-center transition-opacity duration-300 ${phase === "idle" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                        {mode === "stt" ? (
                            <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 rounded-lg border border-border/50">
                                <Switch id="ai-enhancement" checked={enableAIEnhancement} onCheckedChange={handleToggleAIEnhancement} />
                                <Label htmlFor="ai-enhancement" className="text-sm cursor-pointer flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4" />
                                    AI Enhancement
                                </Label>
                            </div>
                        ) : (
                            conversationCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 px-4 gap-2 text-sm text-muted-foreground hover:text-destructive bg-muted/30 rounded-lg border border-border/50"
                                    onClick={() => G.voice.clearConversationHistory()}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    New Conversation
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                                        {conversationCount}
                                    </Badge>
                                </Button>
                            )
                        )}
                    </div>

                    {renderStatusArea()}

                    <div className="mt-4 max-w-[500px] w-full">
                        {mode === "stt" ? (
                            <TranscriptionCard
                                item={lastItem}
                                header="Last transcription"
                                isLoading={phase !== "idle"}
                                loadingBadge={
                                    phase === "transcribing" ? (
                                        <Badge variant="outline" className="text-xs text-blue-500 border-blue-500/30">
                                            Processing
                                        </Badge>
                                    ) : phase === "enhancing" ? (
                                        <Badge variant="outline" className="text-xs text-purple-500 border-purple-500/30">
                                            Enhancing
                                        </Badge>
                                    ) : undefined
                                }
                                scrollContent
                                className="h-[180px]"
                            />
                        ) : (
                            <Card className="bg-gradient-to-br from-muted/40 to-muted/20 border-border/50 h-[180px] flex flex-col">
                                <CardHeader className="p-4 pb-2 flex-shrink-0">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <MessageCircle className="w-3 h-3" />
                                        Last response
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 pt-0 flex-1 overflow-hidden">
                                    {lastAssistantMessage ? (
                                        <ScrollArea className="h-full">
                                            <p className="text-sm leading-relaxed pr-2">{lastAssistantMessage}</p>
                                        </ScrollArea>
                                    ) : (
                                        <div className="h-full flex items-center justify-center">
                                            <p className="text-sm text-muted-foreground/50">No conversations yet</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px) scale(1); }
                    50% { transform: translateY(-10px) scale(1.02); }
                }
                @keyframes pulse-dot {
                    0%, 100% { opacity: 0.3; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.3); }
                }
            `}</style>
        </PageLayout>
    );
}
