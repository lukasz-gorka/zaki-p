import {store} from "../../appInitializer/store";
import {ROUTE_PATH} from "../../navigation/const/ROUTE_PATH.ts";
import type {ISkill} from "../../skills/interfaces/ISkill.ts";
import type {ICommandPanelItem} from "../interface/ICommandPanelItem.ts";

export function buildSkillItems(navigate: (path: string) => void, onClose: () => void): ICommandPanelItem[] {
    const skillState = store.getState().skills as {list: ISkill[]; activeSkillId: string} | undefined;
    if (!skillState?.list) return [];

    const skills = [...skillState.list].sort((a, b) => a.label.localeCompare(b.label));

    return skills.map((skill) => ({
        id: `skill-${skill.uuid}`,
        label: skill.label,
        description: skill.category,
        icon: skill.icon || "Zap",
        category: "Skills",
        keywords: [skill.label.toLowerCase(), skill.category?.toLowerCase(), "skill"].filter(Boolean) as string[],
        metadata: {
            preview: {
                type: "skill",
                data: skill,
            },
        },
        showInMainView: false,
        actions: [
            {
                id: "edit",
                label: "Edit skill",
                icon: "Pencil",
                onAction: async () => {
                    navigate(ROUTE_PATH.SKILLS);
                    setTimeout(() => window.dispatchEvent(new CustomEvent("skill:open-edit", {detail: skill.uuid})), 100);
                    onClose();
                },
            },
        ],
    }));
}
