import {tool, type ToolSet} from "ai";
import {z} from "zod";
import {ISkill} from "../../../skills/interfaces/ISkill.ts";
import {resolveTextVariables} from "../../../variables/textVariables.ts";
import {agentService} from "./index.ts";

export const skillToTool = (skill: ISkill) => {
    return tool({
        description: `${skill.label}: ${skill.instruction.slice(0, 200)}`,
        inputSchema: z.object({
            message: z.string().describe("User message/input for the skill"),
            clipboard: z.string().optional().describe("Optional clipboard content"),
        }),
        execute: async ({message, clipboard}: {message: string; clipboard?: string}) => {
            if (!skill.model) {
                return {error: "No model configured"};
            }

            const resolvedInstruction = resolveTextVariables(skill.instruction, {
                message,
                clipboard,
            });

            const response = await agentService.completion({
                model: skill.model,
                messages: [
                    {role: "system", content: resolvedInstruction},
                    {role: "user", content: message},
                ],
            });

            return {result: response.text};
        },
    });
};

export const skillsToTools = (skills: ISkill[]): ToolSet => {
    const filtered = skills.filter((skill) => skill.model && skill.instruction);

    return filtered.reduce<ToolSet>((acc, skill) => {
        const key = `skill_${skill.uuid.replace(/-/g, "_")}`;
        acc[key] = skillToTool(skill);
        return acc;
    }, {});
};
