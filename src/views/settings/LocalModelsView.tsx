import {Download, HardDrive, Trash2} from "lucide-react";
import {useCallback, useEffect, useState} from "react";
import {G} from "../../appInitializer/module/G.ts";
import {Logger} from "../../logger/Logger.ts";
import type {LocalModelStatus} from "../../rustProxy/interface/LocalModelTypes.ts";
import {Badge} from "../ui/badge.tsx";
import {Button} from "../ui/button.tsx";
import {Card} from "../ui/card.tsx";
import {Label} from "../ui/label.tsx";
import {Progress} from "../ui/progress.tsx";
import {Spinner} from "../ui/spinner.tsx";

export function LocalModelsView() {
    const [models, setModels] = useState<LocalModelStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloadingModels, setDownloadingModels] = useState<Record<string, number>>({});
    const [deletingModels, setDeletingModels] = useState<Set<string>>(new Set());

    const fetchModels = useCallback(async () => {
        try {
            const result = await G.rustProxy.localModelsList();
            setModels(result);
        } catch (error) {
            Logger.error("[LocalModelsView] Failed to fetch models", {error});
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchModels();
    }, [fetchModels]);

    const downloadModel = async (modelId: string) => {
        setDownloadingModels((prev) => ({...prev, [modelId]: 0}));

        try {
            await G.rustProxy.localModelDownload(modelId, (progress) => {
                setDownloadingModels((prev) => ({...prev, [modelId]: progress}));
            });
            await fetchModels();
        } catch (error) {
            Logger.error("[LocalModelsView] Failed to download model", {error});
        } finally {
            setDownloadingModels((prev) => {
                const next = {...prev};
                delete next[modelId];
                return next;
            });
        }
    };

    const deleteModel = async (modelId: string) => {
        setDeletingModels((prev) => new Set(prev).add(modelId));

        try {
            await G.rustProxy.localModelDelete(modelId);
            await fetchModels();
        } catch (error) {
            Logger.error("[LocalModelsView] Failed to delete model", {error});
        } finally {
            setDeletingModels((prev) => {
                const next = new Set(prev);
                next.delete(modelId);
                return next;
            });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Spinner size="md" className="text-muted-foreground" />
            </div>
        );
    }

    const downloadedModels = models.filter((m) => m.downloaded);
    const availableModels = models.filter((m) => !m.downloaded);

    return (
        <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground">Download and use free speech-to-text models locally. No API key required. Models run entirely on your device.</p>

            {downloadedModels.length > 0 && (
                <div className="flex flex-col gap-3">
                    <Label className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4" />
                        Downloaded
                    </Label>
                    {downloadedModels.map((model) => (
                        <LocalModelCard
                            key={model.id}
                            model={model}
                            isDownloading={model.id in downloadingModels}
                            downloadProgress={downloadingModels[model.id]}
                            isDeleting={deletingModels.has(model.id)}
                            onDownload={downloadModel}
                            onDelete={deleteModel}
                        />
                    ))}
                </div>
            )}

            {availableModels.length > 0 && (
                <div className="flex flex-col gap-3">
                    <Label className="flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Available to Download
                    </Label>
                    {availableModels.map((model) => (
                        <LocalModelCard
                            key={model.id}
                            model={model}
                            isDownloading={model.id in downloadingModels}
                            downloadProgress={downloadingModels[model.id]}
                            isDeleting={deletingModels.has(model.id)}
                            onDownload={downloadModel}
                            onDelete={deleteModel}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

interface LocalModelCardProps {
    model: LocalModelStatus;
    isDownloading: boolean;
    downloadProgress?: number;
    isDeleting: boolean;
    onDownload: (modelId: string) => void;
    onDelete: (modelId: string) => void;
}

function RatingDots({value, max = 5, color}: {value: number; max?: number; color: "speed" | "accuracy"}) {
    const colorClass = color === "speed" ? "text-amber-500" : "text-emerald-500";
    const dimClass = "text-muted-foreground/30";

    return (
        <span className="flex items-center gap-0.5">
            {Array.from({length: max}, (_, i) => (
                <span key={i} className={`text-[8px] ${i < value ? colorClass : dimClass}`}>
                    ●
                </span>
            ))}
        </span>
    );
}

function LocalModelCard({model, isDownloading, downloadProgress, isDeleting, onDownload, onDelete}: LocalModelCardProps) {
    return (
        <Card className="p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{model.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                        {formatSize(model.size_mb)}
                    </Badge>
                    {model.downloaded && (
                        <Badge variant="outline" className="text-[10px] text-green-600 border-green-600/30">
                            Downloaded
                        </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                        {model.language_support === "multilingual" ? "Multilingual" : "English Only"}
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    {model.downloaded ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => onDelete(model.id)} disabled={isDeleting}>
                            {isDeleting ? <Spinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => onDownload(model.id)} disabled={isDownloading}>
                            {isDownloading ? <Spinner size="sm" /> : <Download className="w-4 h-4" />}
                            {isDownloading ? "Downloading..." : "Download"}
                        </Button>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    Speed <RatingDots value={model.speed_rating} color="speed" />
                </span>
                <span className="flex items-center gap-1.5">
                    Accuracy <RatingDots value={model.accuracy_rating} color="accuracy" />
                </span>
            </div>
            <p className="text-xs text-muted-foreground">{model.description}</p>
            {isDownloading && downloadProgress !== undefined && (
                <div className="flex items-center gap-3">
                    <Progress value={downloadProgress} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">{Math.round(downloadProgress)}%</span>
                </div>
            )}
        </Card>
    );
}

function formatSize(mb: number): string {
    if (mb >= 1000) {
        return `${(mb / 1000).toFixed(1)} GB`;
    }
    return `${mb} MB`;
}
