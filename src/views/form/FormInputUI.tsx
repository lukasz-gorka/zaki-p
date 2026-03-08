import {ChangeEvent, HTMLInputTypeAttribute, useState} from "react";
import {Input} from "../ui/input.tsx";
import {cn} from "../ui/lib/utils.ts";
import {FormLabelUI} from "./FormLabelUI.tsx";

interface IFormInputUi {
    label: string;
    value: string | undefined;
    description?: string;
    onChange: (value: string) => void;
    type?: HTMLInputTypeAttribute;
    secret?: boolean;
    isSecret?: boolean;
    visibleChars?: number;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

export function FormInputUI(props: IFormInputUi) {
    const {label, value, onChange, description, type, isSecret, visibleChars = 3, disabled = false, placeholder, className} = props;
    const [isFocused, setIsFocused] = useState(false);

    const getDescription = () => {
        if (!description) return;

        return <p className="text-sm text-muted-foreground">{description}</p>;
    };

    const onChangeHandler = (event: ChangeEvent<HTMLInputElement>) => {
        const {value} = event.target;

        onChange(value);
    };

    const handleFocus = () => {
        setIsFocused(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
    };

    const getDisplayValue = () => {
        if (isSecret && !isFocused && value) {
            return value.slice(0, visibleChars) + "...";
        }
        return value;
    };

    return (
        <div className={cn("space-y-2 flex-grow", className)}>
            <FormLabelUI>{label}</FormLabelUI>
            <Input
                type={type}
                value={getDisplayValue()}
                onChange={onChangeHandler}
                onFocus={handleFocus}
                onBlur={handleBlur}
                disabled={disabled}
                placeholder={placeholder}
                className="bg-transparent"
            />
            {getDescription()}
        </div>
    );
}
