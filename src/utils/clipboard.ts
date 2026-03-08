import {readImage, readText, writeText} from "@tauri-apps/plugin-clipboard-manager";
import {Logger} from "../logger/Logger.ts";
import {readFileAsBase64} from "./fileUtils.ts";

export const copyToClipboard = async (value: string) => {
    await writeText(value);
};

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff"];

function isImagePath(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.includes("\n")) return false;
    const ext = trimmed.split(".").pop()?.toLowerCase() || "";
    return IMAGE_EXTENSIONS.includes(ext);
}

function getMimeType(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    const map: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        bmp: "image/bmp",
        tiff: "image/tiff",
    };
    return map[ext] || "image/png";
}

export type ClipboardContent = {type: "text"; text: string} | {type: "image"; base64: string; mimeType: string};

export async function readSmartClipboard(): Promise<ClipboardContent> {
    // Try reading image directly from clipboard (e.g. screenshots)
    try {
        const image = await readImage();
        const {width, height} = await image.size();
        Logger.info("[Clipboard] Image detected", {data: {width, height}});
        if (width > 0 && height > 0) {
            const rgba = await image.rgba();
            Logger.info("[Clipboard] RGBA read", {data: {byteLength: rgba.byteLength}});
            const base64 = await rgbaToPngBase64(rgba, width, height);
            if (base64) {
                Logger.info("[Clipboard] PNG base64 ready", {data: {length: base64.length}});
                return {type: "image", base64, mimeType: "image/png"};
            }
            Logger.warn("[Clipboard] rgbaToPngBase64 returned null");
        }
    } catch (err) {
        Logger.info("[Clipboard] No image in clipboard", {data: {error: String(err)}});
    }

    // Read text
    let text = "";
    try {
        text = await readText();
    } catch {
        // empty clipboard
    }

    // Check if text is a path to an image file
    if (text && isImagePath(text)) {
        try {
            const base64 = await readFileAsBase64(text.trim());
            return {type: "image", base64, mimeType: getMimeType(text.trim())};
        } catch {
            // File doesn't exist or unreadable, return as text
        }
    }

    return {type: "text", text};
}

async function rgbaToPngBase64(rgba: Uint8Array, width: number, height: number): Promise<string | null> {
    try {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
        ctx.putImageData(imageData, 0, 0);

        const blob = await canvas.convertToBlob({type: "image/png"});
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    } catch {
        return null;
    }
}
