import {Zap} from "lucide-react";
import {G} from "../appInitializer/module/G.ts";
import {IGlobalState} from "../appInitializer/store/interfaces/IGlobalState.ts";
import {GlobalShortcut} from "../globalShortcuts/GlobalShortcut.ts";
import {Logger} from "../logger/Logger.ts";
import {ROUTE_PATH} from "../navigation/const/ROUTE_PATH.ts";
import {Plugin} from "../plugins/PluginRegistry.ts";
import {readSmartClipboard} from "../utils/clipboard.ts";
import {DEFAULT_SKILL_STORE, ISkillStore} from "./interfaces/ISkill.ts";
import {SkillModule} from "./SkillModule.ts";
import {SkillsPageView} from "./views/SkillsPageView.tsx";

let skillModule: SkillModule | null = null;

export function getSkillModule(): SkillModule {
    if (!skillModule) {
        skillModule = new SkillModule();
    }
    return skillModule;
}

export const skillsPlugin: Plugin = {
    id: "skills",
    routes: [{path: ROUTE_PATH.SKILLS, component: SkillsPageView}],
    navigation: [
        {
            label: "Skills",
            path: ROUTE_PATH.SKILLS,
            icon: Zap,
            order: 3,
        },
    ],
    storeDefaults: {
        skills: DEFAULT_SKILL_STORE,
    },
    shortcuts: () => {
        const shortcuts: GlobalShortcut[] = [];
        const skills = getSkillModule().getSkills();

        for (const skill of skills) {
            if (skill.keystroke?.trim()) {
                const skillId = skill.uuid;
                shortcuts.push(
                    new GlobalShortcut(
                        skill.keystroke,
                        async () => {
                            const freshSkill = getSkillModule().getSkillById(skillId);
                            if (!freshSkill) {
                                Logger.warn(`[Skills] Shortcut fired but skill ${skillId} no longer exists`);
                                return;
                            }
                            Logger.info(`[Skills] Shortcut fired for "${freshSkill.label}"`, {
                                data: {silentMode: freshSkill.silentMode, model: freshSkill.model, inputSource: freshSkill.inputSource},
                            });

                            // Voice input source: emit event for VoiceModule to handle
                            if (freshSkill.inputSource === "voice") {
                                G.events.emit("skill:voice-execute", {skillId: freshSkill.uuid});
                                return;
                            }

                            // Clipboard input source (default)
                            let clipboard;
                            try {
                                clipboard = await readSmartClipboard();
                            } catch (err) {
                                Logger.warn("[Skills] Failed to read clipboard", {error: err as Error});
                            }
                            const clipboardText = clipboard?.type === "text" ? clipboard.text : "";

                            // Execute as silent when: silentMode is on, OR clipboard has image
                            // (non-silent chat mode doesn't support image input from shortcuts)
                            if (freshSkill.silentMode || clipboard?.type === "image") {
                                const sm = getSkillModule();
                                sm.setExecuting({skillId: freshSkill.uuid, label: freshSkill.label, icon: freshSkill.icon, startTime: Date.now()});

                                if (freshSkill.showGlobalPopup) {
                                    try {
                                        await G.statusPopup.pushState(`skill-${freshSkill.uuid}`, "skill-executing", freshSkill.label);
                                    } catch (popupErr) {
                                        Logger.warn("[Skills] Failed to show global popup", {error: popupErr as Error});
                                    }
                                }

                                try {
                                    const result = await sm.executeSkill(freshSkill, clipboardText, {clipboard});
                                    sm.setExecuting(undefined);

                                    if (freshSkill.showGlobalPopup) {
                                        await G.statusPopup.popState(`skill-${freshSkill.uuid}`);
                                    }

                                    if (result) {
                                        G.events.emit("skill:executed", {
                                            skillLabel: freshSkill.label,
                                            skillId: freshSkill.uuid,
                                            icon: freshSkill.icon,
                                            input: clipboardText,
                                            output: result,
                                            model: freshSkill.model,
                                        });
                                    }
                                } catch (err) {
                                    sm.setExecuting(undefined);
                                    if (freshSkill.showGlobalPopup) {
                                        await G.statusPopup.popState(`skill-${freshSkill.uuid}`);
                                    }
                                    Logger.error(`[Skills] Silent execution error`, {error: err as Error});
                                }
                            } else {
                                G.events.emit("skill:open-chat", {
                                    skillId: freshSkill.uuid,
                                    model: freshSkill.model,
                                    input: clipboardText,
                                });
                            }
                        },
                        {
                            id: `skill-${skill.uuid}`,
                            label: skill.label,
                            editable: true,
                        },
                    ),
                );
            }
        }

        return shortcuts;
    },
    cleanupEphemeral: (state: IGlobalState) => {
        const skills = state.skills as any as ISkillStore;
        if (!skills) return state;
        return {
            ...state,
            skills: {
                ...skills,
                activeSkillId: "",
                executingSkill: undefined,
            },
        };
    },
    init: () => {
        getSkillModule();

        G.events.on("system-agent:apply", (data: {contextType: string; payload: Record<string, any>}) => {
            if (data.contextType !== "skill-builder") return;

            const sm = getSkillModule();
            import("../../pro/chat/plugin.ts").then(({getChatModule}) => {
                const chatModule = getChatModule();
                const context = chatModule.state().systemAgentContext;
                let skillUuid = context?.payload?.skill?.uuid;

                // Fallback: if context is lost (e.g. after reload), try to find skill by label
                if (!skillUuid && data.payload.label) {
                    const match = sm.getSkills().find((s) => s.label === data.payload.label);
                    if (match) skillUuid = match.uuid;
                }

                if (!skillUuid) {
                    Logger.warn("[skills:apply] No skill UUID found — cannot apply proposal");
                    return;
                }

                const skill = sm.getSkillById(skillUuid);
                if (!skill) return;

                const updates: Partial<typeof skill> = {};
                if (data.payload.instruction !== undefined) updates.instruction = data.payload.instruction;
                if (data.payload.label !== undefined) updates.label = data.payload.label;
                if (data.payload.category !== undefined) updates.category = data.payload.category;

                const updatedSkill = {...skill, ...updates};
                sm.updateSkill(updatedSkill);

                // Deactivate system agent and clear chat after successful apply
                if (context) {
                    chatModule.deactivateSystemAgent();
                }
            });
        });
    },
};
