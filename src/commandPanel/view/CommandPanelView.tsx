import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {IconView} from "../../icons/IconView.tsx";
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from "../../views/ui/command.tsx";
import {cn} from "../../views/ui/lib/utils.ts";
import {ICommandPanelItem} from "../interface/ICommandPanelItem.ts";
import {CommandPanelPreview} from "./components/CommandPanelPreview.tsx";

export interface CommandPanelViewProps {
    searchValue: string;
    onSearchValueChange: (value: string) => void;
    items: ICommandPanelItem[];
    onClose?: () => void;
}

type CategoryFilter = null | "History" | "Skills" | "Chat History";

export function CommandPanelView({searchValue, onSearchValueChange, items, onClose}: CommandPanelViewProps) {
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const [selectedValue, setSelectedValue] = useState<string>("");
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(null);
    const previousSearchValueRef = useRef<string>("");
    const previousCategoryFilterRef = useRef<CategoryFilter>(null);

    const showPreview = categoryFilter !== null;

    const filteredItems = useMemo(() => {
        let result = items;

        if (categoryFilter) {
            result = result.filter((item) => item.category === categoryFilter);
        } else {
            result = result.filter((item) => item.showInMainView !== false);
        }

        if (searchValue.trim().length > 0) {
            const searchLower = searchValue.toLowerCase().trim();
            result = result.filter((item) => {
                if (item.label.toLowerCase().includes(searchLower)) return true;
                if (item.description?.toLowerCase().includes(searchLower)) return true;
                if (item.keywords?.some((keyword) => keyword && keyword.toLowerCase().includes(searchLower))) return true;
                return false;
            });
        }

        return result;
    }, [items, searchValue, categoryFilter]);

    const groupedItems = useMemo(() => {
        const groups = new Map<string, ICommandPanelItem[]>();
        for (const item of filteredItems) {
            if (!groups.has(item.category)) {
                groups.set(item.category, []);
            }
            groups.get(item.category)!.push(item);
        }
        return Array.from(groups.entries()).map(([name, items]) => ({name, items}));
    }, [filteredItems]);

    const selectedItem = useMemo(() => {
        return filteredItems.find((item) => item.label === selectedValue) || null;
    }, [filteredItems, selectedValue]);

    const executeAction = useCallback(
        async (item: ICommandPanelItem) => {
            const primaryAction = item.actions?.[0];
            if (primaryAction?.onAction) {
                await primaryAction.onAction();
                onSearchValueChange("");
            }
        },
        [onSearchValueChange],
    );

    // Sync selection when items change
    useEffect(() => {
        const searchChanged = previousSearchValueRef.current !== searchValue;
        const categoryChanged = previousCategoryFilterRef.current !== categoryFilter;

        if (searchChanged || categoryChanged) {
            previousSearchValueRef.current = searchValue;
            previousCategoryFilterRef.current = categoryFilter;

            const validLabels = new Set(filteredItems.map((item) => item.label));
            if (selectedValue && !validLabels.has(selectedValue)) {
                setSelectedValue(filteredItems.length > 0 ? filteredItems[0].label : "");
            } else if (!selectedValue && filteredItems.length > 0) {
                setSelectedValue(filteredItems[0].label);
            }
        }
    }, [searchValue, categoryFilter, filteredItems, selectedValue]);

    const focusSearchInput = useCallback(() => {
        requestAnimationFrame(() => {
            searchInputRef.current?.focus();
        });
    }, []);

    useEffect(() => {
        focusSearchInput();
    }, [focusSearchInput]);

    const handleGoBack = useCallback(() => {
        setCategoryFilter(null);
        onSearchValueChange("");
        focusSearchInput();
    }, [onSearchValueChange, focusSearchInput]);

    const handleItemSelect = useCallback(
        async (item: ICommandPanelItem) => {
            const enterCategory = item.metadata?.enterCategory as CategoryFilter;
            if (enterCategory) {
                setCategoryFilter(enterCategory);
                onSearchValueChange("");
                return;
            }

            await executeAction(item);
        },
        [executeAction, onSearchValueChange],
    );

    // Keyboard: Escape layers only
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();

                if (categoryFilter) {
                    handleGoBack();
                    return;
                }

                if (searchValue.trim().length > 0) {
                    onSearchValueChange("");
                    return;
                }

                onClose?.();
                return;
            }
        };

        window.addEventListener("keydown", handleKeyDown, {capture: true});
        return () => window.removeEventListener("keydown", handleKeyDown, {capture: true});
    }, [searchValue, onSearchValueChange, onClose, categoryFilter, handleGoBack]);

    return (
        <div className="h-full w-full bg-background flex flex-col rounded-lg overflow-hidden relative">
            <Command value={selectedValue} onValueChange={setSelectedValue} shouldFilter={false} className="flex flex-col h-full">
                <div className="relative flex-shrink-0">
                    {categoryFilter && (
                        <button
                            onClick={handleGoBack}
                            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-1 rounded-md hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                        >
                            <IconView icon="ArrowLeft" className="h-4 w-4" />
                        </button>
                    )}
                    <CommandInput
                        ref={searchInputRef}
                        placeholder={categoryFilter ? `Search ${categoryFilter.toLowerCase()}...` : "Type a command or search..."}
                        value={searchValue}
                        onValueChange={onSearchValueChange}
                        className={categoryFilter ? "pl-10" : ""}
                    />
                </div>

                {/* Content area */}
                <div className="flex-1 overflow-hidden flex">
                    {/* List */}
                    <div className={cn("flex flex-col min-w-0 overflow-hidden transition-all duration-200", showPreview ? "w-[40%]" : "w-full")}>
                        <CommandList className="overflow-y-auto px-1 py-1 flex-1">
                            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No results found.</CommandEmpty>
                            {groupedItems.map((group) => (
                                <CommandGroup heading={group.name} key={group.name}>
                                    {group.items.map((item) => (
                                        <CommandItem
                                            key={item.id}
                                            value={item.label}
                                            keywords={item.keywords}
                                            className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer aria-selected:bg-accent/50 transition-colors"
                                            onSelect={() => handleItemSelect(item)}
                                        >
                                            <IconView icon={item.icon} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            <span className="text-sm truncate flex-1 min-w-0">{item.label}</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            ))}
                        </CommandList>
                    </div>

                    {/* Preview panel */}
                    {showPreview && (
                        <div className="w-[60%] border-l border-border/50 overflow-hidden">
                            <CommandPanelPreview item={selectedItem} />
                        </div>
                    )}
                </div>
            </Command>

            {/* Footer */}
            {selectedItem?.actions?.[0] && (
                <div className="px-4 py-1 border-t border-border/50 bg-muted/20 flex items-center justify-end">
                    <span className="text-[10px] text-muted-foreground/50">{selectedItem.actions[0].label}</span>
                </div>
            )}
        </div>
    );
}
