export interface IAgent {
    id: string;
    name: string;
    description: string;
    avatar: string;
    mainPrompt: string;
    defaultModel: string;
    skills: string[];
    system?: boolean;
    contextType?: string;
    /** AI SDK tools available to this agent. Only works with AI SDK path (not Rust proxy). */
    getTools?: () => import("ai").ToolSet;
    /** Max tool calling iterations (AI SDK maxSteps). Default: no tool calling. */
    maxSteps?: number;
}

export function getAgentDefaultData(): IAgent {
    return {
        id: crypto.randomUUID(),
        name: "",
        description: "",
        avatar: "",
        mainPrompt: "",
        defaultModel: "",
        skills: [],
    };
}
