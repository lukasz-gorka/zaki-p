import {AudioLines, Bot, History, LayoutDashboard, Mic, Settings2} from "lucide-react";
import {NavigationItem} from "../interface/NavigationItem.ts";
import {ROUTE_PATH} from "./ROUTE_PATH.ts";

export const BASE_NAVIGATION: NavigationItem[] = [
    {
        label: "Voice",
        path: ROUTE_PATH.VOICE,
        icon: Mic,
        order: 2,
    },
    {
        label: "Transcription History",
        path: ROUTE_PATH.HISTORY,
        icon: History,
        order: 10,
    },
    {
        label: "Settings",
        path: ROUTE_PATH.SETTINGS,
        icon: Settings2,
        order: 20,
    },
];

export const SETTINGS_NAVIGATION: NavigationItem[] = [
    {
        label: "Models",
        path: ROUTE_PATH.MODELS,
        icon: Bot,
        order: 0,
    },
    {
        label: "Transcription",
        path: ROUTE_PATH.VOICE_SETTINGS,
        icon: AudioLines,
        order: 1,
    },
    {
        label: "General",
        path: ROUTE_PATH.SETTINGS_GENERAL,
        icon: LayoutDashboard,
        order: -1,
    },
];
