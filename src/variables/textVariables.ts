import {BuiltInVariableType} from "./BuiltInVariableType.ts";

export interface VariableContext {
    sessionId?: string;
    message?: string;
    clipboard?: string;
}

const getBuiltInVariableValue = (variableType: BuiltInVariableType, context: VariableContext): string => {
    const now = new Date();

    switch (variableType) {
        case BuiltInVariableType.DATETIME:
            return `${now.toISOString().split("T")[0]} ${now.toTimeString().split(" ")[0]}`;

        case BuiltInVariableType.MESSAGE:
            return context.message || "";

        case BuiltInVariableType.SESSION_ID:
            return context.sessionId || "";

        case BuiltInVariableType.CLIPBOARD:
            return context.clipboard || "";

        default:
            return "";
    }
};

const escapeJsonValue = (value: string): string => {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
};

const isInsideJsonString = (template: string, matchIndex: number): boolean => {
    // Check if the variable placeholder is wrapped in JSON string quotes: "...{{{VAR}}}..."
    const before = template.lastIndexOf('"', matchIndex - 1);
    if (before === -1) return false;
    const after = template.indexOf('"', matchIndex + 1);
    return after !== -1;
};

export const resolveTextVariables = (template: string, context: VariableContext = {}): string => {
    const pattern = /\{\{\{([A-Z_]+)\}\}\}/g;

    // Detect if template looks like JSON to apply JSON-safe escaping
    const looksLikeJson = template.trimStart().startsWith("{") || template.trimStart().startsWith("[");

    return template.replace(pattern, (match, variableName, offset) => {
        if (variableName in BuiltInVariableType) {
            const value = getBuiltInVariableValue(variableName as BuiltInVariableType, context);
            if (looksLikeJson && isInsideJsonString(template, offset)) {
                return escapeJsonValue(value);
            }
            return value;
        }
        return match;
    });
};
