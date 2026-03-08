export interface IUpdateInfo {
    version: string;
    date?: string;
    body?: string;
}

export interface IAutoUpdateState {
    isChecking: boolean;
    updateAvailable: boolean;
    updateInfo: IUpdateInfo | null;
    isDownloading: boolean;
    downloadProgress: number;
    error: string | null;
}

export const DEFAULT_AUTO_UPDATE_STATE: IAutoUpdateState = {
    isChecking: false,
    updateAvailable: false,
    updateInfo: null,
    isDownloading: false,
    downloadProgress: 0,
    error: null,
};
