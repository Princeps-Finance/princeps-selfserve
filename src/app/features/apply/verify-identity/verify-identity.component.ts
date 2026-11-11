import { AnimatedIconComponent } from '../../../shared/animated-icon.component';
import { ModalComponent } from '../../../shared/modal.component';
import { WhyAskComponent } from '../../../shared/why-ask.component';
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
import { formatNaira, spokenNaira } from '../../../core/money.util';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { logWarn } from '../../../core/log';
import { readAsDataUrl } from '../../../core/ui/file-data-url';
import { CameraSession } from './camera-session';

type Stage = 'intro' | 'face' | 'video' | 'review';

@Component({
  selector: 'app-verify-identity',
  imports: [AnimatedIconComponent, ModalComponent, WhyAskComponent, TPipe, WizardProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verify-identity.component.html',
  styleUrl: './verify-identity.component.css',
})
export class VerifyIdentityComponent implements OnDestroy {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
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

  /**
   * What the customer reads aloud on the video: three short sentences with the amount and the monthly repayment,
   * built from the same offer the customer accepted.
   */
  readonly scriptLines = computed<string[]>(() => {
    const o = this.offer();
    if (!o) return [];
    const p = {
      name: this.state.bvnIdentity()?.fullName ?? this.state.profile()?.fullName ?? '',
      product: o.productName,
      amount: spokenNaira(o.amount),
      months: String(o.tenorMonths),
      monthly: spokenNaira(o.monthlyRepayment),
    };
    return [1, 2, 3].map((n) => this.lang.t(`step.verify.script.l${n}`).replace(/\{(\w+)\}/g, (_, k: string) => (p as Record<string, string>)[k] ?? ''));
  });

  readonly attempted = signal(false);

  /** How the product wants the video provided. */
  private readonly videoMode = computed(
    () => productById(this.offer()?.productId ?? '')?.settings.identityVideo ?? 'record',
  );
  readonly canRecord = computed(() => this.videoMode() === 'record' || this.videoMode() === 'either');
  /** Set once recording has failed, so a customer whose phone cannot record can still send a video file. */
  private readonly uploadFallback = signal(false);
  readonly canUpload = computed(() => this.videoMode() === 'upload' || this.videoMode() === 'either' || this.uploadFallback());

  /** Why the help window is open (null: closed). It opens after any camera or video problem, so nobody is left stuck. */
  readonly trouble = signal<string | null>(null);
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  private fail(messageKey: string): void {
    this.isRecording.set(false);
    this.checkingVideo.set(false);
    this.clearWatchdog();
    this.uploadFallback.set(true);
    this.trouble.set(this.lang.t(messageKey));
  }

  private clearWatchdog(): void {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  /** "Try again" in the help window: start over from the camera for the step the customer is on. */
  retryAfterTrouble(): void {
    this.trouble.set(null);
    this.cameraError.set(null);
    this.videoDataUrl.set(null);
    this.revokePreview();
    this.videoPreviewUrl.set(null);
    if (this.stage() === 'face' || this.stage() === 'video') void this.startCamera(this.stage() === 'video');
  }

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
      this.fail('step.verify.upload.toolarge');
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
      this.fail(withAudio ? 'camera.error.av' : 'camera.error.v');
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

  /** Set when a picture or video is retaken from the review page: after it, the customer goes straight back to the review. */
  private fromReview = false;

  retakeFromReview(what: 'photo' | 'video'): void {
    this.fromReview = true;
    this.cameraError.set(null);
    if (what === 'photo') {
      this.facePhoto.set(null);
      this.stage.set('face');
      void this.startCamera(false);
    } else {
      this.stage.set('video');
      this.retakeVideo();
    }
  }

  proceedToVideo(): void {
    if (!this.facePhoto()) return;
    if (this.fromReview && this.videoDataUrl()) {
      this.fromReview = false;
      this.stage.set('review');
      return;
    }
    this.stage.set('video');
    void this.startCamera(true);
  }

  startRecording(): void {
    if (!this.camera.active) {
      this.fail('camera.error.av');
      return;
    }
    this.isRecording.set(true);
    this.recordSeconds.set(0);
    this.camera
      .startRecording((seconds) => this.recordSeconds.set(seconds))
      .then((clip) => {
        this.isRecording.set(false);
        this.camera.close();
        if (clip.blob.size === 0) {
          this.fail('toast.video.error');
          return;
        }
        this.showClip(clip.blob);
      })
      .catch((err) => {
        // Some browsers cannot record: say so instead of failing silently.
        logWarn('identity recording failed', err);
        this.fail('toast.video.error');
      });
  }

  stopRecording(): void {
    if (!this.isRecording()) return;
    this.checkingVideo.set(true);
    this.camera.stopRecording();
    // Some phones never finish saving the clip. Do not leave the customer on "Processing" for ever.
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      if (this.checkingVideo() && !this.videoDataUrl()) {
        this.camera.close();
        this.fail('troubleshoot.stuck');
      }
    }, 12_000);
  }

  /** Shows a clip (recorded or uploaded) in the preview and keeps its data for the submit step. */
  private showClip(clip: Blob): void {
    this.checkingVideo.set(true);
    this.revokePreview();
    this.videoPreviewUrl.set(URL.createObjectURL(clip));
    readAsDataUrl(clip)
      .then((dataUrl) => this.videoDataUrl.set(dataUrl))
      .catch(() => this.fail('toast.video.error'))
      .finally(() => {
        this.clearWatchdog();
        this.checkingVideo.set(false);
      });
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

  goReview(): void {
    this.fromReview = false;
    this.stage.set('review');
  }

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
    void this.flow.go(APPLY.offerLetter);
  }

  ngOnDestroy(): void {
    this.camera.close();
    this.clearWatchdog();
    this.revokePreview();
  }
}
