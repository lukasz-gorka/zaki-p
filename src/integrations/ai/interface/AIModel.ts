export type AIModel = string;

const MODEL_PROVIDER_SEPARATOR = "::";

interface ParsedModelId {
    providerId: string;
    modelId: string;
}

export function parseModelId(compositeId: string): ParsedModelId | null {
    if (!compositeId || !compositeId.includes(MODEL_PROVIDER_SEPARATOR)) {
        return null;
    }
    const [providerId, ...rest] = compositeId.split(MODEL_PROVIDER_SEPARATOR);
    const modelId = rest.join(MODEL_PROVIDER_SEPARATOR);
    return {providerId, modelId};
}

export function createCompositeModelId(providerId: string, modelId: string): string {
    return `${providerId}${MODEL_PROVIDER_SEPARATOR}${modelId}`;
}
