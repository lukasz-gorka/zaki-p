export class GlobalShortcut {
    public keystroke: string;
    public action: () => void | Promise<void>;
    public id?: string;
    public label?: string;
    public editable?: boolean;

    constructor(keystroke: string, action: () => void | Promise<void>, options?: {id?: string; label?: string; editable?: boolean}) {
        this.keystroke = keystroke;
        this.action = action;
        this.id = options?.id;
        this.label = options?.label;
        this.editable = options?.editable;
    }
}
