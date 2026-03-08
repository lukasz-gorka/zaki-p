import type {LucideIcon} from "lucide-react";
import * as LucideIcons from "lucide-react";
import {FC, HTMLAttributes} from "react";
import {ILucideIcon} from "./interface/ILucideIcon.ts";

interface IIconView extends HTMLAttributes<HTMLDivElement> {
    className?: string;
    icon?: ILucideIcon;
    defaultIcon?: ILucideIcon;
}

function getIconComponent(icon: ILucideIcon | undefined): LucideIcon | null {
    if (!icon) return null;

    if (typeof icon === "string") {
        const IconComponent = (LucideIcons as unknown as Record<string, LucideIcon>)[icon];
        return IconComponent || null;
    }

    return icon;
}

export const IconView: FC<IIconView> = (props: IIconView) => {
    const {icon, defaultIcon, className} = props;

    const IconComponent = getIconComponent(icon);
    if (IconComponent) {
        return <IconComponent className={className} />;
    }

    const DefaultIconComponent = getIconComponent(defaultIcon);
    if (DefaultIconComponent) {
        return <DefaultIconComponent className={className} />;
    }

    return <></>;
};
