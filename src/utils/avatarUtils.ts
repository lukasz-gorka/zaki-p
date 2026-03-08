import {open} from "@tauri-apps/plugin-dialog";
import {readFileAsBase64} from "./fileUtils.ts";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];

function getMimeType(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase() || "png";
    const map: Record<string, string> = {png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp"};
    return map[ext] || "image/png";
}

export async function selectAvatar(): Promise<string | null> {
    const selected = await open({
        multiple: false,
        filters: [{name: "Images", extensions: IMAGE_EXTENSIONS}],
    });
    if (!selected) return null;
    const filePath = selected as string;
    const base64 = await readFileAsBase64(filePath);
    const mime = getMimeType(filePath);
    return `data:${mime};base64,${base64}`;
}

export const AGENT_DEFAULT_AVATAR = "/agent-default.png";

export function isImageAvatar(avatar?: string): boolean {
    return !!avatar && (avatar.startsWith("data:") || avatar.startsWith("/") || avatar.startsWith("http"));
}

export function getAvatarOrDefault(avatar?: string): string {
    return avatar || AGENT_DEFAULT_AVATAR;
}
