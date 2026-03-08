import {Logger} from "../../logger/Logger.ts";

export class AudioPlayer {
    private audioContext: AudioContext | null = null;
    private currentSource: AudioBufferSourceNode | null = null;

    public async play(audioData: Uint8Array): Promise<void> {
        this.stop();

        this.audioContext = new AudioContext();
        const arrayBuffer = audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength) as ArrayBuffer;
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        return new Promise<void>((resolve, reject) => {
            const source = this.audioContext!.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext!.destination);
            this.currentSource = source;

            source.onended = () => {
                this.currentSource = null;
                resolve();
            };

            try {
                source.start(0);
            } catch (error) {
                this.currentSource = null;
                reject(error);
            }
        });
    }

    public stop(): void {
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch {
                // Already stopped
            }
            this.currentSource = null;
        }

        if (this.audioContext) {
            this.audioContext.close().catch((e) => Logger.warn("[AudioPlayer] Failed to close audio context", {error: e}));
            this.audioContext = null;
        }
    }
}
