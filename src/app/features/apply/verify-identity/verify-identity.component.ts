import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { LangService } from '../../../core/i18n/lang.service';
import { productById } from '../../../core/products/products';
import { whatsappLink } from '../../../core/support';
import { ToastService } from '../../../core/toast/toast.service';
import { formatNaira } from '../../../core/money.util';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

type Stage = 'intro' | 'face' | 'video' | 'review';

@Component({
  selector: 'app-verify-identity',
  imports: [TPipe, WizardProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verify-identity.component.html',
  styleUrl: './verify-identity.component.css',
})
export class VerifyIdentityComponent implements OnDestroy {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly lang = inject(LangService);
  readonly helpLink = whatsappLink('Hello Princeps, I cannot complete the identity check and need help.');

  readonly formatNaira = formatNaira;
  readonly offer = this.state.offer;

  readonly stage = signal<Stage>('intro');
  readonly cameraError = signal<string | null>(null);
  readonly isRecording = signal(false);
  readonly checkingVideo = signal(false);
  readonly facePhoto = signal<string | null>(null);
  readonly videoDataUrl = signal<string | null>(null);
  readonly videoPreviewUrl = signal<string | null>(null);
  readonly recordSeconds = signal(0);

  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  /** What the browser really recorded: webm on Chrome/Android, mp4 on iPhone. */
  private recordedMime = 'video/webm';
  private recordTimer: ReturnType<typeof setInterval> | null = null;

  @ViewChild('preview') previewRef?: ElementRef<HTMLVideoElement>;

  readonly loanAmount = computed(() => this.offer()?.amount ?? 0);
  readonly monthlyRepayment = computed(() => this.offer()?.monthlyRepayment ?? 0);

  readonly attempted = signal(false);

  /** How the product wants the video provided. */
  private readonly videoMode = computed(
    () => productById(this.offer()?.productId ?? '')?.settings.identityVideo ?? 'record',
  );
  readonly canRecord = computed(() => this.videoMode() === 'record' || this.videoMode() === 'either');
  readonly canUpload = computed(() => this.videoMode() === 'upload' || this.videoMode() === 'either');

  private offerKey(): string {
    const o = this.offer();
    return o ? `${o.productId}|${o.amount}|${o.tenorMonths}|${o.monthlyRepayment}` : '';
  }

  /** Upload path: for products that allow a video file, or when recording is not possible. */
  onVideoFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      this.toast.error(this.lang.t('step.verify.upload.toolarge'));
      return;
    }
    this.checkingVideo.set(true);
    const prev = this.videoPreviewUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.videoPreviewUrl.set(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => {
      this.checkingVideo.set(false);
      this.videoDataUrl.set(reader.result as string);
      this.cdr.markForCheck();
    };
    reader.onerror = () => {
      this.checkingVideo.set(false);
      this.toast.error(this.lang.t('toast.video.error'));
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  readonly canContinue = computed(() =>
    this.facePhoto() !== null && this.videoDataUrl() !== null,
  );

  constructor() {
    let existing = this.state.identityVerification();
    // The video states the amount and repayment. If the offer changed since, record it again.
    if (existing && existing.offerKey !== this.offerKey()) {
      this.state.setIdentityVerification(null);
      existing = null;
    }
    if (existing) {
      this.facePhoto.set(existing.facePhotoDataUrl);
      this.videoDataUrl.set(existing.videoDataUrl);
      this.stage.set('review');
    }
  }

  begin(): void { this.stage.set('face'); void this.startCamera(false); }

  async startCamera(withAudio: boolean): Promise<void> {
    this.cameraError.set(null);
    try {
      this.stopStream();
      const constraints: MediaStreamConstraints = {
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: withAudio,
      };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      queueMicrotask(() => {
        if (this.previewRef && this.stream) {
          this.previewRef.nativeElement.srcObject = this.stream;
        }
      });
    } catch {
      this.cameraError.set(
        this.lang.t(withAudio ? 'camera.error.av' : 'camera.error.v'),
      );
    }
  }

  capturePhoto(): void {
    const video = this.previewRef?.nativeElement;
    if (!video || !this.stream) return;
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    this.facePhoto.set(dataUrl);
    this.stopStream();
  }

  retakePhoto(): void {
    this.facePhoto.set(null);
    void this.startCamera(false);
  }

  proceedToVideo(): void {
    if (!this.facePhoto()) return;
    this.stage.set('video');
    void this.startCamera(true);
  }

  startRecording(): void {
    if (!this.stream) return;
    this.recordedChunks = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(this.stream, { mimeType: 'video/webm' });
    } catch {
      recorder = new MediaRecorder(this.stream);
    }
    recorder.ondataavailable = (e) => { if (e.data.size > 0) this.recordedChunks.push(e.data); };
    recorder.onstop = () => this.onRecordingStopped();
    try {
      recorder.start();
    } catch {
      // Some browsers cannot record: say so instead of failing silently.
      this.toast.error(this.lang.t('toast.video.error'));
      return;
    }
    this.recordedMime = recorder.mimeType || 'video/webm';
    this.mediaRecorder = recorder;
    this.isRecording.set(true);
    this.recordSeconds.set(0);
    this.recordTimer = setInterval(() => {
      const next = this.recordSeconds() + 1;
      this.recordSeconds.set(next);
      if (next >= 30) this.stopRecording();
    }, 1000);
  }

  stopRecording(): void {
    if (!this.mediaRecorder || !this.isRecording()) return;
    this.mediaRecorder.stop();
    this.isRecording.set(false);
    this.checkingVideo.set(true);
    if (this.recordTimer) { clearInterval(this.recordTimer); this.recordTimer = null; }
  }

  private onRecordingStopped(): void {
    const blob = new Blob(this.recordedChunks, { type: this.recordedMime });
    const prev = this.videoPreviewUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.videoPreviewUrl.set(URL.createObjectURL(blob));
    this.stopStream();
    const reader = new FileReader();
    reader.onload = () => {
      this.checkingVideo.set(false);
      this.videoDataUrl.set(reader.result as string);
      this.cdr.markForCheck();
    };
    reader.onerror = () => {
      this.checkingVideo.set(false);
      this.toast.error(this.lang.t('toast.video.error'));
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(blob);
  }

  retakeVideo(): void {
    this.videoDataUrl.set(null);
    const prev = this.videoPreviewUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.videoPreviewUrl.set(null);
    void this.startCamera(true);
  }

  goReview(): void { this.stage.set('review'); }

  confirm(): void {
    if (!this.canContinue()) {
      this.attempted.set(true);
      setTimeout(() => document.getElementById('identity-error')?.focus());
      return;
    }
    this.state.setIdentityVerification({
      facePhotoDataUrl: this.facePhoto()!,
      videoDataUrl: this.videoDataUrl()!,
      capturedAt: new Date().toISOString(),
      offerKey: this.offerKey(),
    });
    void this.flow.go(APPLY.mandate);
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  ngOnDestroy(): void {
    this.stopStream();
    if (this.recordTimer) clearInterval(this.recordTimer);
    const prev = this.videoPreviewUrl();
    if (prev) URL.revokeObjectURL(prev);
  }
}
