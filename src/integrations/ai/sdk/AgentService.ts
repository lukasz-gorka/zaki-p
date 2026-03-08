import {invoke} from "@tauri-apps/api/core";
import {generateText, type ModelMessage, stepCountIs, streamText, type ToolSet} from "ai";
import {store} from "../../../appInitializer/store";
import {Logger} from "../../../logger/Logger.ts";
import {getRandomId} from "../../../utils/dataGenerator.ts";
import {createCompositeModelId, parseModelId} from "../interface/AIModel.ts";
import {AIModelConfig} from "../interface/AIModelConfig.ts";
import {AIProviderConfig} from "../interface/AIProviderConfig.ts";
import {providersToModels} from "../ProvidersManager.ts";
import {needsRustProxy, resolveLanguageModel, resolveProviderCredentials} from "./providers.ts";

export interface CompletionOptions {
    messages: ModelMessage[];
    model: string; // composite model ID: "providerId::modelId"
    tools?: ToolSet;
    toolIds?: string[];
    maxSteps?: number;
    temperature?: number;
    maxTokens?: number;
    abortSignal?: AbortSignal;
}

export interface StreamCompletionOptions extends CompletionOptions {
    onFinish?: (result: {text: string; usage?: any}) => void;
}

export interface TranscriptionOptions {
    compositeModelId: string;
    language?: string;
    prompt?: string;
}

export interface TextToSpeechOptions {
    compositeModelId: string;
    text: string;
    voice: string;
    speed?: number;
}

export class AgentService {
    private getProviders(): AIProviderConfig[] {
        return store.getState().provider?.collection ?? [];
    }

    private getModels(): AIModelConfig[] {
        return providersToModels(this.getProviders());
    }

    async transcribeAudio(
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
                const {G} = await import("../../../appInitializer/module/G.ts");
                const arrayBuffer = await audioFile.arrayBuffer();
                const audioData = new Uint8Array(arrayBuffer);
                const language = options.language?.split("-")[0];

                const transcription = await G.rustProxy.localTranscribeAudio(audioData, options.model, language);
                return {text: transcription, operationId: opId};
            } catch (error) {
                Logger.error("[AgentService] Local audio transcription failed", {error});
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

        const compositeModelId = createCompositeModelId(modelConfig.providerId, modelConfig.id);

        try {
            const {text} = await this.transcribe(audioFile, {
                compositeModelId,
                language: options.language.split("-")[0],
                prompt: options.prompt,
            });

            return {text, operationId: opId};
        } catch (error) {
            Logger.error("[AgentService] Audio transcription failed", {error});
            throw new Error(`Audio transcription failed: ${error}`);
        }
    }

    async completion(options: CompletionOptions) {
        const {messages, model, tools, maxSteps, temperature, maxTokens, abortSignal} = options;

        if (needsRustProxy(model)) {
            return this.rawCompletion(options);
        }

        const languageModel = resolveLanguageModel(model);

        try {
            return await generateText({
                model: languageModel,
                messages,
                tools,
                stopWhen: maxSteps ? stepCountIs(maxSteps) : undefined,
                temperature,
                maxOutputTokens: maxTokens,
                abortSignal,
            });
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            const cause = error instanceof Error ? (error as any).cause : undefined;
            const responseBody = error instanceof Error ? (error as any).responseBody : undefined;
            Logger.error("[AgentService] completion failed", {error: errMsg, data: {model, cause, responseBody}});
            throw error;
        }
    }

