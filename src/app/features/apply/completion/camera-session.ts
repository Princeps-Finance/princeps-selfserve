import { isLowMemoryDevice } from './device-capabilities';

export interface Recording {
  blob: Blob;
  mime: string;
}

const MAX_RECORDING_SECONDS = 30;
const lowMemoryDevice = isLowMemoryDevice();
const frameSize = lowMemoryDevice ? 480 : 720;
const videoBitsPerSecond = lowMemoryDevice ? 700_000 : 2_000_000;

export class CameraSession {
  private stream: MediaStream | null = null;
  private generation = 0;
  private recorder: MediaRecorder | null = null;
  private recordingTimer?: ReturnType<typeof setInterval>;

  async open(withAudio: boolean): Promise<MediaStream> {
    this.close();
    const generation = this.generation;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: frameSize }, height: { ideal: frameSize } },
      audio: withAudio,
    });
    if (generation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop());
      throw new DOMException('The camera request was cancelled.', 'AbortError');
    }
    this.stream = stream;
    return stream;
  }

  async snapshot(video: HTMLVideoElement): Promise<Blob | null> {
    if (!video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(video, 0, 0);
    return new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', lowMemoryDevice ? 0.75 : 0.85),
    );
  }

  async startRecording(onTick: (seconds: number) => void): Promise<Recording> {
    if (!this.stream || this.recorder) throw new Error('The camera is unavailable for recording.');
    const recorder = this.createRecorder(this.stream);
    const chunks: Blob[] = [];

    return new Promise<Recording>((resolve, reject) => {
      const detach = () => {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        if (this.recorder === recorder) {
          this.clearRecordingTimer();
          this.recorder = null;
        }
      };
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        detach();
        const mime = recorder.mimeType || 'video/webm';
        resolve({ blob: new Blob(chunks, { type: mime }), mime });
      };
      recorder.onerror = () => {
        detach();
        reject(new Error('The browser stopped recording.'));
      };
      try {
        recorder.start();
      } catch (error) {
        detach();
        reject(error);
        return;
      }
      this.recorder = recorder;
      const startedAt = Date.now();
      this.recordingTimer = setInterval(() => {
        const seconds = Math.min(
          MAX_RECORDING_SECONDS,
          Math.floor((Date.now() - startedAt) / 1000),
        );
        onTick(seconds);
        if (seconds >= MAX_RECORDING_SECONDS) this.stopRecording();
      }, 1000);
    });
  }

  stopRecording(): void {
    this.clearRecordingTimer();
    const recorder = this.recorder;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  close(): void {
    this.generation++;
    this.stopRecording();
    this.recorder = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  private createRecorder(stream: MediaStream): MediaRecorder {
    try {
      return new MediaRecorder(stream, { mimeType: 'video/webm', videoBitsPerSecond });
    } catch {
      try {
        return new MediaRecorder(stream, { videoBitsPerSecond });
      } catch {
        return new MediaRecorder(stream);
      }
    }
  }

  private clearRecordingTimer(): void {
    clearInterval(this.recordingTimer);
    this.recordingTimer = undefined;
  }
}
