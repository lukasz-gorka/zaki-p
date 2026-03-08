import {SystemLogVariant} from "./interfaces/SystemLogVariant.ts";

export interface ILogEntry {
    timestamp: string;
    level: SystemLogVariant;
    message: string;
    error?: unknown;
    data?: unknown;
}

export class Logger {
    private static logBuffer: ILogEntry[] = [];
    private static readonly MAX_LOGS = 1000;
    private static listeners: Set<(logs: ILogEntry[]) => void> = new Set();

    public static subscribe(listener: (logs: ILogEntry[]) => void): () => void {
        this.listeners.add(listener);
        listener([...this.logBuffer]); // Send current logs immediately
        return () => this.listeners.delete(listener);
    }

    public static getLogs(): ILogEntry[] {
        return [...this.logBuffer];
    }

    public static clearLogs(): void {
        this.logBuffer = [];
        this.notifyListeners();
    }

    private static notifyListeners(): void {
        const logs = [...this.logBuffer];
        this.listeners.forEach((listener) => listener(logs));
    }

    private static addToBuffer(entry: ILogEntry): void {
        this.logBuffer.push(entry);
        if (this.logBuffer.length > this.MAX_LOGS) {
            this.logBuffer.shift(); // Remove oldest log
        }
        this.notifyListeners();
    }

    public static async log(message: string, options?: {level?: SystemLogVariant; systemConsole?: boolean; error?: unknown; data?: unknown}): Promise<void> {
        const {level = "info", systemConsole = true, error, data} = options || {};

        const entry: ILogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            error,
            data,
        };

        this.addToBuffer(entry);

        if (systemConsole) {
            if (level === "error") {
                console.error("[LOG]", ...[message, data, error].filter((x) => x !== undefined));
            } else if (level === "warn") {
                console.warn("[LOG]", ...[message, data, error].filter((x) => x !== undefined));
            } else if (level === "debug") {
                console.debug("[LOG]", ...[message, data, error].filter((x) => x !== undefined));
            } else {
                console.info("[LOG]", ...[message, data, error].filter((x) => x !== undefined));
            }
        }
    }

    public static info(message: string, options?: {console?: boolean; error?: unknown; data?: unknown}): Promise<void> {
        return this.log(message, {...options, level: "info"});
    }

    public static warn(message: string, options?: {console?: boolean; error?: unknown; data?: unknown}): Promise<void> {
        return this.log(message, {...options, level: "warn"});
    }

    public static error(message: string, options?: {console?: boolean; error?: unknown; data?: unknown}): Promise<void> {
        return this.log(message, {...options, level: "error"});
    }

    public static debug(message: string, options?: {console?: boolean; error?: unknown; data?: unknown}): Promise<void> {
        return this.log(message, {...options, level: "debug"});
    }
}
