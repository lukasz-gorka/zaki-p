export type IChatContentPart = {type: "text"; text: string} | {type: "image_url"; image_url: {url: string}};

export interface IGeneratedImage {
    base64: string;
    revisedPrompt?: string;
}

export interface IToolCall {
    id: string;
    type: "function";
    function: {name: string; arguments: string};
}

export interface IChatMessage {
    id?: string;
    content: string | IChatContentPart[];
    role: "user" | "assistant" | "system" | "tool";
    timestamp?: number;
    skillUsed?: {
        uuid: string;
        label: string;
        icon?: string;
    };
    originalContent?: string;
    source?: string;
    generatedImage?: IGeneratedImage;
    tool_calls?: IToolCall[];
    tool_call_id?: string;
    citations?: string[];
}

export function getMessageText(message: IChatMessage): string {
    if (typeof message.content === "string") return message.content;
    return message.content
        .filter((p) => p.type === "text")
        .map((p) => (p as {type: "text"; text: string}).text)
        .join("");
}
