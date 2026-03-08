import {ComponentType} from "react";
import {IGlobalState} from "../appInitializer/store/interfaces/IGlobalState.ts";
import {GlobalShortcut} from "../globalShortcuts/GlobalShortcut.ts";
import {Logger} from "../logger/Logger.ts";
import {NavigationItem} from "../navigation/interface/NavigationItem.ts";
import {skillsPlugin} from "../skills/plugin.ts";
import {IVoiceSettings} from "../voice/interfaces/IVoiceSettings.ts";

export interface RouteConfig {
    path: string;
    component: ComponentType;
}

export interface Plugin {
    id: string;
    routes?: RouteConfig[];
    navigation?: NavigationItem[];
    defaultRoute?: string;
    sidebarSections?: Array<{label: string; order: number; component: ComponentType}>;
    shortcuts?: (voiceState: IVoiceSettings) => GlobalShortcut[];
    voiceHandlers?: {
        onPopupAction?: (action: string) => boolean;
        onForceReset?: () => void;
    };
    homeExtensions?: Record<string, ComponentType>;
    settingsRoutes?: RouteConfig[];
    settingsNavigation?: NavigationItem[];
    storeDefaults?: Record<string, any>;
    cleanupEphemeral?: (state: IGlobalState) => Partial<IGlobalState>;
    init?: () => Promise<void> | void;
}

class PluginRegistryImpl {
    private plugins: Plugin[] = [];

    async init(): Promise<void> {
        this.plugins = [];
        this.register(skillsPlugin);
        await this.loadProPlugins();
    }

    private async loadProPlugins(): Promise<void> {
        const {G} = await import("../appInitializer/module/G.ts");

        if (!G.license?.isProActive()) {
            Logger.info("[PluginRegistry] Community mode (no active license)");
            return;
        }
        try {
            const proModule = await import("../../pro/index.ts");
            const proPlugins: Plugin[] = proModule.default ?? proModule.plugins ?? [];
            for (const plugin of proPlugins) {
                this.register(plugin);
            }
            Logger.info(`[PluginRegistry] Loaded ${proPlugins.length} pro plugin(s)`);
        } catch {
            Logger.info("[PluginRegistry] No pro plugins found");
        }
    }

    async reload(): Promise<void> {
        this.plugins = [];
        this.register(skillsPlugin);
        await this.loadProPlugins();
        await this.initPlugins();
    }

    async initPlugins(): Promise<void> {
        for (const plugin of this.plugins) {
            if (plugin.init) {
                try {
                    await plugin.init();
                } catch (error) {
                    Logger.error(`[PluginRegistry] Failed to init plugin: ${plugin.id}`, {error});
                }
            }
        }
    }

    register(plugin: Plugin): void {
        if (this.plugins.some((p) => p.id === plugin.id)) {
            Logger.warn(`[PluginRegistry] Plugin "${plugin.id}" already registered, skipping`);
            return;
        }
        this.plugins.push(plugin);
        Logger.info(`[PluginRegistry] Registered plugin: ${plugin.id}`);
    }

    getStoreDefaults(): Record<string, any> {
        const defaults: Record<string, any> = {};
        for (const plugin of this.plugins) {
            if (plugin.storeDefaults) {
                Object.assign(defaults, plugin.storeDefaults);
            }
        }
        return defaults;
    }

    cleanupEphemeral(state: IGlobalState): IGlobalState {
        let cleaned = {...state};
        for (const plugin of this.plugins) {
            if (plugin.cleanupEphemeral) {
                cleaned = {...cleaned, ...plugin.cleanupEphemeral(cleaned)};
            }
        }
        return cleaned;
    }

    getRoutes(): RouteConfig[] {
        return this.plugins.flatMap((p) => p.routes ?? []);
    }

    getNavigation(): NavigationItem[] {
        return this.plugins.flatMap((p) => p.navigation ?? []);
    }

    getSettingsRoutes(): RouteConfig[] {
        return this.plugins.flatMap((p) => p.settingsRoutes ?? []);
    }

    getSettingsNavigation(): NavigationItem[] {
        return this.plugins.flatMap((p) => p.settingsNavigation ?? []);
    }

    getShortcuts(voiceState: IVoiceSettings): GlobalShortcut[] {
        return this.plugins.flatMap((p) => p.shortcuts?.(voiceState) ?? []);
    }

    handlePopupAction(action: string): boolean {
        for (const plugin of this.plugins) {
            if (plugin.voiceHandlers?.onPopupAction?.(action)) {
                return true;
            }
        }
        return false;
    }

    handleForceReset(): void {
        for (const plugin of this.plugins) {
            plugin.voiceHandlers?.onForceReset?.();
        }
    }

    getDefaultRoute(): string | null {
        for (const plugin of this.plugins) {
            if (plugin.defaultRoute) return plugin.defaultRoute;
        }
        return null;
    }
}

export const PluginRegistry = new PluginRegistryImpl();
