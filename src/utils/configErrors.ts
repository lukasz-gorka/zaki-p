import {toast} from "../views/ui/use-toast.ts";

interface ConfigErrorOptions {
    title: string;
    description: string;
}

export function showConfigError({title, description}: ConfigErrorOptions) {
    toast({
        title,
        description,
        variant: "destructive",
        duration: 8000,
    });
}

export interface ParsedError {
    code?: string;
    message: string;
}

export function parseStructuredError(error: unknown): ParsedError {
    const raw = error instanceof Error ? error.message : String(error);

    // Try to parse as JSON error from Rust
    try {
        const jsonMatch = raw.match(/\{[^}]*"code"[^}]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.code && parsed.message) {
                return {code: parsed.code, message: parsed.message};
            }
        }
    } catch {
        // Not JSON, fall through
    }

    return {message: parseApiErrorMessage(error)};
}

export function parseApiErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("401") || message.includes("403") || message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("forbidden")) {
        return "Invalid API key — check your provider settings.";
    }
    if (message.includes("404") || message.toLowerCase().includes("not found")) {
        return "Model not found — it may not exist for this provider.";
    }
    if (message.includes("429") || message.toLowerCase().includes("rate limit")) {
        return "Rate limit exceeded — try again later.";
    }
    if (message.toLowerCase().includes("timeout") || message.toLowerCase().includes("timed out")) {
        return "Request timed out — check your connection.";
    }
    if (message.toLowerCase().includes("network") || message.toLowerCase().includes("econnrefused") || message.toLowerCase().includes("fetch failed")) {
        return "Network error — check your internet connection.";
    }

    return message;
}
