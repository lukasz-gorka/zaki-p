import {ChevronDown} from "lucide-react";
import {ReactNode, useState} from "react";
import {IconView} from "../../icons/IconView.tsx";
import {ILucideIcon} from "../../icons/interface/ILucideIcon.ts";
import {Badge} from "./badge.tsx";
import {Button} from "./button.tsx";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "./card.tsx";
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "./collapsible.tsx";
import {cn} from "./lib/utils.ts";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "./tooltip.tsx";

export interface SettingsCardAction {
    icon: ILucideIcon;
    onClick: () => void;
    tooltip: string;
    className?: string;
    isVisible?: boolean;
}

export interface SettingsCardBadge {
    text: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
    className?: string;
    isVisible?: boolean;
}

export interface SettingsCardProps {
    title: string;
    description: string;
    icon: ILucideIcon;
    iconColor?: string;
    badges?: SettingsCardBadge[];
    actions?: SettingsCardAction[];
    defaultOpen?: boolean;
    children: ReactNode;
    onOpenChange?: (open: boolean) => void;
    open?: boolean;
}

export function SettingsCard({
    title,
    description,
    icon,
    iconColor,
    badges = [],
    actions = [],
    defaultOpen = false,
    children,
    onOpenChange,
    open: controlledOpen,
}: SettingsCardProps) {
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

    const handleOpenChange = (newOpen: boolean) => {
        if (controlledOpen === undefined) {
            setInternalOpen(newOpen);
        }
        onOpenChange?.(newOpen);
    };

    const visibleBadges = badges.filter((badge) => badge.isVisible !== false);
    const visibleActions = actions.filter((action) => action.isVisible !== false);

    return (
        <Card className="rounded-md">
            <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <IconView icon={icon} className={`w-4 h-4 ${iconColor || ""}`} />
                                <div>
                                    <CardTitle className="text-md">{title}</CardTitle>
                                    <CardDescription className="text-xs">{description}</CardDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {visibleBadges.map((badge, index) => (
                                    <Badge key={index} variant={badge.variant || "secondary"} className={cn(badge.className, "text-[10px]")}>
                                        {badge.text}
                                    </Badge>
                                ))}
                                <TooltipProvider>
                                    {visibleActions.map((action, index) => (
                                        <Tooltip key={index}>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        action.onClick();
                                                    }}
                                                    className={cn("h-8 w-8 cursor-pointer", action.className)}
                                                >
                                                    <action.icon className="w-4 h-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{action.tooltip}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    ))}
                                </TooltipProvider>
                                <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                            </div>
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="space-y-4 p-4">{children}</CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}
