import {ChevronDown} from "lucide-react";
import {ReactNode, useState} from "react";
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "../../views/ui/collapsible.tsx";

interface SkillSingleCardProps {
    children: ReactNode;
    title: string;
    defaultOpen?: boolean;
}

export function SkillSingleCard({defaultOpen, children, title}: SkillSingleCardProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border border-muted rounded-xl">
            <CollapsibleTrigger asChild>
                <div className="flex items-center w-full justify-between rounded-md p-4 cursor-pointer">
                    <p className="text-sm">{title}</p>
                    <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="p-4 flex flex-col gap-2 w-full">{children}</div>
            </CollapsibleContent>
        </Collapsible>
    );
}
