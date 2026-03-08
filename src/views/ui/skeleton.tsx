import {ComponentProps} from "react";
import {cn} from "./lib/utils.ts";

function Skeleton({className, ...props}: ComponentProps<"div">) {
    return <div data-slot="skeleton" className={cn("bg-muted rounded-md animate-pulse", className)} {...props} />;
}

export {Skeleton};
