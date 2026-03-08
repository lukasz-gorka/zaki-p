import {getVersion} from "@tauri-apps/api/app";
import {open} from "@tauri-apps/plugin-shell";
import {ArrowUpCircle, CheckCircle2, Download, ExternalLink, RefreshCw} from "lucide-react";
import {useCallback, useEffect, useState} from "react";
import {G} from "../../appInitializer/module/G.ts";
import {store} from "../../appInitializer/store";
import {Button} from "../../views/ui/button.tsx";
import {Spinner} from "../../views/ui/spinner.tsx";

export function UpdateSettingsSection() {
    const {updateAvailable, updateInfo, isChecking, isDownloading, downloadProgress, error} = store((s) => s.autoUpdate);
    const [appVersion, setAppVersion] = useState<string>("");

    useEffect(() => {
        getVersion().then(setAppVersion);
    }, []);

    const handleCheck = useCallback(() => {
        G.autoUpdate.checkForUpdates(true);
    }, []);

    const handleInstall = useCallback(() => {
        G.autoUpdate.downloadAndInstall();
    }, []);

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold">About & Updates</h3>
                <p className="text-sm text-muted-foreground">Current version: v{appVersion}</p>
            </div>

            <div className="rounded-lg border p-4 space-y-4">
                {updateAvailable && updateInfo ? (
                    <>
                        <div className="flex items-start gap-3">
                            <ArrowUpCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium">
                                    New version available: <strong>v{updateInfo.version}</strong>
                                </p>
                                {updateInfo.date && <p className="text-xs text-muted-foreground">{new Date(updateInfo.date).toLocaleDateString()}</p>}
                            </div>
                        </div>

                        {updateInfo.body && (
                            <div className="rounded-md border bg-muted/30 p-3">
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">What's new</p>
                                <div className="text-sm whitespace-pre-wrap">{updateInfo.body}</div>
                            </div>
                        )}

                        {isDownloading ? (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2">
                                        <Spinner size="sm" />
                                        Downloading...
                                    </span>
                                    <span>{downloadProgress}%</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                                    <div className="h-full rounded-full bg-primary transition-all duration-300" style={{width: `${downloadProgress}%`}} />
                                </div>
                            </div>
                        ) : (
                            <Button onClick={handleInstall} size="sm">
                                <Download className="mr-2 h-4 w-4" />
                                Download & Install
                            </Button>
                        )}
                    </>
                ) : (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>You're up to date</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleCheck} disabled={isChecking}>
                            {isChecking ? <Spinner size="sm" className="mr-2" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                            Check for updates
                        </Button>
                    </div>
                )}

                {error && <p className="text-xs text-destructive">{error}</p>}

                <div className="flex items-center gap-2 pt-1">
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground" onClick={() => open("https://zakip.luksite.pl/download/")}>
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Manual download
                    </Button>
                </div>
            </div>
        </div>
    );
}
