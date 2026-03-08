import {Settings2} from "lucide-react";
import {useMemo} from "react";
import {NavLink, Outlet, useLocation} from "react-router-dom";
import {useLicense} from "../../hooks/useLicense.ts";
import {SETTINGS_NAVIGATION} from "../../navigation/const/BASE_NAVIGATION.ts";
import {PluginRegistry} from "../../plugins/PluginRegistry.ts";

export function SettingsLayout() {
    const location = useLocation();
    const {isPro} = useLicense();
    const pluginPaths = useMemo(() => new Set(PluginRegistry.getSettingsNavigation().map((n) => n.path)), []);

    const allTabs = useMemo(() => {
        const pluginTabs = PluginRegistry.getSettingsNavigation();
        return [...SETTINGS_NAVIGATION, ...pluginTabs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }, []);

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <header className="flex flex-col gap-4 pt-5 pb-0 ml-9">
                <div className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5 text-muted-foreground" />
                    <h1 className="text-lg font-semibold">Settings</h1>
                </div>
                <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-none">
                    {allTabs.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path || (item.path !== "/settings" && location.pathname.startsWith(item.path));
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                    isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                                }`}
                            >
                                {Icon && <Icon className="w-4 h-4" />}
                                <span className="whitespace-nowrap">{item.label}</span>
                                {!isPro && pluginPaths.has(item.path) && <span className="ml-1 text-[10px] font-semibold text-primary/60">PRO</span>}
                            </NavLink>
                        );
                    })}
                </div>
            </header>
            <main className="flex-1 overflow-auto bg-background">
                <div className="mx-auto w-full h-full p-6">
                    <div className="flex justify-center w-full h-full">
                        <div className="w-full h-full">
                            <Outlet />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
