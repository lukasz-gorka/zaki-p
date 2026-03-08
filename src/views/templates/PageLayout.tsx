import {ReactNode} from "react";
import {cn} from "../ui/lib/utils.ts";
import {PageContentWrapperView} from "./PageContentWrapperView.tsx";

export interface PageLayoutProps {
    children: ReactNode;
    header?: ReactNode;
    footer?: ReactNode;
    absoluteContent?: ReactNode;
    isProtected?: boolean;
    maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
    className?: string;
}

export function PageLayout({children, header, footer, maxWidth = "xl", className, absoluteContent}: PageLayoutProps) {
    const maxWidthClasses = {
        sm: "max-w-2xl",
        md: "max-w-4xl",
        lg: "max-w-5xl",
        xl: "max-w-6xl",
        full: "max-w-full",
    };

    return (
        <div className="flex flex-col h-full w-full overflow-hidden relative">
            {absoluteContent}
            {header && <header className="flex h-14 items-center p-2 ml-12">{header}</header>}
            <main className={cn("flex-1 overflow-auto", className)}>
                <div className={cn("mx-auto w-full h-full p-6", maxWidthClasses[maxWidth])}>
                    <PageContentWrapperView>{children}</PageContentWrapperView>
                </div>
            </main>
            {footer && <footer className="border-t border-border p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">{footer}</footer>}
        </div>
    );
}
