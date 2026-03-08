import {icons} from "lucide-react";

interface DynamicIconProps {
    name: string;
    className?: string;
    size?: number;
}

export function DynamicIcon({name, className, size}: DynamicIconProps) {
    const LucideIcon = icons[name as keyof typeof icons];
    if (!LucideIcon) return null;
    return <LucideIcon className={className} size={size} />;
}
