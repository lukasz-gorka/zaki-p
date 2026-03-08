import {emitTo} from "@tauri-apps/api/event";
import {WebviewWindow} from "@tauri-apps/api/webviewWindow";
import type {Monitor} from "@tauri-apps/api/window";
import {Logger} from "../../logger/Logger.ts";

export interface PopupContentConfig {
    type: "text";
    title: string;
    text: string;
    icon?: string;
}

export interface PopupConfig {
    content: PopupContentConfig;
    size?: {width?: number; height?: number};
    behavior?: {resizable?: boolean; alwaysOnTop?: boolean; decorations?: boolean};
    forceNew?: boolean;
}

const DEFAULT_TEXT_SIZE = {width: 420, height: 480};
const MIN_SIZE = {width: 320, height: 240};

async function getTargetMonitor(): Promise<Monitor | null> {
    try {
        const {primaryMonitor, currentMonitor} = await import("@tauri-apps/api/window");
        let monitor: Monitor | null = null;

        try {
            monitor = await currentMonitor();
        } catch {
            // fallback
        }

        if (!monitor) monitor = await primaryMonitor();
        return monitor;
    } catch (error) {
        Logger.error("[PopupManager] Failed to get target monitor", {error});
        return null;
    }
}

function generateLabel(id: string): string {
    return `popup-text-${id}`;
}

export async function showPopup(id: string, config: PopupConfig): Promise<void> {
    const label = generateLabel(id);
    Logger.info(`[PopupManager] showPopup`, {data: {id, label}});

    try {
        if (!config.forceNew) {
            const existing = await WebviewWindow.getByLabel(label);
            if (existing) {
                await existing.show();
                await existing.setFocus();
                await emitTo(label, `popup-content-${label}`, {type: "text", content: config.content});
                return;
            }
        }

        const monitor = await getTargetMonitor();
        const width = config.size?.width || DEFAULT_TEXT_SIZE.width;
        const height = config.size?.height || DEFAULT_TEXT_SIZE.height;
        const behavior = config.behavior || {};
        const popupUrl = import.meta.env.DEV ? "http://localhost:1421/popup.html" : "/popup.html";

        const window = new WebviewWindow(label, {
            url: popupUrl,
            title: config.content.title,
            width,
            height,
            minWidth: MIN_SIZE.width,
            minHeight: MIN_SIZE.height,
            resizable: behavior.resizable !== false,
            alwaysOnTop: behavior.alwaysOnTop !== false,
            decorations: behavior.decorations || false,
            skipTaskbar: true,
            focus: true,
            visible: false,
            transparent: true,
        });

        await new Promise<void>((resolve, reject) => {
            window.once("tauri://created", () => resolve());
            window.once("tauri://error", (e) => reject(e));
        });

        Logger.info(`[PopupManager] Window created, positioning...`);

        // Position after creation using PhysicalPosition (same pattern as recording popup)
        const {PhysicalPosition} = await import("@tauri-apps/api/window");
        const actualSize = await window.outerSize();
        const aw = actualSize.width;
        const ah = actualSize.height;

        const sw = monitor?.size?.width || 1920;
        const sh = monitor?.size?.height || 1080;
        const mx = monitor?.position?.x || 0;
        const my = monitor?.position?.y || 0;

        // Bottom-right, 16px padding from edges
        const pad = 16 * (monitor?.scaleFactor || 1);
        const fx = mx + sw - aw - pad;
        const fy = my + sh - ah - pad;
        await window.setPosition(new PhysicalPosition(fx, fy));

        await waitForReady(label);
        await window.show();
        await window.setFocus();
        await emitTo(label, `popup-content-${label}`, {type: "text", content: config.content});

        Logger.info(`[PopupManager] Popup created at (${fx}, ${fy})`, {data: {id, label}});
    } catch (error) {
        Logger.error(`[PopupManager] Failed to show popup`, {error, data: {id, label}});
    }
}

async function waitForReady(label: string, timeoutMs = 3000): Promise<void> {
    const {listen} = await import("@tauri-apps/api/event");
    return new Promise((resolve) => {
        const timeout = setTimeout(resolve, timeoutMs);
        listen(`popup-ready-${label}`, () => {
            clearTimeout(timeout);
            resolve();
        }).then((unlisten) => {
            setTimeout(() => unlisten(), timeoutMs + 100);
        });
    });
}

export async function closePopup(id: string): Promise<void> {
    const label = generateLabel(id);
    try {
        const existing = await WebviewWindow.getByLabel(label);
        if (existing) await existing.close();
    } catch (error) {
        Logger.error(`[PopupManager] Failed to close popup`, {error});
    }
}
