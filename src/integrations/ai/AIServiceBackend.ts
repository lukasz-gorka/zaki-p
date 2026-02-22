import {G} from "../../appInitializer/module/G.ts";
import {store} from "../../appInitializer/store";
import {Logger} from "../../logger/Logger.ts";
import {ProviderCredentials} from "../../rustProxy/interface/AITypes.ts";
import {getRandomId} from "../../utils/dataGenerator.ts";
import {createCompositeModelId, parseModelId} from "./interface/AIModel.ts";
import {AIModelConfig} from "./interface/AIModelConfig.ts";
import {AIProviderConfig} from "./interface/AIProviderConfig.ts";
import {providersToModels} from "./ProvidersManager.ts";

export class AIServiceBackend {
    private getProviders(): AIProviderConfig[] {
        return store.getState().provider?.collection ?? [];
    }

    private getModels(): AIModelConfig[] {
        return providersToModels(this.getProviders());
    }

    private findModelConfig(compositeOrSimpleId: string): AIModelConfig | undefined {
        const models = this.getModels();
        const parsed = parseModelId(compositeOrSimpleId);

        if (parsed) {
            return models.find((m) => m.id === parsed.modelId && m.providerId === parsed.providerId);
        }

        return models.find((m) => m.id === compositeOrSimpleId);
    }

    private getCredentialsForModel(modelConfig: AIModelConfig): ProviderCredentials {
        const providers = this.getProviders();
        const provider = providers.find((p) => p.id === modelConfig.providerId);

        if (!provider) {
            throw new Error(`Provider not found for model: ${modelConfig.id}`);
        }

        return {
            api_key: provider.apiKey,
            base_url: provider.baseURL || "https://api.openai.com/v1",
        };
    }

    private resolveModel(model: string): {compositeModelId: string; credentials: ProviderCredentials} {
        const modelConfig = this.findModelConfig(model);
        if (!modelConfig) {
            throw new Error(`Model not found: ${model}`);
        }

        if (!modelConfig.providerId) {
            throw new Error(`Model configuration error: Provider ID missing for model ${modelConfig.id}. Please refresh your provider settings.`);
        }

        return {
            compositeModelId: createCompositeModelId(modelConfig.providerId, modelConfig.id),
            credentials: this.getCredentialsForModel(modelConfig),
        };
    }

    private formatMessages(messages: any[]): any[] {
        return messages.map((msg) => {
            let content;

            if (msg.content === null || msg.content === undefined) {
                content = "";
            } else if (typeof msg.content === "string") {
                content = msg.content;
            } else if (Array.isArray(msg.content)) {
                content = msg.content;
            } else {
                content = String(msg.content);
            }

            return {
                role: msg.role,
                content,
                name: msg.name,
                tool_call_id: msg.tool_call_id,
                tool_calls: msg.tool_calls,
            };
        });
    }

    private buildRequest(
        compositeModelId: string,
        formattedMessages: any[],
        options: {
            stream?: boolean;
            tools?: any[];
            toolIds?: string[];
            responseFormat?: {type: "json_object" | "text"};
            reasoningEffort?: string;
            additionalData?: Record<string, any>;
        },
    ): any {
        const {stream, tools, toolIds, responseFormat, reasoningEffort, additionalData} = options;
        return {
            model: compositeModelId,
            messages: formattedMessages,
            temperature: undefined,
            max_tokens: undefined,
            tools: tools,
            tool_ids: toolIds,
            stream: stream ? true : undefined,
            response_format: responseFormat ? {type: responseFormat.type} : undefined,
            reasoning_effort: reasoningEffort,
            ...additionalData,
        };
    }

    public async completion({
        messages,
        stream = false,
        model,
        tools,
        toolIds,
        responseFormat,
        reasoningEffort,
        additionalData,
        operationId,
    }: {
        messages: any[];
        stream?: boolean;
        model: string;
        tools?: any[];
        toolIds?: string[];
        responseFormat?: {type: "json_object" | "text"};
        reasoningEffort?: string;
        additionalData?: Record<string, any>;
        operationId?: string;
    }): Promise<any> {
        const {compositeModelId, credentials} = this.resolveModel(model);
        const formattedMessages = this.formatMessages(messages);
        const request = this.buildRequest(compositeModelId, formattedMessages, {stream, tools, toolIds, responseFormat, reasoningEffort, additionalData});

        try {
            const opId = operationId || getRandomId();
            const response = await G.rustProxy.chatCompletion(request, opId, credentials);
            return response;
        } catch (error) {
            Logger.error("AI Request failed", {
                console: true,
                error,
                data: {
                    model,
                    baseURL: credentials.base_url,
                    errorMessage: error instanceof Error ? error.message : String(error),
                },
            });

            throw new Error(`AI completion failed: ${error}`);
        }
    }

    public async transcribeAudio(
        audioFile: File | Blob,
        options: {
            providerId: string;
            model: string;
            language: string;
            prompt: string;
        },
        operationId?: string,
    ): Promise<{text: string; operationId: string}> {
        const opId = operationId || getRandomId();

        if (options.providerId === "local") {
            try {
                const arrayBuffer = await audioFile.arrayBuffer();
                const audioData = new Uint8Array(arrayBuffer);
                const language = options.language?.split("-")[0];

                const transcription = await G.rustProxy.localTranscribeAudio(opId, audioData, options.model, language);
                return {
                    text: transcription,
                    operationId: opId,
                };
            } catch (error) {
                Logger.error("[AIServiceBackend] Local audio transcription failed", {error});
                throw new Error(`Local audio transcription failed: ${error}`);
            }
        }

        const providerId = options.providerId.toLowerCase();
        const models = this.getModels();

        const modelConfig = models.find((model) => model.visible && model.id === options.model && model.providerId?.toLowerCase() === providerId);

        if (!modelConfig) {
            throw new Error(`Audio transcription model not found: ${options.model} for provider ${options.providerId}`);
        }

        if (!modelConfig.providerId) {
            throw new Error(`Model configuration error: Provider ID missing for model ${modelConfig.id}. Please refresh your provider settings.`);
        }

        const credentials = this.getCredentialsForModel(modelConfig);
        const compositeModelId = createCompositeModelId(modelConfig.providerId, modelConfig.id);

        try {
            const arrayBuffer = await audioFile.arrayBuffer();
            const audioData = new Uint8Array(arrayBuffer);

            const audioFormat = audioFile.type?.startsWith("audio/") ? audioFile.type.split("/")[1] : undefined;

            const transcription = await G.rustProxy.transcribeAudio(
                opId,
                audioData,
                {
                    model: compositeModelId,
                    language: options.language.split("-")[0],
                    prompt: options.prompt,
                },
                credentials,
                audioFormat,
            );

            return {
                text: transcription,
                operationId: opId,
            };
        } catch (error) {
            Logger.error("[AIServiceBackend] Audio transcription failed", {error});
            throw new Error(`Audio transcription failed: ${error}`);
        }
    }
}
