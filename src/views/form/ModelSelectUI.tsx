import {useMemo} from "react";
import {getAIModelsWithProvider} from "../../integrations/ai/aiModels/aiModels.ts";
import {AIModelTag} from "../../integrations/ai/interface/AIModelConfig.ts";
import {AIModelForUI} from "../../integrations/ai/interface/AIProviderConfig.ts";
import {Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue} from "../ui/select.tsx";
import {FormLabelUI} from "./FormLabelUI.tsx";

interface ModelSelectUIProps {
    tag: AIModelTag;
    value: string;
    onValueChange: (compositeId: string) => void;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    extraItems?: AIModelForUI[];
}

export function ModelSelectUI({tag, value, onValueChange, label, placeholder = "Select model...", disabled, extraItems}: Readonly<ModelSelectUIProps>) {
    const grouped = useMemo(() => {
        const allModels = [...getAIModelsWithProvider().filter((m) => m.tags?.includes(tag)), ...(extraItems ?? [])];

        const groups = new Map<string, {providerName: string; models: AIModelForUI[]}>();
        for (const model of allModels) {
            const key = model.providerId;
            if (!groups.has(key)) {
                groups.set(key, {providerName: model.providerName, models: []});
            }
            groups.get(key)!.models.push(model);
        }
        return groups;
    }, [tag, extraItems]);

    const allEmpty = grouped.size === 0;

    return (
        <div className="flex flex-col gap-2">
            {label && <FormLabelUI>{label}</FormLabelUI>}
            <Select value={value} onValueChange={onValueChange} disabled={disabled || allEmpty}>
                <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
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
            </Select>
        </div>
    );
}
