import ReactDOM from "react-dom/client";
import {App} from "../App.tsx";
import {init} from "../appInitializer/AppInitializer.ts";
import {storeFileName} from "../integrations/storage/localStoreInit.ts";
import {LoadingScreen} from "./components/LoadingScreen.tsx";

const container = document.getElementById("root") as HTMLElement;

const root = ReactDOM.createRoot(container);

root.render(<LoadingScreen />);

const resetDataAndReload = async () => {
    try {
        const {remove, BaseDirectory} = await import("@tauri-apps/plugin-fs");
        await remove(storeFileName, {baseDir: BaseDirectory.AppData});
    } catch {
        // Ignore removal errors
    }
    window.location.reload();
};

(async () => {
    try {
        await init();
        root.render(<App />);
    } catch (error) {
        console.error("Failed to initialize application", error);

        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        root.render(
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="max-w-lg rounded-lg border border-destructive bg-card p-6 text-center">
                    <h2 className="mb-2 text-lg font-semibold text-destructive">Initialization Failed</h2>
                    <p className="mb-4 text-sm text-muted-foreground">{errorMessage || "An unexpected error occurred during initialization"}</p>
                    {errorStack && (
                        <details className="mb-4 text-left">
                            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Show Error Details</summary>
                            <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs text-muted-foreground">{errorStack}</pre>
                        </details>
                    )}
                    <div className="flex gap-2 justify-center">
                        <button className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90" onClick={() => window.location.reload()}>
                            Reload
                        </button>
                        <button className="rounded bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90" onClick={resetDataAndReload}>
                            Reset Data & Reload
                        </button>
                    </div>
                </div>
            </div>,
        );
    }
})();
