import {Mic} from "lucide-react";

export function LoadingScreen() {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="loading-logo-pulse">
                    <Mic className="h-12 w-12 text-primary" />
                </div>
            </div>
        </div>
    );
}
