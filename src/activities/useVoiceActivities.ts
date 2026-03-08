import {useMemo} from "react";
import {G} from "../appInitializer/module/G.ts";
import {useGlobalState} from "../hooks/useGlobalState.ts";
import type {Activity} from "./ActivityRegistry.ts";

export function useVoiceActivities(): Activity[] {
    const [voice] = useGlobalState("voice");

    return useMemo(() => {
        const activities: Activity[] = [];

        if (voice.isRecording) {
            activities.push({
                id: "voice-recording",
                label: "Recording",
                color: "red",
                startTime: voice.recordingStartTime,
                cancelable: true,
                onCancel: () => G.voice.cancelRecording(),
            });
        }

        if (voice.isTranscribing) {
            activities.push({
                id: "voice-transcribing",
                label: "Transcribing",
                color: "blue",
                startTime: voice.transcribingStartTime,
                cancelable: true,
                onCancel: () => G.voice.cancelProcessing(),
            });
        }

        if (voice.isProcessing) {
            activities.push({
                id: "voice-processing",
                label: "Processing",
                color: "purple",
                startTime: voice.processingStartTime,
                cancelable: true,
                onCancel: () => G.voice.cancelProcessing(),
            });
        }

        if (voice.isSpeaking) {
            activities.push({
                id: "voice-speaking",
                label: "Speaking",
                color: "green",
                startTime: voice.speakingStartTime,
                cancelable: true,
                onCancel: () => G.voice.stopSpeaking(),
            });
        }

        return activities;
    }, [
        voice.isRecording,
        voice.isTranscribing,
        voice.isProcessing,
        voice.isSpeaking,
        voice.recordingStartTime,
        voice.transcribingStartTime,
        voice.processingStartTime,
        voice.speakingStartTime,
    ]);
}
