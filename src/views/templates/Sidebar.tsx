import {ArrowUpCircle} from "lucide-react";
import {useMemo} from "react";
import {NavLink, useLocation, useNavigate} from "react-router-dom";
import {store} from "../../appInitializer/store";
import {useLicense} from "../../hooks/useLicense.ts";
import {BASE_NAVIGATION} from "../../navigation/const/BASE_NAVIGATION.ts";
import {ROUTE_PATH} from "../../navigation/const/ROUTE_PATH.ts";
import {PluginRegistry} from "../../plugins/PluginRegistry.ts";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "../ui/sidebar.tsx";

export function AppSidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const updateAvailable = store((s) => s.autoUpdate.updateAvailable);
    const updateVersion = store((s) => s.autoUpdate.updateInfo?.version);
    const {isPro} = useLicense();

    const navigation = useMemo(() => {
        const pluginNav = PluginRegistry.getNavigation();
        if (pluginNav.length === 0) return {items: BASE_NAVIGATION, proPaths: new Set<string>()};
        const proPaths = new Set(pluginNav.map((n) => n.path));
        return {items: [...BASE_NAVIGATION, ...pluginNav].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), proPaths};
    }, []);

    return (
        <Sidebar collapsible="offcanvas" className="border-r-0">
            <div className="flex items-center justify-center w-full">
                <SidebarHeader className="px-5 py-5 border-b border-border/50 flex flex-col items-center justify-center gap-2 max-w-[180px]">
                    <img src="/zakip-logo.jpeg" className="w-[80%] rounded-xl opacity-90" alt="zakip voice" />
                    {isPro ? (
                        <span className="text-sm font-semibold tracking-wide text-muted-foreground/70">
                            <>
                                zaki<span className="text-primary">.</span>p<span className="text-primary">ro</span>
                            </>
                        </span>
                    ) : (
                        <span className="text-sm font-semibold tracking-wide text-muted-foreground/70">zaki.p</span>
                    )}
                </SidebarHeader>
            </div>
            <SidebarContent>
                <SidebarGroup className="px-4 py-3">
                    <SidebarGroupContent>
                        <SidebarMenu className="gap-2">
                            {navigation.items.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");

                                return (
                                    <SidebarMenuItem key={item.path}>
                                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label} size="lg" className="h-11 gap-3.5 px-3.5 text-[14px] font-medium">
                                            <NavLink to={item.path}>
                                                {Icon && <Icon className="!w-5 !h-5 shrink-0" />}
                                                <span>{item.label}</span>
                                                {!isPro && navigation.proPaths.has(item.path) && (
                                                    <span className="ml-auto text-[10px] font-semibold tracking-wider text-primary/60 uppercase">Pro</span>
                                                )}
                                            </NavLink>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="px-4 py-4 space-y-2 border-t border-border/50">
                {updateAvailable && (
                    <button
                        onClick={() => navigate(ROUTE_PATH.SETTINGS_ADVANCED)}
                        className="flex items-center gap-2.5 w-full rounded-lg px-3.5 py-2.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                    >
                        <ArrowUpCircle className="h-4 w-4 shrink-0" />
                        <span>Update v{updateVersion}</span>
                    </button>
                )}
                <div className="flex items-center justify-center gap-3">
                    <img src="/luksite.svg" className="h-3.5" alt="luksite" />
                    <span className="text-xs text-muted-foreground/60">zakip.luksite.pl</span>
                </div>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
