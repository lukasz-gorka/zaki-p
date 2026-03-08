import {IChatMessage} from "./IChatMessage.ts";

export interface IHistoryElement {
    id: string;
    conversation: IChatMessage[];
    date: string;
    name: string;
    assistantId: string;
    isFavorite?: boolean;
    tags?: string[];
    skillName?: string;
    modelUsed?: string;
    agentName?: string;
    agentAvatar?: string;
}
