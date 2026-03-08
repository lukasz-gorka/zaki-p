import {readText, writeText} from "@tauri-apps/plugin-clipboard-manager";
import {tool, type ToolSet} from "ai";
import {z} from "zod";
import {G} from "../../../appInitializer/module/G.ts";
import {Logger} from "../../../logger/Logger.ts";

/**
 * Built-in tools available to the agent.
 * These can be extended with skills-as-tools and MCP tools.
 */

export const clipboardReadTool = tool({
    description: "Read the current text content from the system clipboard",
    inputSchema: z.object({}),
    execute: async () => {
        try {
            const text = await readText();
            return {text: text || ""};
        } catch (error) {
            Logger.warn("[tools] clipboard_read failed", {error});
            return {text: "", error: "Failed to read clipboard"};
        }
    },
});

export const clipboardWriteTool = tool({
    description: "Write text content to the system clipboard",
    inputSchema: z.object({
        text: z.string().describe("The text to write to the clipboard"),
    }),
    execute: async ({text}) => {
        try {
            await writeText(text);
            return {success: true as const};
        } catch (error) {
            Logger.warn("[tools] clipboard_write failed", {error});
            return {success: false as const, error: "Failed to write to clipboard"};
        }
    },
});

export const webhookTool = tool({
    description: "Send data to a webhook URL",
    inputSchema: z.object({
        url: z.string().describe("The webhook URL to send data to"),
        data: z.string().describe("The data payload to send"),
    }),
    execute: async ({url, data}) => {
        try {
            const result = await G.rustProxy.executeWebhook({url, data});
            return {success: true as const, response: result};
        } catch (error) {
            Logger.warn("[tools] webhook failed", {error});
            return {success: false as const, error: `Webhook failed: ${error}`};
        }
    },
});

/**
 * Returns the default set of built-in tools.
 */
export function getBuiltinTools(): ToolSet {
    return {
        clipboard_read: clipboardReadTool,
        clipboard_write: clipboardWriteTool,
        webhook: webhookTool,
    };
}
