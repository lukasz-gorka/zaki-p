import {ROUTE_PATH} from "../navigation/const/ROUTE_PATH.ts";
import {PluginRegistry} from "../plugins/PluginRegistry.ts";
import type {ICommandPanelItem} from "./interface/ICommandPanelItem.ts";

interface CommandDefinition {
    id: string;
    label: string;
    description?: string;
    icon?: string;
    category: string;
    keywords: string[];
    enterCategory?: string;
    navigateTo?: string;
}

const commandDefinitions: CommandDefinition[] = [
    {
        id: "browse-history",
        label: "Browse Transcription History",
        description: "View transcription history",
        icon: "Clock",
        category: "Actions",
        keywords: ["browse", "history", "transcriptions", "past"],
        enterCategory: "History",
    },
    {
        id: "browse-skills",
        label: "Browse Skills",
        description: "View and manage your skills",
        icon: "Code",
        category: "Actions",
        keywords: ["browse", "skills", "list", "all"],
        enterCategory: "Skills",
    },
    {
        id: "browse-chat-history",
        label: "Browse History",
        description: "View chat conversations",
        icon: "MessageSquare",
        category: "Actions",
        keywords: ["browse", "chat", "history", "conversations"],
        enterCategory: "Chat History",
    },

    {
        id: "nav-voice",
        label: "Voice",
        description: "Navigate to voice home",
        icon: "Mic",
        category: "Navigation",
        keywords: ["voice", "home", "record"],
        navigateTo: ROUTE_PATH.VOICE,
    },
    {
        id: "nav-history",
        label: "Transcription History",
        description: "Navigate to history page",
        icon: "History",
        category: "Navigation",
        keywords: ["history", "go", "navigate"],
        navigateTo: ROUTE_PATH.HISTORY,
    },
    {
        id: "nav-settings",
        label: "Settings",
        description: "Navigate to settings",
        icon: "Settings2",
        category: "Navigation",
        keywords: ["settings", "preferences"],
        navigateTo: ROUTE_PATH.SETTINGS,
    },

    {
        id: "nav-models",
        label: "Models",
        description: "Configure AI models and providers",
        icon: "Bot",
        category: "Settings",
        keywords: ["models", "ai", "providers"],
        navigateTo: ROUTE_PATH.MODELS,
    },
    {
        id: "nav-transcription",
        label: "Transcription",
        description: "Voice transcription settings",
        icon: "AudioLines",
        category: "Settings",
        keywords: ["transcription", "voice", "stt", "speech"],
        navigateTo: ROUTE_PATH.VOICE_SETTINGS,
    },
    {
        id: "nav-general",
        label: "General",
        description: "General settings",
        icon: "LayoutDashboard",
        category: "Settings",
        keywords: ["general", "settings"],
        navigateTo: ROUTE_PATH.SETTINGS_GENERAL,
    },
];

export function getCommandPanelItems(navigate: (path: string) => void, onClose: () => void): ICommandPanelItem[] {
    const items: ICommandPanelItem[] = commandDefinitions.map((cmd) => ({
        id: cmd.id,
        label: cmd.label,
        description: cmd.description,
        icon: cmd.icon,
        category: cmd.category,
        keywords: cmd.keywords,
        metadata: {
            enterCategory: cmd.enterCategory,
        },
        actions: [
            {
                id: "execute",
                label: cmd.enterCategory ? "Browse" : "Go",
                shortcut: "Enter",
                onAction: async () => {
                    if (cmd.navigateTo) {
                        navigate(cmd.navigateTo);
                        onClose();
                    }
                },
            },
        ],
        showInMainView: true,
    }));

    const pluginNav = PluginRegistry.getNavigation();
    for (const item of pluginNav) {
        items.push({
            id: `plugin-${item.path}`,
            label: item.label,
            icon: item.icon,
            category: "Pro",
            keywords: [item.label.toLowerCase()],
            actions: [
                {
                    id: "navigate",
                    label: "Go",
                    shortcut: "Enter",
                    onAction: async () => {
                        navigate(item.path);
                        onClose();
                    },
                },
            ],
            showInMainView: true,
        });
    }

    return items;
}
