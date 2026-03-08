import {emitTo, listen} from "@tauri-apps/api/event";
import {WebviewWindow} from "@tauri-apps/api/webviewWindow";
import {Logger} from "../logger/Logger.ts";
import {RECORDING_POPUP_LABEL} from "../voice/const/RECORDING_POPUP_LABEL.ts";

export type PopupState = "initializing" | "recording" | "transcribing" | "enhancing" | "processing" | "responding" | "speaking" | "skill-executing";

export class StatusPopupManager {
    private popupActionUnlisten: (() => void) | null = null;
    private onPopupAction: ((action: string) => void) | null = null;

    public setPopupActionHandler(handler: (action: string) => void): void {
        this.onPopupAction = handler;
    }

    public async show(): Promise<void> {
        try {
            await this.setupPopupActionListener();

            const existing = await WebviewWindow.getByLabel(RECORDING_POPUP_LABEL);

            if (existing) {
                const {primaryMonitor, currentMonitor} = await import("@tauri-apps/api/window");
                const {PhysicalPosition} = await import("@tauri-apps/api/window");
                let mon = await currentMonitor().catch(() => null);
                if (!mon) mon = await primaryMonitor().catch(() => null);

                if (mon) {
                    const actualSize = await existing.outerSize();
                    const offsetY = 12;
                    const fx = (mon.position?.x || 0) + ((mon.size?.width || 1920) - actualSize.width) / 2;
                    const fy = (mon.position?.y || 0) + (mon.size?.height || 1080) - actualSize.height - offsetY;
                    await existing.setPosition(new PhysicalPosition(fx, fy));
                }

                await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "initializing"});
                await existing.show();
                return;
            }

            const {primaryMonitor, currentMonitor} = await import("@tauri-apps/api/window");
            let monitor = null;

            try {
                monitor = await currentMonitor();
            } catch (_error) {
                // Fallback to primary monitor
            }

            if (!monitor) {
                try {
                    monitor = await primaryMonitor();
                } catch (error) {
                    Logger.warn("[StatusPopupManager] Could not get primary monitor, using defaults", {error});
                }
            }

            const width = 280;
            const height = 48;
            const screenWidth = monitor?.size?.width || 1920;
            const screenHeight = monitor?.size?.height || 1080;
            const monitorX = monitor?.position?.x || 0;
            const monitorY = monitor?.position?.y || 0;

            const offsetY = 12;
            const x = monitorX + (screenWidth - width) / 2;
            const y = monitorY + screenHeight - height - offsetY;

            const popupUrl = import.meta.env.DEV ? "http://localhost:1421/recording-popup.html" : "/recording-popup.html";

            const window = new WebviewWindow(RECORDING_POPUP_LABEL, {
                url: popupUrl,
                title: "Recording",
                width,
                height,
                x,
                y,
                resizable: false,
                alwaysOnTop: true,
                decorations: false,
                skipTaskbar: true,
                focus: false,
                visible: false,
                transparent: false,
            });

            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Window creation timeout"));
                }, 5000);

                window.once("tauri://created", () => {
                    clearTimeout(timeout);
                    resolve();
                });

                window.once("tauri://error", (e) => {
                    clearTimeout(timeout);
                    Logger.error("[StatusPopupManager] Window creation error", {error: e});
                    reject(e);
                });
            });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const {PhysicalPosition} = await import("@tauri-apps/api/window");
            const actualSize = await window.outerSize();
            const actualWidth = actualSize.width;
            const actualHeight = actualSize.height;

            const finalX = monitorX + (screenWidth - actualWidth) / 2;
            const finalY = monitorY + screenHeight - actualHeight - offsetY;

            await window.setPosition(new PhysicalPosition(finalX, finalY));
            await window.show();

            await new Promise((resolve) => setTimeout(resolve, 200));
            await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "initializing"});
        } catch (error) {
            Logger.error("[StatusPopupManager] Failed to show popup:", {error});
            throw error;
        }
    }

    public async hide(): Promise<void> {
        try {
            const existing = await WebviewWindow.getByLabel(RECORDING_POPUP_LABEL);
            if (existing) {
                await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state: "initializing"});
                await existing.hide();
            }
            this.cleanupPopupActionListener();
        } catch (error) {
            Logger.error("[StatusPopupManager] Failed to hide popup:", {error});
        }
    }

    public async setState(state: PopupState, label?: string): Promise<void> {
        try {
            await emitTo(RECORDING_POPUP_LABEL, `recording-popup-state-${RECORDING_POPUP_LABEL}`, {state, label});
        } catch (error) {
            Logger.error("[StatusPopupManager] Failed to set popup state:", {error});
        }
    }

    private async setupPopupActionListener(): Promise<void> {
        if (this.popupActionUnlisten) return;

        try {
            this.popupActionUnlisten = await listen<{action: string}>("voice-popup-action", (event) => {
                if (this.onPopupAction) {
                    this.onPopupAction(event.payload.action);
                }
            });
        } catch (error) {
            Logger.error("[StatusPopupManager] Failed to setup popup action listener:", {error});
        }
    }

    private cleanupPopupActionListener(): void {
        if (this.popupActionUnlisten) {
            this.popupActionUnlisten();
            this.popupActionUnlisten = null;
        }
    }
}
