/** A finished video clip and the format the browser actually recorded (webm on Chrome and Android, mp4 on iPhone). */
export interface Recording {
  blob: Blob;
  mime: string;
}

export const MAX_RECORDING_SECONDS = 30;

/**
 * The camera for one screen: opens it, takes a still, records a clip, and always lets go of the camera. It holds
 * no page state, so the screen only deals with what to show.
 */
export class CameraSession {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  /** The open camera stream, or null when closed. */
  get active(): MediaStream | null {
    return this.stream;
  }

  /** Opens the front camera (and the microphone when asked), closing any earlier stream first. Rejects if refused. */
  async open(withAudio: boolean): Promise<MediaStream> {
    this.close();
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
      audio: withAudio,
    });
    return this.stream;
  }

  /** A JPEG of the current video frame, or null when the frame cannot be drawn. */
  snapshot(video: HTMLVideoElement, quality = 0.85): string | null {
    const width = video.videoWidth || 720;
    const height = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  /**
   * Records until `stopRecording()` or the time limit. `onTick` gets the seconds so far. Resolves with the clip;
   * rejects when this browser cannot record.
   */
  startRecording(onTick: (seconds: number) => void): Promise<Recording> {
    const stream = this.stream;
    if (!stream) return Promise.reject(new Error('camera is not open'));
    const chunks: Blob[] = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    } catch {
      recorder = new MediaRecorder(stream);
    }
    return new Promise<Recording>((resolve, reject) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        this.clearTimer();
        const mime = recorder.mimeType || 'video/webm';
        resolve({ blob: new Blob(chunks, { type: mime }), mime });
      };
      try {
        recorder.start();
      } catch (err) {
        reject(err);
        return;
      }
      this.recorder = recorder;
      let seconds = 0;
      this.timer = setInterval(() => {
        onTick(++seconds);
        if (seconds >= MAX_RECORDING_SECONDS) this.stopRecording();
      }, 1000);
    });
  }

  stopRecording(): void {
    this.clearTimer();
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    this.recorder = null;
  }

  /** Lets go of the camera and microphone. Safe to call at any time. */
  close(): void {
    this.stopRecording();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private clearTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
