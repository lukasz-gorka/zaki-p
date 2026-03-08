import {cn} from "../ui/lib/utils.ts";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "../ui/select.tsx";
import {FormLabelUI} from "./FormLabelUI.tsx";

interface IFormSelectUI {
    value: string;
    onValueChange(value: string): void;
    placeholder?: string;
    label?: string;
    disabled?: boolean;
    items: {
        value: string;
        name: string;
    }[];
}

export function FormSelectUI(props: Readonly<IFormSelectUI>) {
    const {value, onValueChange, items, disabled, placeholder, label} = props;

    return (
        <div className="flex flex-col gap-2">
            <FormLabelUI>{label}</FormLabelUI>
            <Select value={value} onValueChange={(newValue) => onValueChange(newValue)} disabled={disabled}>
                <SelectTrigger className={cn("w-[300px]")}>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {items.map(({value, name}) => (
                        <SelectItem key={value} value={value}>
                            {name || value}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
