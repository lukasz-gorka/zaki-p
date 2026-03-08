export interface EventMap {
    "skill:voice-execute": {skillId: string};
    "skill:executed": {skillLabel: string; skillId: string; icon?: string; input: string; output: string; model?: string};
    "skill:open-chat": {skillId: string; model?: string; input: string};
    "chat:response-ready": {content: string};
    "voice:transcription-ready": {text: string};
    "system-agent:activate": {agentId: string; context: {type: string; payload: Record<string, any>}};
    "system-agent:apply": {contextType: string; payload: Record<string, any>};
}

type EventHandler<T = any> = (data: T) => void;

class EventBusImpl {
    private listeners = new Map<string, Set<EventHandler>>();

    on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): () => void;
    on(event: string, handler: EventHandler): () => void;
    on(event: string, handler: EventHandler): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(handler);
        return () => this.off(event, handler);
    }

    off(event: string, handler: EventHandler): void {
        this.listeners.get(event)?.delete(handler);
    }

    emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void;
    emit(event: string, data?: any): void;
    emit(event: string, data?: any): void {
        this.listeners.get(event)?.forEach((handler) => {
            try {
                handler(data);
            } catch (error) {
                console.error("[EventBus] Handler error for event:", event, error);
            }
        });
    }
}

export const EventBus = new EventBusImpl();
