import {ChevronDown, Download, Plus, Search, Trash2, X} from "lucide-react";
import {useState} from "react";
import {AIModelTag, detectModelTags} from "../../integrations/ai/interface/AIModelConfig.ts";
import {AIProviderConfig, AIProviderModelInfo, PROVIDER_TEMPLATES} from "../../integrations/ai/interface/AIProviderConfig.ts";
import {Logger} from "../../logger/Logger.ts";
import {FormInputUI} from "../form/FormInputUI.tsx";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "../ui/alert-dialog.tsx";
import {Badge} from "../ui/badge.tsx";
import {Button} from "../ui/button.tsx";
import {Card} from "../ui/card.tsx";
import {Input} from "../ui/input.tsx";
import {Label} from "../ui/label.tsx";
import {Separator} from "../ui/separator.tsx";
import {ToolsEditor} from "./ToolsEditor.tsx";

interface ProviderCardProps {
    provider: AIProviderConfig;
    update: (provider: Partial<AIProviderConfig>) => void;
    remove: (provider: AIProviderConfig) => void;
}

type ModelSortFilter = "all" | "stt" | "tts" | "text" | "image";
type ManualModelType = "chat" | "speech-to-text" | "text-to-speech" | "image-generation";

const MANUAL_MODEL_TYPES: {value: ManualModelType; label: string}[] = [
    {value: "chat", label: "Text"},
    {value: "speech-to-text", label: "STT"},
    {value: "text-to-speech", label: "TTS"},
    {value: "image-generation", label: "Image"},
];

