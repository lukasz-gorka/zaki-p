import {LucideIcon, Search} from "lucide-react";
import {ReactNode, useEffect, useRef} from "react";
import {EmptyState} from "../ui/empty-state.tsx";
import {Input} from "../ui/input.tsx";
import {Kbd} from "../ui/kbd.tsx";
import {ScrollArea} from "../ui/scroll-area.tsx";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "../ui/tabs.tsx";
import {ContentPageLayout, ContentPageLayoutProps} from "./ContentPageLayout.tsx";

export interface TabConfig<T> {
    value: string;
    label: string;
    icon: LucideIcon;
    count?: number;
    items: T[];
    renderItem: (item: T) => ReactNode;
    renderItems?: (items: T[]) => ReactNode;
    emptyIcon: LucideIcon;
    emptyTitle: string;
    emptyDescription: string;
    emptyAction?: ReactNode;
}

export interface TabbedListPageTemplateProps<T> {
    title: string;
    icon: LucideIcon;
    tabs: TabConfig<T>[];
    searchPlaceholder?: string;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    activeTab: string;
    onTabChange: (tab: string) => void;
    actions?: ContentPageLayoutProps["actions"];
    customActionButton?: ReactNode;
    afterContent?: ReactNode;
    alwaysShowSearch?: boolean;
}

export function TabbedListPageTemplate<T>({
    title,
    icon,
    tabs,
    searchPlaceholder = "Search...",
    searchQuery,
    onSearchChange,
    activeTab,
    onTabChange,
    actions,
    customActionButton,
    afterContent,
    alwaysShowSearch,
}: TabbedListPageTemplateProps<T>) {
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
                searchInputRef.current?.blur();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const renderItemsList = (tab: TabConfig<T>) => {
        if (tab.renderItems) return tab.renderItems(tab.items);
        return (
            <ScrollArea className="flex-1">
                <div className="space-y-3 pr-4">
                    {tab.items.map((item, i) => (
                        <div key={i}>{tab.renderItem(item)}</div>
                    ))}
                </div>
            </ScrollArea>
        );
    };

    return (
        <ContentPageLayout title={title} icon={icon} actions={actions} customActionButton={customActionButton}>
            <div className="h-full flex flex-col">
                <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-col h-full">
                    {tabs.length > 1 && (
                        <TabsList className="mb-4 self-start">
                            {tabs.map((tab) => (
                                <TabsTrigger key={tab.value} value={tab.value}>
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                    {tab.count !== undefined && ` (${tab.count})`}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    )}

                    {tabs.map((tab) => {
                        const showSearch = alwaysShowSearch || tab.items.length > 0 || searchQuery.trim();
                        return (
                            <TabsContent key={tab.value} value={tab.value} className="flex-1 flex flex-col mt-0">
                                {showSearch ? (
                                    <>
                                        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 mb-2">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                <Input
                                                    ref={searchInputRef}
                                                    placeholder={searchPlaceholder}
                                                    value={searchQuery}
                                                    onChange={(e) => onSearchChange(e.target.value)}
                                                    className="pl-9 pr-12"
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <Kbd>/</Kbd>
                                                </div>
                                            </div>
                                        </div>
                                        {tab.items.length > 0 ? (
                                            renderItemsList(tab)
                                        ) : (
                                            <EmptyState icon={tab.emptyIcon} title="No results found" description="Try a different search query" />
                                        )}
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center">
                                        <EmptyState icon={tab.emptyIcon} title={tab.emptyTitle} description={tab.emptyDescription} />
                                        {tab.emptyAction}
                                    </div>
                                )}
                            </TabsContent>
                        );
                    })}
                </Tabs>
            </div>
            {afterContent}
        </ContentPageLayout>
    );
}
