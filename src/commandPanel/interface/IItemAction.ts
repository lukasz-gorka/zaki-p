import {ILucideIcon} from "../../icons/interface/ILucideIcon.ts";

export interface IItemAction {
    id: string;
    label: string;
    description?: string;
    shortcut?: string;
    icon?: ILucideIcon;
    destructive?: boolean;
    execute?: () => void | Promise<void>;
    onAction?: () => void | Promise<void>;
    group?: string;
}
