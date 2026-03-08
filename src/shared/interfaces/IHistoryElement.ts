import {IChatMessage} from "./IChatMessage.ts";

export interface IHistoryElement {
    id: string;
    conversation: IChatMessage[];
    date: string;
    name: string;
    agentId: string;
    isFavorite?: boolean;
    tags?: string[];
    skillName?: string;
    modelUsed?: string;
    agentName?: string;
    agentAvatar?: string;
}
