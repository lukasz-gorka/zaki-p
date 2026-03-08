export interface Activity {
    id: string;
    label: string;
    color: "red" | "blue" | "purple" | "green" | "amber";
    startTime?: number;
    cancelable?: boolean;
    onCancel?: () => void;
}

export interface IActivitiesState {
    activities: Activity[];
}
