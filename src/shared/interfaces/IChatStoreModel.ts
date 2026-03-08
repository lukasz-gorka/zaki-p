import {IAgent} from "./IAgent.ts";
import {IChatMessage} from "./IChatMessage.ts";
import {IInputFile} from "./IInputFile.ts";

export interface IStreamingMessage {
    id: string;
    content: string;
}

export interface ISystemAgentContext {
    type: string;
    payload: Record<string, any>;
}

export interface IChatStoreModel {
    inputValue: string;
    model: string;
    defaultModel: string;
    conversationId: string;
    messages: IChatMessage[];
    isLoading: boolean;
    assistants: IAgent[];
    activeAssistantId: string;
    streamingMessage: IStreamingMessage | null;
    currentOperationId: string | null;
    enableStreaming: boolean;
    activeSkillId: string;
    inputFiles: IInputFile[];
    imageMode: boolean;
    selectedToolIds: string[];
    systemAgentContext: ISystemAgentContext | null;
    loadingStatus: string | null;
}

export const DEFAULT_CHAT_STATE: IChatStoreModel = {
    inputValue: "",
    model: "",
    defaultModel: "",
    conversationId: "",
    messages: [],
    isLoading: false,
    assistants: [],
    activeAssistantId: "",
    streamingMessage: null,
    currentOperationId: null,
    enableStreaming: true,
    activeSkillId: "",
    inputFiles: [],
    imageMode: false,
    selectedToolIds: [],
    systemAgentContext: null,
    loadingStatus: null,
};
