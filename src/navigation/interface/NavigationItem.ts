import {ILucideIcon} from "../../icons/interface/ILucideIcon.ts";

export interface NavigationItem {
    label: string;
    path: string;
    icon?: ILucideIcon;
    order?: number;
}
