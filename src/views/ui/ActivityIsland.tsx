import {X} from "lucide-react";
import type {Activity} from "../../activities/ActivityRegistry.ts";
import {useSkillActivities} from "../../activities/useSkillActivities.ts";
import {useVoiceActivities} from "../../activities/useVoiceActivities.ts";
import {formatElapsedTime, useElapsedTimer} from "../../hooks/useElapsedTimer.ts";

const COLOR_MAP: Record<Activity["color"], {dot: string; text: string}> = {
    red: {dot: "bg-red-500", text: "text-red-500"},
    blue: {dot: "bg-blue-500", text: "text-blue-500"},
    purple: {dot: "bg-purple-500", text: "text-purple-500"},
    green: {dot: "bg-green-500", text: "text-green-500"},
    amber: {dot: "bg-amber-500", text: "text-amber-500"},
};

function ActivityRow({activity}: {activity: Activity}) {
    const colors = COLOR_MAP[activity.color];
    const elapsed = useElapsedTimer(activity.startTime, true);

    return (
        <div className="flex items-center gap-2.5 px-4 py-1.5">
            <span className={`relative flex h-2.5 w-2.5`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors.dot} opacity-75`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colors.dot}`} />
            </span>
            <span className={`text-xs font-medium ${colors.text}`}>{activity.label}</span>
            {activity.startTime && <span className="text-xs font-mono text-muted-foreground">{formatElapsedTime(elapsed)}</span>}
            <div className="flex-1" />
            {activity.cancelable && activity.onCancel && (
                <button onClick={activity.onCancel} className="p-0.5 rounded-full hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}

export function ActivityIsland() {
    const voiceActivities = useVoiceActivities();
    const skillActivities = useSkillActivities();
    const activities = [...voiceActivities, ...skillActivities];

    if (activities.length === 0) return null;

    const isMulti = activities.length > 1;

    return (
        <div
            className={`fixed top-2 left-1/2 -translate-x-1/2 z-[9999] bg-background/95 backdrop-blur-md border border-border/60 shadow-lg transition-all duration-300 ${isMulti ? "rounded-2xl" : "rounded-full"}`}
        >
            {activities.map((activity, i) => (
                <div key={activity.id}>
                    {i > 0 && <div className="mx-3 border-t border-border/40" />}
                    <ActivityRow activity={activity} />
                </div>
            ))}
        </div>
    );
}
