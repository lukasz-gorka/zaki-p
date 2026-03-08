import {AdditionalProviderData} from "./AIProviderConfig.ts";

export type AIModelTag = "chat" | "vision" | "image-generation" | "speech-to-text" | "text-to-speech";

export interface AIModelConfig {
    id: string;
    name: string;
    visible: boolean;
    tags: AIModelTag[];
    contextLength?: number;
    baseURL: string;
    apiKey: string;
    providerId?: string;
    providerName?: string;
    additionalData?: AdditionalProviderData[];
}

export function detectModelTags(modelId: string): AIModelTag[] {
    const lowerModelId = modelId.toLowerCase();
    const tags: AIModelTag[] = [];

    const imagePatterns = ["dall-e", "dalle", "stable-diffusion", "sd-", "midjourney", "imagen", "firefly"];
    if (imagePatterns.some((pattern) => lowerModelId.includes(pattern))) {
        tags.push("image-generation");
        return tags;
    }

    const sttPatterns = ["whisper", "transcri"];
    if (sttPatterns.some((pattern) => lowerModelId.includes(pattern))) {
        tags.push("speech-to-text");
        return tags;
    }

    const ttsPatterns = ["tts-1", "tts"];
    if (ttsPatterns.some((pattern) => lowerModelId.includes(pattern))) {
        tags.push("text-to-speech");
        return tags;
    }

    const visionPatterns = ["vision", "gpt-4-turbo", "gpt-4o", "claude-3", "gemini-pro-vision", "gemini-1.5"];
    if (visionPatterns.some((pattern) => lowerModelId.includes(pattern))) {
        tags.push("chat", "vision");
        return tags;
    }

    tags.push("chat");
    return tags;
}
