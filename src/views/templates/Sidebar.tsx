import {ArrowUpCircle} from "lucide-react";
import {NavLink, useLocation, useNavigate} from "react-router-dom";
import {store} from "../../appInitializer/store";
import {BASE_NAVIGATION} from "../../navigation/const/BASE_NAVIGATION.ts";
import {ROUTE_PATH} from "../../navigation/const/ROUTE_PATH.ts";
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

    return (
        <Sidebar collapsible="offcanvas" className="border-r-0">
            <SidebarHeader className="px-5 py-5 border-b border-border/50 w-[200px] flex flex-col items-center justify-center gap-2">
                <img src="/zakip-logo.jpeg" className="w-[80%] rounded-xl opacity-90" alt="zakip voice" />
                <span className="text-sm font-semibold tracking-wide text-muted-foreground/70">zaki.p</span>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup className="px-4 py-3">
                    <SidebarGroupContent>
                        <SidebarMenu className="gap-2">
                            {BASE_NAVIGATION.map((item) => {
                                const Icon = item.icon;
                                const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);

                                return (
                                    <SidebarMenuItem key={item.path}>
                                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label} size="lg" className="h-11 gap-3.5 px-3.5 text-[14px] font-medium">
                                            <NavLink to={item.path} end={item.path === "/"}>
                                                {Icon && <Icon className="!w-5 !h-5 shrink-0" />}
                                                <span>{item.label}</span>
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
                        onClick={() => navigate(ROUTE_PATH.SETTINGS)}
                        className="flex items-center gap-2.5 w-full rounded-lg px-3.5 py-2.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                    >
                        <ArrowUpCircle className="h-4 w-4 shrink-0" />
                        <span>Update v{updateVersion}</span>
                    </button>
                )}
                <div className="flex items-center justify-center gap-3">
                    <img src="/luksite.svg" className="h-3.5" alt="luksite" />
                    <span className="text-xs text-muted-foreground/60">zakip-voice.luksite.pl</span>
                </div>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
