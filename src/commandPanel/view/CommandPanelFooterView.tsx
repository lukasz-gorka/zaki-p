import {Button} from "../../views/ui/button.tsx";
import {Kbd} from "../../views/ui/kbd.tsx";

export interface FooterAction {
    id: string;
    label: string;
    icon?: string;
    onAction: () => void;
    shortcut?: string;
    group?: string;
}

interface CommandPanelFooterProps {
    actions: FooterAction[];
}

export function CommandPanelFooterView({actions}: CommandPanelFooterProps) {
    if (actions.length === 0) return null;

    const primaryAction = actions[0];

    return (
        <div className="relative px-4 py-1 border-t border-border/50 bg-muted/20 flex items-center justify-end gap-2">
            {primaryAction && (
                <Button variant="ghost" size="sm" onClick={() => primaryAction.onAction()}>
                    {primaryAction.label}
                    <Kbd className="ml-2 rounded-md p-2">↵</Kbd>
                </Button>
            )}
            {actions.length > 1 && (
                <div className="flex items-center gap-1">
                    {actions.slice(1).map((action) => (
                        <Button key={action.id} variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => action.onAction()}>
                            {action.label}
                            {action.shortcut && <Kbd className="ml-1 rounded-md">{action.shortcut}</Kbd>}
                        </Button>
                    ))}
                </div>
            )}
        </div>
    );
}
