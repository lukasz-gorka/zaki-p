import {writeText} from "@tauri-apps/plugin-clipboard-manager";
import {G} from "../appInitializer/module/G.ts";
import {store} from "../appInitializer/store/index.ts";
import {parseModelId} from "../integrations/ai/interface/AIModel.ts";
import {agentService} from "../integrations/ai/sdk";
import {Logger} from "../logger/Logger.ts";
import {NotificationSoundName} from "../sound/NotificationSoundName.ts";
import {playNotificationSound} from "../sound/sounds.ts";
import type {ClipboardContent} from "../utils/clipboard.ts";
import {parseApiErrorMessage, showConfigError} from "../utils/configErrors.ts";
import {showPopup} from "../utils/popup/PopupManager.ts";
import {getUniqueName} from "../utils/uniqueName.ts";
import {resolveTextVariables} from "../variables/textVariables.ts";
import {IExecutingSkill, ISkill, ISkillStore} from "./interfaces/ISkill.ts";
import {SkillStoreManager} from "./store/SkillStoreManager.ts";

export class SkillModule {
    private storeManager: SkillStoreManager;

    constructor() {
        this.storeManager = new SkillStoreManager();
    }

    state(): ISkillStore {
        return (this.storeManager.state() as any) || {list: [], activeSkillId: ""};
    }

    getSkills(): ISkill[] {
        return this.state().list || [];
    }

    getSkillById(uuid: string): ISkill | undefined {
        return this.getSkills().find((s) => s.uuid === uuid);
    }

    addSkill(skill: ISkill) {
        this.storeManager.addSkill(skill);
    }

    removeSkill(uuid: string) {
        this.storeManager.removeSkill(uuid);
        G.globalShortcuts.refreshShortcuts();
    }

    updateSkill(skill: ISkill) {
        const otherNames = this.getSkills()
            .filter((s) => s.uuid !== skill.uuid)
            .map((s) => s.label);
        const uniqueLabel = getUniqueName(skill.label, otherNames);
        this.storeManager.updateSkill({...skill, label: uniqueLabel});
        G.globalShortcuts.refreshShortcuts();
    }

    private existingNames(): string[] {
        return this.getSkills().map((s) => s.label);
    }

    duplicateSkill(skill: ISkill): ISkill {
        const copy: ISkill = {
            ...skill,
            uuid: crypto.randomUUID(),
            label: getUniqueName(skill.label, this.existingNames()),
            internal: false,
        };
        this.addSkill(copy);
        return copy;
    }

    createNewSkill(): ISkill {
        const skill: ISkill = {
            uuid: crypto.randomUUID(),
            internal: false,
            model: "",
            instruction: "",
            icon: "Zap",
            category: "Custom",
            label: getUniqueName("New Skill", this.existingNames()),
            copyToClipboard: true,
            silentMode: false,
        };
        this.addSkill(skill);
        return skill;
    }

    setExecuting(executing: IExecutingSkill | undefined): void {
        this.storeManager.setExecutingSkill(executing);
    }