export function ProviderCard({provider, update, remove}: ProviderCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [manualModelId, setManualModelId] = useState("");
    const [manualModelType, setManualModelType] = useState<ManualModelType>("chat");
    const [fetchedModels, setFetchedModels] = useState<{id: string; name?: string}[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [modelSearch, setModelSearch] = useState("");
    const [modelSort, setModelSort] = useState<ModelSortFilter>("all");

    const template = PROVIDER_TEMPLATES[provider.id] || PROVIDER_TEMPLATES.custom;
    const isCustom = !provider.isPredefined;
    const activeModels = provider.models.filter((m) => m.enabled);
    const activeModelsCount = activeModels.length;

    const updateField = (field: keyof AIProviderConfig, value: any) => {
        update({uuid: provider.uuid, [field]: value});
    };

    const ALL_TAGS: AIModelTag[] = ["chat", "vision", "image-generation", "speech-to-text", "text-to-speech"];

    const resolveModelTags = (modelId: string, typeOverride?: ManualModelType): AIModelTag[] => {
        if (!typeOverride) return detectModelTags(modelId);
        if (typeOverride === "chat") return ["chat"];
        return [typeOverride];
    };

    const toggleModelTag = (modelId: string, tag: AIModelTag) => {
        const updated = provider.models.map((m) => {
            if (m.id !== modelId) return m;
            const currentTags = m.tags || [];
            const hasTag = currentTags.includes(tag);
            const newTags = hasTag ? currentTags.filter((t) => t !== tag) : [...currentTags, tag];
            return {...m, tags: newTags};
        });
        update({uuid: provider.uuid, models: updated});
    };

    const addModel = (modelId: string, typeOverride?: ManualModelType) => {
        const trimmed = modelId.trim();
        if (!trimmed) return;
        if (provider.models.some((m) => m.id === trimmed && m.enabled)) {
            // Already exists and active — re-enable if disabled
            const updated = provider.models.map((m) => (m.id === trimmed ? {...m, enabled: true} : m));
            update({uuid: provider.uuid, models: updated});
            return;
        }
        if (provider.models.some((m) => m.id === trimmed)) {
            // Exists but disabled — enable it and update tags
            const updated = provider.models.map((m) => (m.id === trimmed ? {...m, enabled: true, tags: resolveModelTags(trimmed, typeOverride)} : m));
            update({uuid: provider.uuid, models: updated});
            return;
        }

        const newModel: AIProviderModelInfo = {
            id: trimmed,
            name: trimmed,
            enabled: true,
            tags: resolveModelTags(trimmed, typeOverride),
        };
        update({uuid: provider.uuid, models: [...provider.models, newModel]});
    };

    const removeModel = (modelId: string) => {
        update({uuid: provider.uuid, models: provider.models.map((m) => (m.id === modelId ? {...m, enabled: false} : m))});
    };

    const fetchModels = async () => {
        if (!provider.apiKey || !provider.baseURL) {
            setFetchError("Provide API key and base URL first");
            return;
        }

        setIsFetching(true);
        setFetchError(null);

        try {
            const {fetchModelsFromProvider} = await import("../../integrations/ai/sdk/providers.ts");
            const models = await fetchModelsFromProvider(provider.apiKey, provider.baseURL);
            setFetchedModels(models.map((m) => ({id: m.id, name: m.id})));
        } catch (error) {
            Logger.error("Failed to fetch models", {error});
            setFetchError(String(error));
        } finally {
            setIsFetching(false);
        }
    };

    const filterFetchedModels = () => {
        let filtered = fetchedModels.filter((m) => !provider.models.some((existing) => existing.id === m.id && existing.enabled));

        if (modelSearch.trim()) {
            const search = modelSearch.toLowerCase();
            filtered = filtered.filter((m) => m.id.toLowerCase().includes(search));
        }

        if (modelSort === "stt") {
            filtered = filtered.filter((m) => {
                const tags = detectModelTags(m.id);
                return tags.includes("speech-to-text");
            });
        } else if (modelSort === "tts") {
            filtered = filtered.filter((m) => {
                const tags = detectModelTags(m.id);
                return tags.includes("text-to-speech");
            });
        } else if (modelSort === "text") {
            filtered = filtered.filter((m) => {
                const tags = detectModelTags(m.id);
                return tags.includes("chat") || tags.includes("vision") || tags.length === 0;
            });
        } else if (modelSort === "image") {
            filtered = filtered.filter((m) => {
                const tags = detectModelTags(m.id);
                return tags.includes("image-generation");
            });
        }

        return filtered;
    };

    return (
        <Card className="rounded-xl overflow-hidden">
            {/* Header - always visible */}
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setIsOpen(!isOpen)} role="presentation">
                <div className="flex items-center gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{provider.name}</span>
                            <Badge variant="outline" className="text-[10px]">
                                {provider.id.startsWith("custom-tools") ? "Custom + Tools" : isCustom ? "Custom" : "OpenAI"}
                            </Badge>
                        </div>
                        {activeModelsCount > 0 && (
                            <span className="text-xs text-muted-foreground">
                                {activeModelsCount} model{activeModelsCount !== 1 ? "s" : ""}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={(e) => e.stopPropagation()}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete provider</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete &quot;{provider.name}&quot;? This will remove the provider and its API key.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => remove(provider)}>
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
            </div>

            {/* Expanded content */}
            {isOpen && (
                <div className="px-4 pb-4 flex flex-col gap-6">
                    <Separator />

                    {/* Provider config fields */}
                    {isCustom && (
                        <>
                            <FormInputUI label="Provider Name" value={provider.name} onChange={(v) => updateField("name", v)} type="text" />
                            <FormInputUI
                                label="Base URL"
                                value={provider.baseURL}
                                onChange={(v) => updateField("baseURL", v)}
                                type="text"
                                placeholder="https://api.example.com/v1"
                            />
                        </>
                    )}

                    <FormInputUI
                        isSecret={true}
                        visibleChars={5}
                        label="API Key"
                        value={provider.apiKey}
                        onChange={(v) => updateField("apiKey", v)}
                        type="text"
                        placeholder={template.apiKeyPlaceholder}
                    />

                    <Separator />

                    {/* Models list */}
                    <div className="flex flex-col gap-3">
                        <Label>Models</Label>

                        {activeModels.length > 0 && (
                            <div className="flex flex-col gap-1">
                                {activeModels.map((model) => {
                                    const tags = model.tags || [];
                                    return (
                                        <div key={model.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-accent/50 group">
                                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                <span className="text-sm truncate max-w-[200px]">{model.name || model.id}</span>
                                                {ALL_TAGS.map((tag) => {
                                                    const active = tags.includes(tag);
                                                    return (
                                                        <Badge
                                                            key={tag}
                                                            variant={active ? "secondary" : "outline"}
                                                            className={`text-[10px] cursor-pointer select-none ${active ? "" : "opacity-30 hover:opacity-60"}`}
                                                            onClick={() => toggleModelTag(model.id, tag)}
                                                        >
                                                            {tag}
                                                        </Badge>
                                                    );
                                                })}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                                                onClick={() => removeModel(model.id)}
                                            >
                                                <X className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {!showModelPicker ? (
                            <Button variant="outline" size="sm" className="w-fit gap-2" onClick={() => setShowModelPicker(true)}>
                                <Plus className="w-4 h-4" />
                                Add Model
                            </Button>
                        ) : (
                            <Card className="p-4 flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <Label>Add Model</Label>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => {
                                            setShowModelPicker(false);
                                            setFetchedModels([]);
                                            setModelSearch("");
                                            setFetchError(null);
                                        }}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Manual add */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Model ID (e.g. gpt-4o, whisper-1)"
                                            value={manualModelId}
                                            onChange={(e) => setManualModelId(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    addModel(manualModelId, manualModelType);
                                                    setManualModelId("");
                                                }
                                            }}
                                            className="h-9 flex-1"
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={!manualModelId.trim()}
                                            onClick={() => {
                                                addModel(manualModelId, manualModelType);
                                                setManualModelId("");
                                            }}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <div className="flex gap-1">
                                        {MANUAL_MODEL_TYPES.map((t) => (
                                            <Button
                                                key={t.value}
                                                variant={manualModelType === t.value ? "default" : "ghost"}
                                                size="sm"
                                                className="h-7 text-xs px-2.5"
                                                onClick={() => setManualModelType(t.value)}
                                            >
                                                {t.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <Separator />

                                {/* Fetch from API */}
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" className="gap-2" onClick={fetchModels} disabled={isFetching || !provider.apiKey || !provider.baseURL}>
                                        <Download className="w-4 h-4" />
                                        {isFetching ? "Fetching..." : "Fetch from API"}
                                    </Button>
                                    {fetchError && <span className="text-xs text-destructive">{fetchError}</span>}
                                </div>

                                {fetchedModels.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                                <Input placeholder="Search..." value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} className="h-8 pl-8 text-sm" />
                                            </div>
                                            <div className="flex gap-1">
                                                {(["all", "stt", "tts", "text", "image"] as ModelSortFilter[]).map((filter) => (
                                                    <Button
                                                        key={filter}
                                                        variant={modelSort === filter ? "default" : "ghost"}
                                                        size="sm"
                                                        className="h-8 text-xs px-2.5"
                                                        onClick={() => setModelSort(filter)}
                                                    >
                                                        {filter === "stt"
                                                            ? "STT"
                                                            : filter === "tts"
                                                              ? "TTS"
                                                              : filter === "image"
                                                                ? "Image"
                                                                : filter.charAt(0).toUpperCase() + filter.slice(1)}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
                                            {filterFetchedModels().map((model) => (
                                                <div
                                                    key={model.id}
                                                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-accent/50 cursor-pointer text-sm"
                                                    onClick={() => addModel(model.id)}
                                                    role="presentation"
                                                >
                                                    <span>{model.id}</span>
                                                    <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                                                </div>
                                            ))}
                                            {filterFetchedModels().length === 0 && <span className="text-xs text-muted-foreground py-2 text-center">No models found</span>}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        )}
                    </div>

                    {/* Tools — only for custom-tools providers */}
                    {provider.id.startsWith("custom-tools") && (
                        <>
                            <ToolsEditor toolIds={provider.toolIds || ""} onChange={(toolIds) => update({uuid: provider.uuid, toolIds})} />
                            <Separator />
                        </>
                    )}
                </div>
            )}
        </Card>
    );
}
