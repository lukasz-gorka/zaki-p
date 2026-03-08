import {useEffect, useState} from "react";

export function formatElapsedTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const secondsStr = seconds < 10 ? ` ${seconds}s` : `${seconds}s`;

    if (minutes > 0) {
        return `${minutes}m ${secondsStr}`;
    }
    return secondsStr;
}

export function useElapsedTimer(startTime: number | undefined, active: boolean): number {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!active || !startTime) {
            setElapsed(0);
            return;
        }

        const initialElapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsed(initialElapsed);

        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [active, startTime]);

    return elapsed;
}
