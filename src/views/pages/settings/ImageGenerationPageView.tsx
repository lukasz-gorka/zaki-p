import {Settings} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {IImageGenerationSettings, IMAGE_QUALITIES, IMAGE_SIZES, IMAGE_STYLES} from "../../../consts/IMAGE_GENERATION_CONFIG.ts";
import {useGlobalState} from "../../../hooks/useGlobalState.ts";
import {ROUTE_PATH} from "../../../navigation/const/ROUTE_PATH.ts";
import {FormSelectUI} from "../../form/FormSelectUI.tsx";
import {ModelSelectUI} from "../../form/ModelSelectUI.tsx";
import {Button} from "../../ui/button.tsx";
import {Separator} from "../../ui/separator.tsx";

export function ImageGenerationPageView() {
    const navigate = useNavigate();
    const [imageGeneration, setImageGeneration] = useGlobalState("imageGeneration");
    const settings = imageGeneration as IImageGenerationSettings;

    const update = (updates: Partial<IImageGenerationSettings>) => {
        setImageGeneration({
            ...settings,
            ...updates,
        });
    };

    return (
        <div className="flex flex-col gap-8 py-2">
            <div className="flex items-end gap-2">
                <ModelSelectUI tag="image-generation" label="Image Generation Model" value={settings.imageModel} onValueChange={(value) => update({imageModel: value})} />
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate(ROUTE_PATH.MODELS)}>
                    <Settings className="w-4 h-4" />
                </Button>
            </div>

            <Separator />

            <FormSelectUI
                label="Size"
                value={settings.defaultImageSize}
                onValueChange={(value) => update({defaultImageSize: value})}
                items={IMAGE_SIZES.map((s) => ({value: s, name: s}))}
            />

            <FormSelectUI
                label="Quality"
                value={settings.defaultImageQuality}
                onValueChange={(value) => update({defaultImageQuality: value})}
                items={IMAGE_QUALITIES.map((q) => ({value: q, name: q.charAt(0).toUpperCase() + q.slice(1)}))}
            />

            <FormSelectUI
                label="Style"
                value={settings.defaultImageStyle}
                onValueChange={(value) => update({defaultImageStyle: value})}
                items={IMAGE_STYLES.map((s) => ({value: s, name: s.charAt(0).toUpperCase() + s.slice(1)}))}
            />
        </div>
    );
}
