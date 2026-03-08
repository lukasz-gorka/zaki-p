import {useCallback, useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {Dialog, DialogContent, DialogTitle} from "../views/ui/dialog.tsx";
import {buildChatHistoryItems} from "./builders/buildChatHistoryItems.ts";
import {buildHistoryItems} from "./builders/buildHistoryItems.ts";
import {buildSkillItems} from "./builders/buildSkillItems.ts";
import {getCommandPanelItems} from "./CommandPanelActions.ts";
import {CommandPanelView} from "./view/CommandPanelView.tsx";

export function CommandPanelWrapper() {
    const [open, setOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "k" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
        }

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, []);

    const handleClose = useCallback(() => {
        setOpen(false);
        setSearchValue("");
    }, []);

    const items = useMemo(() => {
        if (!open) return [];
        return [
            ...getCommandPanelItems(navigate, handleClose),
            ...buildHistoryItems(handleClose),
            ...buildSkillItems(navigate, handleClose),
            ...buildChatHistoryItems(navigate, handleClose),
        ];
    }, [open, navigate, handleClose]);

    return (
        <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
            <DialogContent className="overflow-hidden p-0 shadow-lg max-w-xl h-[380px]">
                <DialogTitle className="sr-only">Command palette</DialogTitle>
                <CommandPanelView searchValue={searchValue} onSearchValueChange={setSearchValue} items={items} onClose={handleClose} />
            </DialogContent>
        </Dialog>
    );
}
