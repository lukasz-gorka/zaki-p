import {ILucideIcon} from "../../icons/interface/ILucideIcon.ts";
import {IItemAction} from "./IItemAction.ts";

export interface ICommandPanelItem {
    id: string;
    label: string;
    description?: string;
    icon?: ILucideIcon;
    category: string;
    keywords?: string[];
    metadata?: Record<string, any>;
    actions: IItemAction[];
    /** If true, show in main view regardless of category */
    showInMainView?: boolean;
}
