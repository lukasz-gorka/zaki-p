import {PanelLeft, PanelLeftClose} from "lucide-react";
import {ReactNode} from "react";
import {useGlobalState} from "../../hooks/useGlobalState.ts";
import {CommandPanel} from "../commandPanel/CommandPanel.tsx";
import {SidebarInset, SidebarProvider} from "../ui/sidebar.tsx";
import {Toaster} from "../ui/toaster.tsx";
import {AppSidebar} from "./Sidebar.tsx";

interface IMainLayout {
    children: ReactNode;
}

export function MainLayout({children}: IMainLayout) {
    const [view, setView] = useGlobalState("view");
    const {sidebarOpen} = view;
    const setSidebarOpen = (value: boolean | ((prev: boolean) => boolean)) => {
        const newValue = typeof value === "function" ? value(sidebarOpen) : value;
        setView({sidebarOpen: newValue});
    };

    return (
        <div className="w-full h-full overflow-hidden bg-background gradient-overlay flex flex-col relative">
            <SidebarProvider className="flex-1 overflow-hidden relative z-10" open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <AppSidebar />
                <SidebarInset className="overflow-auto relative">
                    <button
                        onClick={() => setSidebarOpen((prev) => !prev)}
                        className="fixed top-3 z-50 flex h-8 w-8 items-center justify-center rounded-sm shadow-md hover:bg-accent transition-all"
                        style={{left: sidebarOpen ? "calc(var(--sidebar-width) - 20px)" : "22px"}}
                    >
                        {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
                    </button>
                    <div className="flex justify-center h-full">
                        <div className="w-full max-w-5xl h-full">{children}</div>
                    </div>
                </SidebarInset>
            </SidebarProvider>
            <div className="portal-container">
                <div id="portal" />
                <Toaster />
                <CommandPanel />
            </div>
        </div>
    );
}
