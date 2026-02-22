import {appDataDir, join} from "@tauri-apps/api/path";
import {exists, mkdir, remove, writeFile} from "@tauri-apps/plugin-fs";
import {Logger} from "../logger/Logger.ts";

const RECORDINGS_DIR = "recordings";

async function ensureRecordingsDir(): Promise<string> {
    const appData = await appDataDir();
    const dir = await join(appData, RECORDINGS_DIR);
    const dirExists = await exists(dir);
    if (!dirExists) {
        await mkdir(dir, {recursive: true});
    }
    return dir;
}

function formatRecordingFileName(id: string, format: string): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    return `${date}_${time}_${id}.${format}`;
}

export async function saveAudioFile(id: string, audioData: number[], format: string): Promise<string> {
    const dir = await ensureRecordingsDir();
    const fileName = formatRecordingFileName(id, format);
    const filePath = await join(dir, fileName);
    const uint8Array = new Uint8Array(audioData);
    await writeFile(filePath, uint8Array);
    Logger.info(`[audioFileStorage] Saved audio file: ${filePath}`);
    return filePath;
}

export async function deleteAudioFile(path: string): Promise<void> {
    try {
        const fileExists = await exists(path);
        if (fileExists) {
            await remove(path);
            Logger.info(`[audioFileStorage] Deleted audio file: ${path}`);
        }
    } catch (error) {
        Logger.warn(`[audioFileStorage] Failed to delete audio file: ${path}`, {error});
    }
}

export async function deleteAudioFiles(paths: string[]): Promise<void> {
    await Promise.all(paths.map(deleteAudioFile));
}
