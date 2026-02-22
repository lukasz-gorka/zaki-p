import {AudioLines, Bot, History, MessageCircle, Mic, Sparkles, Wrench} from "lucide-react";
import {NavigationItem} from "../interface/NavigationItem.ts";
import {ROUTE_PATH} from "./ROUTE_PATH.ts";

export const BASE_NAVIGATION: NavigationItem[] = [
    {
        label: "Home",
        path: ROUTE_PATH.HOME,
        icon: Mic,
    },
    {
        label: "History",
        path: ROUTE_PATH.HISTORY,
        icon: History,
    },
    {
        label: "Models",
        path: ROUTE_PATH.MODELS,
        icon: Bot,
    },
    {
        label: "Speech-to-Text",
        path: ROUTE_PATH.VOICE_SETTINGS,
        icon: AudioLines,
    },
    {
        label: "Speech-to-Speech",
        path: ROUTE_PATH.SPEECH_TO_SPEECH,
        icon: MessageCircle,
    },
    {
        label: "Enhancer",
        path: ROUTE_PATH.ENHANCER,
        icon: Sparkles,
    },
    {
        label: "Advanced",
        path: ROUTE_PATH.SETTINGS,
        icon: Wrench,
    },
];
