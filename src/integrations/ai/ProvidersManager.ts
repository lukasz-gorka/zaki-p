import {getRandomId} from "../../utils/dataGenerator.ts";
import {AIModelConfig, detectModelTags} from "./interface/AIModelConfig.ts";
import {AIProviderConfig, PROVIDER_TEMPLATES, ProviderTemplate} from "./interface/AIProviderConfig.ts";

export function providersToModels(providers: AIProviderConfig[]): AIModelConfig[] {
    const models: AIModelConfig[] = [];

    for (const provider of providers) {
        for (const model of provider.models) {
            if (model.enabled) {
                const tags = model.tags || detectModelTags(model.id);

                models.push({
                    id: model.id,
                    name: model.name || model.id,
                    visible: true,
                    tags,
                    baseURL: provider.baseURL,
                    apiKey: provider.apiKey,
                    providerId: provider.id,
                    providerName: provider.name,
                    contextLength: undefined,
                    additionalData: provider.additionalData,
                });
            }
        }
    }

    return models;
}

export function createProviderFromTemplate(templateId: string, apiKey: string = ""): AIProviderConfig {
    const template = PROVIDER_TEMPLATES[templateId];
    if (!template) {
        throw new Error(`Unknown provider template: ${templateId}`);
    }

    const isCustom = templateId === "custom" || templateId === "custom-tools";

    return {
        id: isCustom ? `${templateId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : template.id,
        uuid: getRandomId(),
        name: template.name,
        baseURL: template.baseURL,
        apiKey: apiKey || (template.requiresApiKey ? "" : "not-required"),
        models: [],
        isPredefined: !isCustom,
    };
}

export function getProviderTemplates(): ProviderTemplate[] {
    return Object.values(PROVIDER_TEMPLATES);
}
