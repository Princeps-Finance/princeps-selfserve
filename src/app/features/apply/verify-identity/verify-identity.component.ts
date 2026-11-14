import { ButtonDirective } from '../../../shared/components/button/button.directive';
import {
  ChangeDetectionStrategy,
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
import { logWarn } from '../../../core/log';
import { readAsDataUrl } from '../../../core/ui/file-data-url';
import { CameraSession } from './camera-session';

type Stage = 'intro' | 'face' | 'video' | 'review';

@Component({
  selector: 'app-verify-identity',
  imports: [ButtonDirective, TPipe, WizardProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verify-identity.component.html',
  styleUrl: './verify-identity.component.css',
})
export class VerifyIdentityComponent implements OnDestroy {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
  private readonly toast = inject(ToastService);
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

  private readonly camera = new CameraSession();

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
    this.showClip(file);
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
      const stream = await this.camera.open(withAudio);
      queueMicrotask(() => {
        if (this.previewRef) this.previewRef.nativeElement.srcObject = stream;
      });
    } catch (err) {
      logWarn('identity camera could not open', err);
      this.cameraError.set(this.lang.t(withAudio ? 'camera.error.av' : 'camera.error.v'));
    }
  }

  capturePhoto(): void {
    const video = this.previewRef?.nativeElement;
    if (!video || !this.camera.active) return;
    const photo = this.camera.snapshot(video);
    if (!photo) return;
    this.facePhoto.set(photo);
    this.camera.close();
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
    if (!this.camera.active) return;
    this.isRecording.set(true);
    this.recordSeconds.set(0);
    this.camera
      .startRecording((seconds) => this.recordSeconds.set(seconds))
      .then((clip) => {
        this.isRecording.set(false);
        this.camera.close();
        this.showClip(clip.blob);
      })
      .catch((err) => {
        // Some browsers cannot record: say so instead of failing silently.
        logWarn('identity recording failed', err);
        this.isRecording.set(false);
        this.toast.error(this.lang.t('toast.video.error'));
      });
  }

  stopRecording(): void {
    if (!this.isRecording()) return;
    this.checkingVideo.set(true);
    this.camera.stopRecording();
  }

  /** Shows a clip (recorded or uploaded) in the preview and keeps its data for the submit step. */
  private showClip(clip: Blob): void {
    this.checkingVideo.set(true);
    this.revokePreview();
    this.videoPreviewUrl.set(URL.createObjectURL(clip));
    readAsDataUrl(clip)
      .then((dataUrl) => this.videoDataUrl.set(dataUrl))
      .catch(() => this.toast.error(this.lang.t('toast.video.error')))
      .finally(() => this.checkingVideo.set(false));
  }

  retakeVideo(): void {
    this.videoDataUrl.set(null);
    this.revokePreview();
    this.videoPreviewUrl.set(null);
    void this.startCamera(true);
  }

  private revokePreview(): void {
    const url = this.videoPreviewUrl();
    if (url) URL.revokeObjectURL(url);
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

  ngOnDestroy(): void {
    this.camera.close();
    this.revokePreview();
  }
}
