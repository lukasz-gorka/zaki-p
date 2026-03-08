import {Component, ErrorInfo, ReactNode} from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {hasError: false, error: null};
    }

    static getDerivedStateFromError(error: Error): State {
        return {hasError: true, error};
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-screen w-screen items-center justify-center bg-background">
                    <div className="flex flex-col items-center gap-4 max-w-md text-center">
                        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
                        <p className="text-sm text-muted-foreground">{this.state.error?.message || "An unexpected error occurred."}</p>
                        <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                            Reload
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
