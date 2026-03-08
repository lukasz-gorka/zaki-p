import {useMemo, useCallback, useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {BASE_NAVIGATION, SETTINGS_NAVIGATION} from "../../navigation/const/BASE_NAVIGATION.ts";
import {PluginRegistry} from "../../plugins/PluginRegistry.ts";
import {CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from "../ui/command.tsx";

export function CommandPanel() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
        }

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, []);

    const handleSelect = useCallback(
        (path: string) => {
            navigate(path);
            setOpen(false);
        },
        [navigate],
    );

    const pluginNav = useMemo(() => PluginRegistry.getNavigation(), []);

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Navigation">
                    {BASE_NAVIGATION.map((item) => {
                        const Icon = item.icon;
                        return (
                            <CommandItem key={item.path} onSelect={() => handleSelect(item.path)}>
                                {Icon && <Icon className="mr-2 h-4 w-4" />}
                                <span>{item.label}</span>
                            </CommandItem>
                        );
                    })}
                </CommandGroup>
                <CommandGroup heading="Settings">
                    {SETTINGS_NAVIGATION.map((item) => {
                        const Icon = item.icon;
                        return (
                            <CommandItem key={item.path} onSelect={() => handleSelect(item.path)}>
                                {Icon && <Icon className="mr-2 h-4 w-4" />}
                                <span>{item.label}</span>
                            </CommandItem>
                        );
                    })}
                </CommandGroup>
                {pluginNav.length > 0 && (
                    <CommandGroup heading="Pro">
                        {pluginNav.map((item) => {
                            const Icon = item.icon;
                            return (
                                <CommandItem key={item.path} onSelect={() => handleSelect(item.path)}>
                                    {Icon && <Icon className="mr-2 h-4 w-4" />}
                                    <span>{item.label}</span>
                                </CommandItem>
                            );
                        })}
                    </CommandGroup>
                )}
            </CommandList>
        </CommandDialog>
    );
}
