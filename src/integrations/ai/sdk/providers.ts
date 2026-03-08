import {createOpenAI} from "@ai-sdk/openai";
import {createOpenAICompatible} from "@ai-sdk/openai-compatible";
import type {LanguageModel} from "ai";
import {store} from "../../../appInitializer/store";
import {Logger} from "../../../logger/Logger.ts";
import {parseModelId} from "../interface/AIModel.ts";
import type {AIProviderConfig} from "../interface/AIProviderConfig.ts";

function createProviderInstance(config: AIProviderConfig) {
    const baseURL = config.baseURL || "https://api.openai.com/v1";

    if (config.id === "openai") {
        return createOpenAI({apiKey: config.apiKey, baseURL});
    }

    return createOpenAICompatible({
        name: config.id,
        apiKey: config.apiKey,
        baseURL,
    });
}

export function needsRustProxy(compositeModelId: string): boolean {
    const parsed = parseModelId(compositeModelId);
    if (!parsed) return false;
    const providers = store.getState().provider?.collection ?? [];
    const provider = providers.find((p) => p.uuid === parsed.providerId || p.id === parsed.providerId);
    if (!provider) return false;
    return provider.id.startsWith("custom-tools");
}

export function resolveLanguageModel(compositeModelId: string): LanguageModel {
    const parsed = parseModelId(compositeModelId);
    if (!parsed) {
        throw new Error(`Invalid composite model ID: ${compositeModelId}`);
    }

    const providers = store.getState().provider?.collection ?? [];
    const provider = providers.find((p) => p.uuid === parsed.providerId || p.id === parsed.providerId);

    if (!provider) {
        throw new Error(`Provider not found: ${parsed.providerId}`);
    }

    if (!provider.apiKey) {
        throw new Error(`No API key configured for provider: ${provider.name}`);
    }

    const sdkProvider = createProviderInstance(provider);
    return sdkProvider.languageModel(parsed.modelId);
}

export function resolveProviderCredentials(compositeModelId: string): {apiKey: string; baseURL: string} {
    const parsed = parseModelId(compositeModelId);
    if (!parsed) {
        throw new Error(`Invalid composite model ID: ${compositeModelId}`);
    }

    const providers = store.getState().provider?.collection ?? [];
    const provider = providers.find((p) => p.uuid === parsed.providerId || p.id === parsed.providerId);

    if (!provider) {
        throw new Error(`Provider not found: ${parsed.providerId}`);
    }

    return {
        apiKey: provider.apiKey,
        baseURL: provider.baseURL || "https://api.openai.com/v1",
    };
}

export async function fetchModelsFromProvider(apiKey: string, baseURL: string): Promise<{id: string; object: string; owned_by?: string}[]> {
    const url = `${baseURL.replace(/\/+$/, "")}/models`;

    try {
        const response = await fetch(url, {
            headers: {Authorization: `Bearer ${apiKey}`},
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        Logger.error("[providers] fetchModelsFromProvider failed", {error});
        throw error;
    }
}
