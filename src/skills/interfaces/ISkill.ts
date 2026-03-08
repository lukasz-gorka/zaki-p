import {NotificationSoundName} from "../../sound/NotificationSoundName.ts";

export interface ISkill {
    uuid: string;
    internal: boolean;
    model: string;
    instruction: string;
    icon: string;
    avatar?: string;
    category: string;
    label: string;
    keystroke?: string;
    copyToClipboard?: boolean;
    playSoundNotification?: boolean;
    soundNotificationId?: NotificationSoundName;
    silentMode?: boolean;
    isolatedContext?: boolean;
    remoteAction?: boolean;
    webhook?: string;
    directWebhook?: boolean;
    webhookPayloadTemplate?: string;
    showFullWebhookResponse?: boolean;
    jsonMode?: boolean;
    showInPopup?: boolean;
    showGlobalPopup?: boolean;
    inputSource?: "clipboard" | "voice";
}

export interface IExecutingSkill {
    skillId: string;
    label: string;
    icon: string;
    startTime: number;
}

export interface ISkillStore {
    list: ISkill[];
    activeSkillId: string;
    executingSkill?: IExecutingSkill;
}

export const DEFAULT_SKILL_STORE: ISkillStore = {
    list: [
        {
            uuid: "default-translate",
            internal: true,
            model: "",
            instruction:
                "Translate the following text. If it's in English, translate to Polish. If it's in Polish, translate to English. Only output the translation, nothing else.\n\n{{{MESSAGE}}}",
            icon: "Languages",
            category: "Translation",
            label: "Translate EN/PL",
            copyToClipboard: true,
            silentMode: true,
        },
        {
            uuid: "default-enhancer",
            internal: true,
            model: "",
            instruction: "",
            icon: "Sparkles",
            category: "Voice",
            label: "Enhancer",
            copyToClipboard: true,
            silentMode: true,
            inputSource: "voice",
        },
    ],
    activeSkillId: "",
};
