export const IMAGE_SIZES = ["1024x1024", "1024x1792", "1792x1024"] as const;
export const IMAGE_QUALITIES = ["standard", "hd"] as const;
export const IMAGE_STYLES = ["vivid", "natural"] as const;
export const DEFAULT_IMAGE_SIZE = "1024x1024";
export const DEFAULT_IMAGE_QUALITY = "standard";
export const DEFAULT_IMAGE_STYLE = "vivid";

export interface IImageGenerationSettings {
    imageModel: string;
    defaultImageSize: string;
    defaultImageQuality: string;
    defaultImageStyle: string;
}

export const DEFAULT_IMAGE_GENERATION_SETTINGS: IImageGenerationSettings = {
    imageModel: "",
    defaultImageSize: DEFAULT_IMAGE_SIZE,
    defaultImageQuality: DEFAULT_IMAGE_QUALITY,
    defaultImageStyle: DEFAULT_IMAGE_STYLE,
};
