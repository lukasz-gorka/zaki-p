import {Switch} from "../ui/switch.tsx";

interface IFormSwitchUi {
    value: boolean;
    label: string;
    description?: string;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
}

export function FormSwitchUI(props: IFormSwitchUi) {
    const {value, label, onValueChange, description, disabled = false} = props;

    return (
        <div className="space-y-1 flex gap-4 w-full flex-row items-center justify-between">
            <div className="flex flex-col gap-1">
                <p>{label}</p>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            <Switch checked={value} onCheckedChange={(value) => onValueChange(value)} disabled={disabled} />
        </div>
    );
}
