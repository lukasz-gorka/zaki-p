import {StoreManager} from "../../appInitializer/store/StoreManager.ts";
import {IAutoUpdateState, IUpdateInfo} from "../interfaces/IAutoUpdateState.ts";

export class AutoUpdateStoreManager extends StoreManager<"autoUpdate"> {
    constructor() {
        super("autoUpdate");
    }

    public setChecking = (isChecking: boolean) => {
        this.updateState((s: IAutoUpdateState) => ({...s, isChecking}));
    };

    public setUpdateAvailable = (updateAvailable: boolean, updateInfo: IUpdateInfo | null) => {
        this.updateState((s: IAutoUpdateState) => ({...s, updateAvailable, updateInfo}));
    };

    public setDownloading = (isDownloading: boolean) => {
        this.updateState((s: IAutoUpdateState) => ({...s, isDownloading, downloadProgress: isDownloading ? 0 : s.downloadProgress}));
    };

    public setDownloadProgress = (downloadProgress: number) => {
        this.updateState((s: IAutoUpdateState) => ({...s, downloadProgress}));
    };

    public setError = (error: string | null) => {
        this.updateState((s: IAutoUpdateState) => ({...s, error}));
    };
}
