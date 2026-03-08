import {getVersion} from "@tauri-apps/api/app";
import {relaunch} from "@tauri-apps/plugin-process";
import {check, Update} from "@tauri-apps/plugin-updater";
import {Logger} from "../logger/Logger.ts";
import {toast} from "../views/ui/use-toast.ts";
import {AutoUpdateStoreManager} from "./store/AutoUpdateStoreManager.ts";

const CHECK_DELAY_MS = 5_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

function parseSemver(version: string): [number, number, number] {
    const parts = version.replace(/^v/, "").split(".").map(Number);
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function isNewerVersion(remote: string, current: string): boolean {
    const [rMaj, rMin, rPat] = parseSemver(remote);
    const [cMaj, cMin, cPat] = parseSemver(current);
    if (rMaj !== cMaj) return rMaj > cMaj;
    if (rMin !== cMin) return rMin > cMin;
    return rPat > cPat;
}

export class AutoUpdateModule {
    private storeManager: AutoUpdateStoreManager;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private pendingUpdate: Update | null = null;

    constructor(storeManager: AutoUpdateStoreManager) {
        this.storeManager = storeManager;
    }

    public init(): void {
        if (import.meta.env.DEV) {
            Logger.info("[AutoUpdate] Skipping auto-check in dev mode");
            return;
        }
        setTimeout(() => this.checkForUpdates(), CHECK_DELAY_MS);
        this.intervalId = setInterval(() => this.checkForUpdates(), CHECK_INTERVAL_MS);
    }

    public async checkForUpdates(manual = false): Promise<void> {
        if (this.storeManager.state().isChecking) return;

        this.storeManager.setChecking(true);
        this.storeManager.setError(null);

        try {
            const update = await check();
            const currentVersion = await getVersion();

            if (update && isNewerVersion(update.version, currentVersion)) {
                Logger.info("[AutoUpdate] Update available", {data: {version: update.version, currentVersion, date: update.date}});
                this.pendingUpdate = update;
                this.storeManager.setUpdateAvailable(true, {
                    version: update.version,
                    date: update.date ?? undefined,
                    body: update.body ?? undefined,
                });
            } else {
                this.pendingUpdate = null;
                this.storeManager.setUpdateAvailable(false, null);
                if (manual) {
                    toast({title: "No updates available", description: "You are running the latest version."});
                }
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            Logger.error("[AutoUpdate] Check failed", {error});
            this.storeManager.setError(msg);
            if (manual) {
                toast({title: "Update check failed", description: msg, variant: "destructive"});
            }
        } finally {
            this.storeManager.setChecking(false);
        }
    }

    public async downloadAndInstall(): Promise<void> {
        if (!this.pendingUpdate) {
            Logger.warn("[AutoUpdate] No pending update to install");
            return;
        }

        this.storeManager.setDownloading(true);
        this.storeManager.setError(null);

        try {
            let contentLength = 0;
            let downloaded = 0;

            await this.pendingUpdate.downloadAndInstall((event) => {
                if (event.event === "Started") {
                    contentLength = event.data.contentLength ?? 0;
                } else if (event.event === "Progress") {
                    downloaded += event.data.chunkLength;
                    const progress = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0;
                    this.storeManager.setDownloadProgress(progress);
                } else if (event.event === "Finished") {
                    this.storeManager.setDownloadProgress(100);
                }
            });

            await relaunch();
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            Logger.error("[AutoUpdate] Install failed", {error});
            this.storeManager.setError(msg);
            this.storeManager.setDownloading(false);
            toast({title: "Update failed", description: msg, variant: "destructive"});
        }
    }

    public dismiss(): void {
        this.storeManager.setUpdateAvailable(false, null);
        this.pendingUpdate = null;
    }

    public destroy(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}
