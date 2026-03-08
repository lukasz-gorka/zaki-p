import "../../../public/css/style.css";
import {emitTo, listen} from "@tauri-apps/api/event";
import {getCurrentWebviewWindow} from "@tauri-apps/api/webviewWindow";
import {useEffect, useRef, useState} from "react";
import {createRoot} from "react-dom/client";

type PopupState = "initializing" | "recording" | "transcribing" | "enhancing" | "processing" | "responding" | "speaking" | "skill-executing";

const STATE_CONFIG: Record<PopupState, {label: string; color: string}> = {
    initializing: {label: "Initializing", color: "#6b7280"},
    recording: {label: "Recording", color: "#ef4444"},
    transcribing: {label: "Transcribing", color: "#3b82f6"},
    enhancing: {label: "Processing", color: "#8b5cf6"},
    processing: {label: "Processing", color: "#8b5cf6"},
    responding: {label: "Thinking", color: "#f59e0b"},
    speaking: {label: "Speaking", color: "#22c55e"},
    "skill-executing": {label: "Executing", color: "#f59e0b"},
};

function formatElapsedTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const secondsStr = seconds < 10 ? `0${seconds}` : `${seconds}`;
    if (minutes > 0) {
        return `${minutes}:${secondsStr}`;
    }
    return `0:${secondsStr}`;
}

function RecordingPopup() {
    const [state, setState] = useState<PopupState>("initializing");
    const [customLabel, setCustomLabel] = useState<string | undefined>();
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const stateStartTimeRef = useRef<number>(Date.now());

    useEffect(() => {
        stateStartTimeRef.current = Date.now();
        setElapsedSeconds(0);
    }, [state]);

    useEffect(() => {
        if (state === "initializing") return;
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - stateStartTimeRef.current) / 1000);
            setElapsedSeconds(elapsed);
        }, 1000);
        return () => clearInterval(interval);
    }, [state]);

    useEffect(() => {
        let unlistenFn: (() => void) | null = null;
        let unlistenAudioLevel: (() => void) | null = null;

        const setupListener = async () => {
            try {
                const window = getCurrentWebviewWindow();
                const label = window.label;
                const eventName = `recording-popup-state-${label}`;
                const unlisten = await listen<{state: PopupState; label?: string}>(eventName, (event) => {
                    setState(event.payload.state);
                    setCustomLabel(event.payload.label);
                });
                unlistenFn = unlisten;

                // Listen for audio level events
                const unlistenLevel = await listen<{level: number}>("audio-level", (event) => {
                    setAudioLevel(event.payload.level);
                });
                unlistenAudioLevel = unlistenLevel;
            } catch (error) {
                console.error("[RecordingPopup] Failed to setup listener:", error);
            }
        };
        setupListener();
        return () => {
            if (unlistenFn) unlistenFn();
            if (unlistenAudioLevel) unlistenAudioLevel();
        };
    }, []);

    const handleStop = async () => {
        if (state === "initializing") return;
        if (state === "speaking") {
            await emitTo("main", "voice-popup-action", {action: "stop-speaking"});
        } else if (state === "recording") {
            await emitTo("main", "voice-popup-action", {action: "stop"});
        } else {
            await emitTo("main", "voice-popup-action", {action: "cancel"});
        }
    };

    const config = STATE_CONFIG[state];
    const displayLabel = customLabel || config.label;
    const isProcessing =
        state === "transcribing" || state === "enhancing" || state === "processing" || state === "responding" || state === "speaking" || state === "skill-executing";

    const AUDIO_THRESHOLD = 0.005;
    const isSpeaking = audioLevel > AUDIO_THRESHOLD;
    const boostedLevel = Math.pow(audioLevel, 0.6);

    const bars = Array.from({length: 16}, (_, i) => ({
        id: i,
        height: isSpeaking ? Math.max(3, Math.min(boostedLevel * 200, 15)) + Math.random() * 1.5 : 2,
    }));

    return (
        <div className="flex items-center justify-between w-full h-full bg-black/85 backdrop-blur-[8px] px-3 gap-2.5 border border-white/10 font-sans">
            <div className="flex items-center gap-2 flex-1">
                {state === "recording" && (
                    <div className="flex gap-0.5 items-center h-4">
                        {bars.map((bar) => (
                            <div
                                key={bar.id}
                                className="w-0.5 rounded-[1px]"
                                style={{
                                    height: `${bar.height}px`,
                                    backgroundColor: config.color,
                                    opacity: isSpeaking ? 0.9 : 0.4,
                                    transition: isSpeaking ? "height 0.08s ease-out" : "none",
                                }}
                            />
                        ))}
                    </div>
                )}

                {isProcessing && (
                    <>
                        <span className="text-[9px] text-white/50 font-medium uppercase tracking-wider">{displayLabel}</span>
                        <div className="flex gap-[3px] items-center">
                            {[0, 1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="w-1 h-1 rounded-[1px]"
                                    style={{
                                        backgroundColor: config.color,
                                        animationName: "pulse-square",
                                        animationDuration: "1s",
                                        animationTimingFunction: "ease-in-out",
                                        animationIterationCount: "infinite",
                                        animationDelay: `${i * 0.15}s`,
                                        opacity: 0.3,
                                    }}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {state !== "initializing" && <span className="text-[11px] font-medium text-white/60 tabular-nums">{formatElapsedTime(elapsedSeconds)}</span>}

            {state !== "initializing" && (
                <button
                    onClick={handleStop}
                    className="w-5 h-5 rounded-md border-0 cursor-pointer flex items-center justify-center shrink-0 transition-all duration-150 p-0 hover:scale-110"
                    style={{
                        backgroundColor: state === "recording" ? "rgba(239, 68, 68, 0.2)" : "rgba(255, 255, 255, 0.1)",
                        color: state === "recording" ? "#ef4444" : "rgba(255, 255, 255, 0.6)",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = state === "recording" ? "rgba(239, 68, 68, 0.35)" : "rgba(255, 255, 255, 0.2)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = state === "recording" ? "rgba(239, 68, 68, 0.2)" : "rgba(255, 255, 255, 0.1)";
                    }}
                    title={state === "recording" ? "Stop recording" : "Cancel"}
                >
                    {state === "recording" ? (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                            <rect width="8" height="8" rx="1" />
                        </svg>
                    ) : (
                        <svg width="8" height="8" viewBox="0 0 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <line x1="1" y1="1" x2="7" y2="7" />
                            <line x1="7" y1="1" x2="1" y2="7" />
                        </svg>
                    )}
                </button>
            )}
        </div>
    );
}

document.documentElement.classList.add("dark");
document.body.classList.add("dark", "bg-transparent", "text-zinc-100");

const root = document.getElementById("root");

if (root) {
    const reactRoot = createRoot(root);
    reactRoot.render(<RecordingPopup />);
}
