import {readFile} from "@tauri-apps/plugin-fs";

export function convertBinaryToBase64(data: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < data.length; i++) {
        binary += String.fromCharCode(data[i]);
    }
    return btoa(binary);
}

export async function readFileAsBase64(filePath: string): Promise<string> {
    const data = await readFile(filePath);
    return convertBinaryToBase64(data);
}

export function getFileBase64ImageData(file: File): Promise<{base64: string; mimeType: string}> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const [header, base64] = dataUrl.split(",");
            const mimeType = header.match(/data:(.*?);/)?.[1] || "image/png";
            resolve({base64, mimeType});
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
