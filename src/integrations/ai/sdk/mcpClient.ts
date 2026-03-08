import {createMCPClient} from "@ai-sdk/mcp";
import {ToolSet} from "ai";
import {Logger} from "../../../logger/Logger.ts";

export interface MCPServerConfig {
    id: string;
    name: string;
    url: string; // SSE endpoint URL
    apiKey?: string;
}

class MCPClientManager {
    private clients: Map<string, any> = new Map();

    async connectServer(config: MCPServerConfig): Promise<void> {
        Logger.info(`[MCPClientManager] Connecting to MCP server "${config.name}" (${config.id}) at ${config.url}`);

        const headers: Record<string, string> = {};
        if (config.apiKey) {
            headers["Authorization"] = `Bearer ${config.apiKey}`;
        }

        const client = await createMCPClient({
            transport: {
                type: "sse",
                url: config.url,
                headers: Object.keys(headers).length > 0 ? headers : undefined,
            },
        });

        this.clients.set(config.id, client);
        Logger.info(`[MCPClientManager] Connected to MCP server "${config.name}" (${config.id})`);
    }

    async disconnectServer(id: string): Promise<void> {
        const client = this.clients.get(id);
        if (!client) {
            Logger.warn(`[MCPClientManager] No client found for server id "${id}"`);
            return;
        }

        await client.close();
        this.clients.delete(id);
        Logger.info(`[MCPClientManager] Disconnected from MCP server "${id}"`);
    }

    async getTools(serverId: string): Promise<ToolSet> {
        const client = this.clients.get(serverId);
        if (!client) {
            throw new Error(`[MCPClientManager] No connected MCP server with id "${serverId}"`);
        }

        return client.tools() as Promise<ToolSet>;
    }

    async getAllTools(): Promise<ToolSet> {
        const merged: ToolSet = {};

        for (const [serverId, client] of this.clients.entries()) {
            const tools = (await client.tools()) as ToolSet;
            for (const [toolName, tool] of Object.entries(tools)) {
                const prefixedName = `mcp_${serverId}_${toolName}`;
                merged[prefixedName] = tool;
            }
        }

        return merged;
    }

    disconnectAll(): void {
        for (const [id, client] of this.clients.entries()) {
            client.close().catch((err: unknown) => {
                Logger.error(`[MCPClientManager] Error closing client "${id}"`, {error: err});
            });
        }
        this.clients.clear();
        Logger.info("[MCPClientManager] Disconnected all MCP servers");
    }
}

export const mcpClientManager = new MCPClientManager();
