import {ReactNode} from "react";
import {Label} from "../ui/label.tsx";

interface IFormLabelUi {
    children: ReactNode;
}

export function FormLabelUI({children}: IFormLabelUi) {
    return <Label>{children}</Label>;
}
