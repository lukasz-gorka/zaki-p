export interface ChatCompletionRequest {
    model: string;
    messages: any[];
    temperature?: number;
    max_tokens?: number;
    tools?: any[];
    tool_ids?: string[];
    stream?: boolean;
    response_format?: {type: "json_object" | "text"};
    reasoning_effort?: string;
}

export interface ToolCall {
    id: string;
    type: "function";
    function: {name: string; arguments: string};
}

export interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        message: {
            role: string;
            content: string | null;
            tool_calls?: ToolCall[];
            tool_call_id?: string;
        };
        finish_reason: string | null;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    citations?: string[];
    search_results?: any;
}

export interface StreamChunk {
    content: string;
    tool_calls?: ToolCall[];
    citations?: string[];
    search_results?: any;
    usage?: {prompt_tokens: number; completion_tokens: number; total_tokens: number};
}

export interface AudioTranscriptionRequest {
    model: string;
    language?: string;
    prompt?: string;
}

export interface TextToSpeechRequest {
    model: string;
    text: string;
    voice: string;
    speed?: number;
}

export interface ProviderCredentials {
    api_key: string;
    base_url: string;
}
