import {NotificationSoundName} from "./NotificationSoundName.ts";

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new AudioContext();
    }
    return audioContext;
}

function playBeep(frequency: number, duration: number, volume: number): void {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;

    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
}

function playChord(frequencies: number[], duration: number, volume: number): void {
    for (const freq of frequencies) {
        playBeep(freq, duration, volume);
    }
}

function playSequence(notes: {freq: number; dur: number}[], volume: number): void {
    const ctx = getAudioContext();
    let offset = 0;
    for (const note of notes) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.type = "sine";
        oscillator.frequency.value = note.freq;
        gain.gain.value = volume;
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + note.dur);
        oscillator.start(ctx.currentTime + offset);
        oscillator.stop(ctx.currentTime + offset + note.dur);
        offset += note.dur * 0.8;
    }
}

export function playNotificationSound(soundType: NotificationSoundName): void {
    switch (soundType) {
        case NotificationSoundName.NONE:
            break;
        case NotificationSoundName.COMPLETE:
            playBeep(800, 0.3, 0.3);
            break;
        case NotificationSoundName.SUCCESS:
            playChord([523, 659, 784], 0.4, 0.06);
            break;
        case NotificationSoundName.ATTENTION:
            playBeep(1000, 0.1, 0.15);
            setTimeout(() => playBeep(1000, 0.1, 0.15), 150);
            break;
        case NotificationSoundName.BELL:
            playSequence(
                [
                    {freq: 1200, dur: 0.15},
                    {freq: 800, dur: 0.25},
                ],
                0.1,
            );
            break;
        case NotificationSoundName.CHIME:
            playSequence(
                [
                    {freq: 400, dur: 0.15},
                    {freq: 600, dur: 0.15},
                    {freq: 800, dur: 0.25},
                ],
                0.1,
            );
            break;
        case NotificationSoundName.GENTLE:
            playBeep(400, 0.4, 0.08);
            break;
        case NotificationSoundName.ALERT:
            playBeep(1500, 0.08, 0.2);
            setTimeout(() => playBeep(1500, 0.08, 0.2), 120);
            setTimeout(() => playBeep(1500, 0.08, 0.2), 240);
            break;
    }
}

export function playStartSound(): void {
    playBeep(800, 0.15, 0.05);
}

export function playStopSound(): void {
    playBeep(400, 0.15, 0.05);
}
