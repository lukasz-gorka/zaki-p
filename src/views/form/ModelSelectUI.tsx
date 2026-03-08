import {Bot} from "lucide-react";
import {useEffect, useMemo, useState} from "react";
import {getAIModelsWithProvider} from "../../integrations/ai/aiModels/aiModels.ts";
import {AIModelTag} from "../../integrations/ai/interface/AIModelConfig.ts";
import {AIModelForUI} from "../../integrations/ai/interface/AIProviderConfig.ts";
import {Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue} from "../ui/select.tsx";
import {FormLabelUI} from "./FormLabelUI.tsx";

interface ModelSelectUIProps {
    tag: AIModelTag | AIModelTag[];
    value: string;
    onValueChange: (compositeId: string) => void;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    extraItems?: AIModelForUI[];
    variant?: "default" | "compact";
    triggerClassName?: string;
}

export function ModelSelectUI({
    tag,
    value,
    onValueChange,
    label,
    placeholder = "Select model...",
    disabled,
    extraItems,
    variant = "default",
    triggerClassName,
}: Readonly<ModelSelectUIProps>) {
    const tags = useMemo(() => (Array.isArray(tag) ? tag : [tag]), [tag]);

    const grouped = useMemo(() => {
        const allModels = [...getAIModelsWithProvider().filter((m) => m.tags?.some((t) => tags.includes(t))), ...(extraItems ?? [])];

        const groups = new Map<string, {providerName: string; models: AIModelForUI[]}>();
        for (const model of allModels) {
            const key = model.providerId;
            if (!groups.has(key)) {
                groups.set(key, {providerName: model.providerName, models: []});
            }
            groups.get(key)!.models.push(model);
        }
        return groups;
    }, [tags, extraItems]);

    const allModelsFlat = useMemo(() => [...grouped.values()].flatMap((g) => g.models), [grouped]);
    const allEmpty = allModelsFlat.length === 0;
    const [open, setOpen] = useState(false);

    const handleOpenChange = (v: boolean) => {
        setOpen(v);
        if (!v) {
            setTimeout(() => window.dispatchEvent(new Event("focus-chat-input")), 150);
        }
    };

    useEffect(() => {
        const handler = () => setOpen(true);
        window.addEventListener("focus-model-selector", handler);
        return () => window.removeEventListener("focus-model-selector", handler);
    }, []);

    useEffect(() => {
        if (allEmpty) return;
        const isValid = value && allModelsFlat.some((m) => m.compositeId === value);
        if (!isValid) {
            onValueChange(allModelsFlat[0].compositeId);
        }
    }, [value, allModelsFlat, allEmpty, onValueChange]);

    const selectContent = (
        <SelectContent>
            {[...grouped.entries()].map(([providerId, {providerName, models}]) => (
                <SelectGroup key={providerId}>
                    <SelectLabel>{providerName}</SelectLabel>
                    {models.map((model) => (
                        <SelectItem key={model.compositeId} value={model.compositeId}>
                            {model.name || model.id}
                        </SelectItem>
                    ))}
                </SelectGroup>
            ))}
        </SelectContent>
    );

    if (variant === "compact") {
        const currentModel = allModelsFlat.find((m) => m.compositeId === value);
        const displayName = currentModel ? currentModel.name || currentModel.id : "Model";

        return (
            <Select open={open} onOpenChange={handleOpenChange} value={value} onValueChange={onValueChange} disabled={disabled || allEmpty}>
                <SelectTrigger className={triggerClassName ?? "h-7 px-2 text-xs gap-1.5 text-muted-foreground border-none shadow-none bg-transparent hover:bg-accent"}>
                    <Bot className="w-3 h-3" />
                    <span className="truncate max-w-[100px]">{displayName}</span>
                </SelectTrigger>
                {selectContent}
            </Select>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {label && <FormLabelUI>{label}</FormLabelUI>}
            {allEmpty && <p className="text-sm text-muted-foreground">No models available for this feature. Add a provider with compatible models in settings.</p>}
            <Select open={open} onOpenChange={handleOpenChange} value={value} onValueChange={onValueChange} disabled={disabled || allEmpty}>
                <SelectTrigger className={triggerClassName ?? "w-[300px]"}>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                {selectContent}
            </Select>
        </div>
    );
}
