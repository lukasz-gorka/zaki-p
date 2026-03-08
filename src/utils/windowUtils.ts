import {getCurrentWebviewWindow} from "@tauri-apps/api/webviewWindow";

export const toggleWindow = async () => {
    const appWindow = getCurrentWebviewWindow();

    const isVisible = await appWindow.isVisible();
    if (isVisible) {
        await appWindow.hide();
    } else {
        await appWindow.setAlwaysOnTop(true);
        await appWindow.show();
        await appWindow.setFocus();
    }
};