    async executeSkill(skill: ISkill, userMessage: string, extraContext?: {clipboard?: ClipboardContent; sessionId?: string}): Promise<string | null> {
        Logger.info(`[Skills] executeSkill start`, {
            data: {label: skill.label, uuid: skill.uuid, model: skill.model, silentMode: skill.silentMode, copyToClipboard: skill.copyToClipboard},
        });

        const model = skill.model;
        if (!model) {
            Logger.warn(`[Skills] No model configured for skill "${skill.label}".`);
            showConfigError({
                title: `Skill "${skill.label}" has no model`,
                description: "Please assign a model in skill settings.",
            });
            return null;
        }

        const parsed = parseModelId(model);
        if (!parsed) {
            Logger.warn(`[Skills] Invalid model ID: "${model}"`);
            showConfigError({
                title: "Invalid model configuration",
                description: `Model ID "${model}" is malformed. Please reconfigure the skill.`,
            });
            return null;
        }

        const providers = store.getState().provider?.collection || [];
        const provider = providers.find((p: any) => p.uuid === parsed.providerId || p.id === parsed.providerId);
        if (!provider) {
            Logger.warn(`[Skills] Provider not found for "${parsed.providerId}"`);
            showConfigError({
                title: "Provider not found",
                description: `Provider for skill "${skill.label}" may have been removed. Please reconfigure.`,
            });
            return null;
        }

        const clipboardData = extraContext?.clipboard;
        const clipboardText = clipboardData?.type === "text" ? clipboardData.text : "";
        const clipboardImage = clipboardData?.type === "image" ? clipboardData : null;

        const instruction = resolveTextVariables(skill.instruction, {
            message: userMessage,
            clipboard: clipboardText,
            sessionId: extraContext?.sessionId,
        });

        // Build user message content — multimodal if clipboard has an image and {{{CLIPBOARD}}} is used
        const hasClipboardSnippet = skill.instruction.includes("{{{CLIPBOARD}}}");
        let userContent: string | any[];
        if (hasClipboardSnippet && clipboardImage) {
            userContent = [
                {type: "image", image: clipboardImage.base64, mediaType: clipboardImage.mimeType},
                {type: "text", text: userMessage},
            ];
        } else {
            userContent = userMessage;
        }

        try {
            let result: string;

            if (skill.remoteAction && skill.webhook && skill.directWebhook) {
                // Direct webhook mode — skip AI, send directly to webhook
                result = await this.sendDirectWebhook(skill, userMessage, extraContext?.sessionId);
            } else {
                // AI completion via AgentService
                const response = await agentService.completion({
                    messages: [
                        {role: "system", content: instruction},
                        {role: "user", content: userContent},
                    ],
                    model: skill.model,
                });

                result = response.text || "";

                // Remote action mode — send AI result to webhook
                if (skill.remoteAction && skill.webhook && result) {
                    result = await this.runRemoteAction(skill, result);
                }
            }

            if (skill.copyToClipboard && result) {
                try {
                    await writeText(result);
                } catch (err) {
                    Logger.warn("[Skills] Failed to copy to clipboard", {error: err as Error});
                    showConfigError({
                        title: "Clipboard Error",
                        description: "Skill completed but failed to copy result to clipboard.",
                    });
                }
            }

            if (skill.playSoundNotification) {
                const soundId = skill.soundNotificationId || NotificationSoundName.SUCCESS;
                playNotificationSound(soundId);
            }

            if (skill.showInPopup && result) {
                const sanitizedLabel = skill.label.replace(/[^a-zA-Z0-9-]/g, "-");
                await showPopup(`snippet-${sanitizedLabel}`, {
                    content: {type: "text", title: skill.label, text: result, icon: skill.icon},
                });
            }

            return result;
        } catch (error) {
            const stepInfo = skill.directWebhook ? "during webhook execution" : "during AI completion";
            Logger.error(`[Skills] Execution failed ${stepInfo}`, {error});
            showConfigError({
                title: `Skill "${skill.label}" failed`,
                description: parseApiErrorMessage(error),
            });
            return null;
        }
    }

    private async sendDirectWebhook(skill: ISkill, message: string, sessionId?: string): Promise<string> {
        if (!skill.webhook) throw new Error("No webhook URL provided");

        const template = skill.webhookPayloadTemplate || '{"message": "{{{MESSAGE}}}"}';
        const payload = resolveTextVariables(template, {message, sessionId});

        Logger.info("[Skills] Sending direct webhook", {data: {url: skill.webhook}});
        const result = await G.rustProxy.executeWebhook({url: skill.webhook, data: payload});
        return this.parseWebhookResponse(result, skill.showFullWebhookResponse);
    }

    private async runRemoteAction(skill: ISkill, aiResult: string): Promise<string> {
        if (!skill.webhook) return aiResult;

        Logger.info("[Skills] Sending AI result to webhook", {data: {url: skill.webhook}});
        const result = await G.rustProxy.executeWebhook({url: skill.webhook, data: aiResult});
        return this.parseWebhookResponse(result, skill.showFullWebhookResponse);
    }

    private parseWebhookResponse(result: string, showFull?: boolean): string {
        if (showFull) {
            try {
                const parsed = JSON.parse(result);
                return JSON.stringify(parsed, null, 2);
            } catch {
                return result;
            }
        }

        try {
            const parsed = JSON.parse(result);
            if (parsed.output !== undefined) return parsed.output;
            return JSON.stringify(parsed, null, 2);
        } catch {
            return result;
        }
    }

    getGroupedSkills(): Map<string, ISkill[]> {
        const groups = new Map<string, ISkill[]>();
        for (const skill of this.getSkills()) {
            const cat = skill.category || "Uncategorized";
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat)!.push(skill);
        }
        return groups;
    }
}