    private async rawCompletion(options: CompletionOptions) {
        const {messages, model, toolIds, temperature, maxTokens} = options;
        const parsed = parseModelId(model);
        if (!parsed) throw new Error(`Invalid model ID: ${model}`);

        const {apiKey, baseURL} = resolveProviderCredentials(model);
        const url = `${baseURL.replace(/\/+$/, "")}/chat/completions`;

        const openaiMessages = (messages as any[])
            .filter((m) => m.role !== "tool")
            .map((m) => {
                const msg: any = {role: m.role, content: this.convertContentToOpenAI(m.content)};
                return msg;
            });

        const body: any = {
            model: parsed.modelId,
            messages: openaiMessages,
            stream: false,
        };
        if (toolIds?.length) body.tool_ids = toolIds;
        if (temperature !== undefined) body.temperature = temperature;
        if (maxTokens !== undefined) body.max_tokens = maxTokens;

        try {
            const data = await invoke<any>("proxy_chat_completion", {url, apiKey, body});
            const choice = data.choices?.[0];

            return {
                text: choice?.message?.content || "",
                toolCalls: choice?.message?.tool_calls || [],
                finishReason: choice?.finish_reason || "stop",
                usage: {
                    inputTokens: data.usage?.prompt_tokens ?? 0,
                    outputTokens: data.usage?.completion_tokens ?? 0,
                },
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            Logger.error("[AgentService] rawCompletion failed", {error: errMsg, data: {model}});
            throw error;
        }
    }

    private convertContentToOpenAI(content: any): any {
        if (typeof content === "string") return content;
        if (!Array.isArray(content)) return content;
        return content.map((part: any) => {
            if (part.type === "image" && part.image) {
                const mediaType = part.mediaType || "image/png";
                const data = typeof part.image === "string" ? part.image : "";
                return {type: "image_url", image_url: {url: `data:${mediaType};base64,${data}`}};
            }
            return part;
        });
    }

    public streamCompletion(options: StreamCompletionOptions) {
        const {messages, model, tools, maxSteps, temperature, maxTokens, abortSignal, onFinish} = options;

        const languageModel = resolveLanguageModel(model);

        try {
            return streamText({
                model: languageModel,
                messages,
                tools,
                stopWhen: maxSteps ? stepCountIs(maxSteps) : undefined,
                temperature,
                maxOutputTokens: maxTokens,
                abortSignal,
                onFinish: onFinish
                    ? (event) => {
                          onFinish({text: event.text, usage: event.usage});
                      }
                    : undefined,
            });
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            const cause = error instanceof Error ? (error as any).cause : undefined;
            const responseBody = error instanceof Error ? (error as any).responseBody : undefined;
            Logger.error("[AgentService] streamCompletion failed", {error: errMsg, data: {model, cause, responseBody}});
            throw error;
        }
    }

    async transcribe(audioData: Blob | File, options: TranscriptionOptions): Promise<{text: string}> {
        const {compositeModelId, language, prompt} = options;
        const parsed = parseModelId(compositeModelId);
        if (!parsed) throw new Error(`Invalid model ID: ${compositeModelId}`);

        const {apiKey, baseURL} = resolveProviderCredentials(compositeModelId);
        const audioFormat = audioData.type?.includes("flac") ? "flac" : "wav";
        const url = `${baseURL.replace(/\/+$/, "")}/audio/transcriptions`;

        try {
            const arrayBuffer = await audioData.arrayBuffer();
            const audioBytes = Array.from(new Uint8Array(arrayBuffer));

            const data = await invoke<{text?: string}>("proxy_transcription", {
                url,
                apiKey,
                audioData: audioBytes,
                audioFormat,
                model: parsed.modelId,
                language: language || null,
                prompt: prompt || null,
            });

            return {text: data.text || ""};
        } catch (error) {
            Logger.error("[AgentService] transcribe failed", {error});
            throw error;
        }
    }

    async textToSpeech(options: TextToSpeechOptions): Promise<Uint8Array> {
        const {compositeModelId, text, voice, speed} = options;
        const parsed = parseModelId(compositeModelId);
        if (!parsed) throw new Error(`Invalid model ID: ${compositeModelId}`);

        const {apiKey, baseURL} = resolveProviderCredentials(compositeModelId);
        const url = `${baseURL.replace(/\/+$/, "")}/audio/speech`;

        try {
            const result = await invoke<number[]>("proxy_text_to_speech", {
                url,
                apiKey,
                model: parsed.modelId,
                text,
                voice,
                speed: speed ?? null,
            });

            return new Uint8Array(result);
        } catch (error) {
            Logger.error("[AgentService] textToSpeech failed", {error});
            throw error;
        }
    }

    async generateImage(options: {
        compositeModelId: string;
        prompt: string;
        size?: string;
        quality?: string;
        style?: string;
    }): Promise<{b64_json?: string; url?: string; revised_prompt?: string}> {
        const {compositeModelId, prompt, size, quality, style} = options;
        const parsed = parseModelId(compositeModelId);
        if (!parsed) throw new Error(`Invalid model ID: ${compositeModelId}`);

        const {apiKey, baseURL} = resolveProviderCredentials(compositeModelId);
        const url = `${baseURL.replace(/\/+$/, "")}/images/generations`;

        try {
            const body = {
                model: parsed.modelId,
                prompt,
                n: 1,
                response_format: "b64_json",
                size: size || "1024x1024",
                quality,
                style,
            };

            const data = await invoke<{data?: Array<{b64_json?: string; url?: string; revised_prompt?: string}>}>("proxy_image_generation", {
                url,
                apiKey,
                body,
            });

            const image = data.data?.[0];
            return {
                b64_json: image?.b64_json,
                url: image?.url,
                revised_prompt: image?.revised_prompt,
            };
        } catch (error) {
            Logger.error("[AgentService] generateImage failed", {error});
            throw error;
        }
    }
}
