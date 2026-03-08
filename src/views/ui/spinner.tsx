import {Loader2} from "lucide-react";

import {cn} from "./lib/utils.ts";

const sizeMap = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-8 h-8",
    xl: "w-16 h-16",
} as const;

interface SpinnerProps {
    size?: keyof typeof sizeMap;
    className?: string;
}

export function Spinner({size = "md", className}: SpinnerProps) {
    return <Loader2 className={cn("animate-spin", sizeMap[size], className)} />;
}
