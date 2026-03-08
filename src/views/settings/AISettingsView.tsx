import {Plus} from "lucide-react";
import {useState} from "react";
import {useGlobalState} from "../../hooks/useGlobalState.ts";
import {AIProviderConfig} from "../../integrations/ai/interface/AIProviderConfig.ts";
import {createProviderFromTemplate, getProviderTemplates} from "../../integrations/ai/ProvidersManager.ts";
import {SecureStorage} from "../../integrations/storage/secureStorage.ts";
import {Logger} from "../../logger/Logger.ts";
import {Button} from "../ui/button.tsx";
import {Card} from "../ui/card.tsx";
import {Label} from "../ui/label.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "../ui/select.tsx";
import {Separator} from "../ui/separator.tsx";
import {ProviderCard} from "./ProviderCard.tsx";

export function AISettingsView() {
    const [provider, setProvider] = useGlobalState("provider");
    const providers = provider.collection;

    const [isAdding, setIsAdding] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<string>("");

    const onAddProvider = () => {
        if (!selectedTemplate) return;

        const newProvider = createProviderFromTemplate(selectedTemplate);
        setProvider({...provider, collection: [...providers, newProvider]});
        setSelectedTemplate("");
        setIsAdding(false);
    };

    const updateProvider = (updatedProvider: Partial<AIProviderConfig>) => {
        setProvider({...provider, collection: providers.map((p) => (p.uuid === updatedProvider.uuid ? {...p, ...updatedProvider} : p))});
    };

    const removeProvider = async (providerToRemove: AIProviderConfig) => {
        try {
            await SecureStorage.deleteProviderApiKey(providerToRemove.uuid);
        } catch (error) {
            Logger.warn(`[ModelsSettings] Failed to delete API key for provider: ${providerToRemove.name}`, {error});
        }

        setProvider({...provider, collection: providers.filter(({uuid}) => uuid !== providerToRemove.uuid)});
    };

    const availableTemplates = getProviderTemplates();

    return (
        <div className="flex flex-col gap-4">
            {providers.map((p) => (
                <ProviderCard key={p.uuid} provider={p} update={updateProvider} remove={removeProvider} />
            ))}

            {!isAdding ? (
                <Button variant="outline" className="w-full gap-2 h-12" onClick={() => setIsAdding(true)}>
                    <Plus className="w-4 h-4" />
                    Add Provider
                </Button>
            ) : (
                <Card className="p-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <Label>Add Provider</Label>
                    </div>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select provider type..." />
                        </SelectTrigger>
                        <SelectContent>
                            {availableTemplates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                    <span className="font-medium">{template.name}</span>
                                    <span className="text-xs text-muted-foreground ml-2">{template.description}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Separator />
                    <div className="flex gap-2 justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setIsAdding(false);
                                setSelectedTemplate("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button size="sm" onClick={onAddProvider} disabled={!selectedTemplate}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add
                        </Button>
                    </div>
                </Card>
            )}

            {providers.length === 0 && !isAdding && <p className="text-sm text-muted-foreground text-center">No providers configured. Add one to get started.</p>}
        </div>
    );
}
