import * as React from "react";

import {cn} from "./lib/utils.ts";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
    abbrTitle?: string;
}

const Kbd = React.forwardRef<HTMLElement, KbdProps>(({abbrTitle, className, children, ...props}, ref) => {
    if (abbrTitle) {
        return (
            <kbd
                ref={ref}
                className={cn(
                    "pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100",
                    className,
                )}
                {...props}
            >
                <abbr title={abbrTitle} className="no-underline">
                    {children}
                </abbr>
            </kbd>
        );
    }

    return (
        <kbd
            ref={ref}
            className={cn(
                "pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100",
                className,
            )}
            {...props}
        >
            {children}
        </kbd>
    );
});

Kbd.displayName = "Kbd";

export {Kbd};
