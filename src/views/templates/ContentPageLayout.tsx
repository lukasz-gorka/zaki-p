import {LucideIcon, MoreVertical} from "lucide-react";
import {ReactNode} from "react";
import {Button} from "../ui/button.tsx";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "../ui/dropdown-menu.tsx";
import {PageLayout} from "./PageLayout.tsx";

export interface ContentPageLayoutProps {
    children: ReactNode;
    title: string;
    icon?: LucideIcon;
    description?: string;
    actions?: {label: string; icon?: LucideIcon; onClick: () => void; variant?: "default" | "destructive"}[];
    customActionButton?: ReactNode;
}

export function ContentPageLayout({children, title, icon: Icon, description, actions, customActionButton}: ContentPageLayoutProps) {
    return (
        <PageLayout
            maxWidth="full"
            className="bg-background"
            header={
                <div className="flex items-center justify-between w-full">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
                            <h1 className="text-lg font-semibold">{title}</h1>
                        </div>
                        {description && <p className="text-sm text-muted-foreground ml-7">{description}</p>}
                    </div>
                    {customActionButton ||
                        (actions && actions.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" title="Actions">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {actions.map((action, index) => (
                                        <DropdownMenuItem
                                            key={index}
                                            onClick={action.onClick}
                                            className={action.variant === "destructive" ? "text-destructive focus:text-destructive" : undefined}
                                        >
                                            {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                                            {action.label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ))}
                </div>
            }
        >
            <div className="flex justify-center w-full h-full">
                <div className="w-full max-w-lg h-full">{children}</div>
            </div>
        </PageLayout>
    );
}
