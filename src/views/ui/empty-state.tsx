import {LucideIcon} from "lucide-react";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
}

export function EmptyState({icon: Icon, title, description}: EmptyStateProps) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Icon className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-semibold mb-2">{title}</p>
            <p className="text-sm">{description}</p>
        </div>
    );
}
