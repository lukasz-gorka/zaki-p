import {getRandomId} from "../../../utils/dataGenerator.ts";
import {AIModelTag} from "./AIModelConfig.ts";

export interface AIProviderModelInfo {
    id: string;
    name?: string;
    enabled: boolean;
    tags?: AIModelTag[];
    additionalData?: Record<string, any>;
}

export interface AIModelForUI extends AIProviderModelInfo {
    compositeId: string;
    providerId: string;
    providerName: string;
    providerUuid: string;
}

export interface AdditionalProviderData {
    id: string;
    name?: string;
    tags: string[];
    multiselect: boolean;
    targetModels?: string[];
    required?: boolean;
}

export interface AIProviderConfig {
    id: string;
    uuid: string;
    name: string;
    baseURL: string;
    apiKey: string;
    models: AIProviderModelInfo[];
    additionalData?: AdditionalProviderData[];
    toolIds?: string;
    isPredefined: boolean;
}

export interface ProviderTemplate {
    id: string;
    uuid: string;
    name: string;
    baseURL: string;
    apiKeyPlaceholder: string;
    description: string;
    requiresApiKey: boolean;
}

export const PROVIDER_TEMPLATES: Record<string, ProviderTemplate> = {
    openai: {
        id: "openai",
        uuid: getRandomId(),
        name: "OpenAI",
        baseURL: "https://api.openai.com/v1",
        apiKeyPlaceholder: "sk-proj-...",
        description: "OpenAI Whisper & Transcribe models",
        requiresApiKey: true,
    },
    custom: {
        id: "custom",
        uuid: getRandomId(),
        name: "Custom Provider",
        baseURL: "",
        apiKeyPlaceholder: "your-api-key",
        description: "Custom OpenAI-compatible API endpoint",
        requiresApiKey: true,
    },
    "custom-tools": {
        id: "custom-tools",
        uuid: getRandomId(),
        name: "Custom Provider (with Tools)",
        baseURL: "",
        apiKeyPlaceholder: "your-api-key",
        description: "OpenAI-compatible API with server-side tools (e.g. Open WebUI)",
        requiresApiKey: true,
    },
};
