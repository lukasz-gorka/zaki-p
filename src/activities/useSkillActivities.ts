import {useMemo} from "react";
import {useGlobalState} from "../hooks/useGlobalState.ts";
import type {ISkillStore} from "../skills/interfaces/ISkill.ts";
import type {Activity} from "./ActivityRegistry.ts";

export function useSkillActivities(): Activity[] {
    const [skills] = useGlobalState("skills");
    const store = skills as unknown as ISkillStore;
    const executing = store?.executingSkill;

    return useMemo(() => {
        if (!executing) return [];

        return [
            {
                id: `skill-${executing.skillId}`,
                label: executing.label,
                color: "amber" as const,
                startTime: executing.startTime,
                cancelable: false,
            },
        ];
    }, [executing]);
}
