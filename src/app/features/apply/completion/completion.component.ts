import { IconComponent } from '../../../shared/components/icon.component';
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  telLink,
  whatsappLink,
} from '../../support/support-contacts';
import type { PhotoWarning } from './document-photo-quality';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IllustrationComponent } from '../../../shared/components/illustration.component';
import { WhyAskComponent } from '../../../shared/components/why-ask.component';
import { WizardProgressComponent } from '../wizard-progress.component';
import { AnimatedIconComponent } from '../../../shared/components/animated-icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApplicationStore } from '../state/application.store';
import { ApplicationApi } from '../data-access/application.api';
import { ApplicationSession } from '../../../core/session/application-session.service';
import { ButtonDirective } from '@princeps-finance/ui';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { CameraSession } from './camera-session';
import * as ApplicationContract from '../data-access/application-contract';

@Component({
  selector: 'app-completion',
  imports: [
    SpinnerComponent,
    IconComponent,
    IllustrationComponent,
    WhyAskComponent,
    WizardProgressComponent,
    AnimatedIconComponent,
    ReactiveFormsModule,
    ButtonDirective,
    DialogComponent,
    RouterLink,
    TPipe,
  ],
  templateUrl: './completion.component.html',
  styleUrl: '../apply-step.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:focus)': 'refreshIdentityOnReturn()',
    '(document:visibilitychange)': 'refreshIdentityOnReturn()',
  },
})
export class CompletionComponent {
  readonly store = inject(ApplicationStore);
  private readonly api = inject(ApplicationApi);
  private readonly session = inject(ApplicationSession);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly page = inject(ActivatedRoute).snapshot.data['page'] as string;
  readonly titleKey =
    (
      {
        documents: 'step.docs.title',
        'offer-letter': 'step.offerletter.title',
        mandate: 'step.mandate.title',
        submit: 'step.submit.title',
      } as Record<string, string>
    )[this.page] ?? 'application.title.' + this.page;
  readonly stagePosition = (
    {
      documents: 11,
      'verify-identity': 12,
      'offer-letter': 12,
      mandate: 13,
      submit: 14,
    } as Record<string, number>
  )[this.page];
  readonly progressLabel =
    (
      {
        documents: 'step.docs.eyebrow',
        'verify-identity': 'step.verify.eyebrow',
        'offer-letter': 'step.offerletter.title',
      } as Record<string, string>
    )[this.page] ?? 'step.' + this.page + '.eyebrow';
  readonly documents = signal<ApplicationContract.DocumentStatusDto | null>(null);
  readonly identity = signal<ApplicationContract.IdentityStatusDto | null>(null);
  readonly identityDone = computed(() => this.identity()?.done ?? false);
  readonly digisignAvailable = computed(() => this.identity()?.digisignAvailable ?? false);
  readonly canContinue = computed(() =>
    this.page === 'verify-identity'
      ? this.identityDone()
      : !!this.documents() && this.missing().length === 0,
  );
  readonly letter = signal<ApplicationContract.OfferLetterResponseDto | null>(null);
  readonly mandates = signal<ApplicationContract.MandatesResponseDto | null>(null);
  readonly awaitingStatus = signal(false);
  readonly status = signal<ApplicationContract.SubmissionStatusDto | null>(null);
  readonly copyState = signal<'copied' | 'failed' | null>(null);
  readonly supportEmail = SUPPORT_EMAIL;
  readonly supportPhone = SUPPORT_PHONE;
  readonly supportTel = telLink();
  readonly supportWhatsApp = whatsappLink();
  readonly checkingPhoto = signal(false);
  readonly photoWarning = signal<{
    file: File;
    type: ApplicationContract.PresignDocumentDto['documentType'];
    warning: PhotoWarning;
  } | null>(null);
  readonly letterOpen = signal(false);
  readonly letterRead = signal(false);
  readonly agreed = new FormControl(false, {
    nonNullable: true,
    validators: Validators.requiredTrue,
  });
  readonly agreedForm = new FormGroup({ agreed: this.agreed });
  readonly submitted = new FormControl(false, {
    nonNullable: true,
    validators: Validators.requiredTrue,
  });
  readonly submittedForm = new FormGroup({ submitted: this.submitted });
  private readonly cameraStream = signal<MediaStream | null>(null);
  readonly cameraOpen = computed(() => this.cameraStream() !== null);
  readonly uploadType = signal<ApplicationContract.PresignDocumentDto['documentType'] | null>(null);
  readonly recording = signal(false);
  readonly seconds = signal(0);
  readonly captureType = signal<'selfie-with-id' | 'terms-video'>('selfie-with-id');
  readonly required = computed(() => this.documents()?.required ?? []);
  readonly missing = computed(() => this.documents()?.missing ?? []);
  private readonly viewport = viewChild<ElementRef<HTMLElement>>('letterViewport');
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('cameraVideo');
  private readonly camera = new CameraSession();
  private awaitingDigiSignReturn = false;
  private identityPoll?: ReturnType<typeof setTimeout>;
  private poll?: ReturnType<typeof setTimeout>;
  constructor() {
    effect(() => {
      if (this.letterRead()) this.agreed.enable({ emitEvent: false });
      else this.agreed.disable({ emitEvent: false });
    });
    this.destroy.onDestroy(() => {
      clearTimeout(this.poll);
      clearTimeout(this.identityPoll);
      this.closeCamera();
    });
    this.session.cancelled.pipe(takeUntilDestroyed()).subscribe(() => {
      clearTimeout(this.poll);
      clearTimeout(this.identityPoll);
      this.closeCamera();
      this.photoWarning.set(null);
      this.checkingPhoto.set(false);
    });
    afterRenderEffect((cleanup) => {
      const video = this.video()?.nativeElement;
      const stream = this.cameraStream();
      if (!video || !stream) return;
      video.srcObject = stream;
      void video.play().catch(() => undefined);
      cleanup(() => {
        video.srcObject = null;
      });
    });
    afterRenderEffect((cleanup) => {
      const element = this.viewport()?.nativeElement;
      if (!element) return;
      const check = () => {
        if (
          element.clientHeight > 0 &&
          element.scrollHeight - element.clientHeight - element.scrollTop <= 8
        )
          this.letterRead.set(true);
      };
      check();
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(check);
        observer.observe(element);
        cleanup(() => observer.disconnect());
      }
    });
    if (this.page === 'verify-identity') void this.loadIdentity();
    else void this.load();
  }
  async load() {
    const result = await this.store.run('completion-load', async () => {
      if (this.page === 'documents') return { documents: await this.api.getDocuments() };
      if (this.page === 'offer-letter') return { letter: await this.api.getOfferLetter() };
      if (this.page === 'mandate') return { mandates: await this.api.mandates() };
      if (this.page === 'status') return { status: await this.api.getSubmissionStatus() };
      return { application: await this.store.refresh() };
    });
    if (!result || this.destroy.destroyed) return;
    if (result.documents) this.documents.set(result.documents);
    if (result.letter) {
      this.letter.set(result.letter);
      this.letterRead.set(false);
      this.agreed.reset();
    }
    if (result.mandates) {
      this.mandates.set(result.mandates);
      this.schedulePoll();
    }
    if (result.status) {
      if (result.status.reference !== this.status()?.reference) this.copyState.set(null);
      this.status.set(result.status);
    }
  }
  async loadIdentity(start = false) {
    if (this.store.pending()['identity']) return;
    clearTimeout(this.identityPoll);
    const result = await this.store.run('identity', () =>
      start ? this.api.startIdentityVerification() : this.api.getIdentityStatus(),
    );
    if (!result || this.destroy.destroyed) return;
    this.identity.set(result);
    this.scheduleIdentityPoll();
    return result;
  }
  async startDigiSign() {
    if (this.store.pending()['identity']) return;
    // Reserve the tab during the click so the browser allows navigation after the API responds.
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    const closePendingTab = this.destroy.onDestroy(() => tab?.close());
    try {
      const identity = await this.loadIdentity(true);
      if (!tab || tab.closed) return;
      if (identity?.status === 'PENDING' && identity.signingUrl) {
        tab.location.replace(identity.signingUrl);
        this.markDigiSignOpened();
      } else {
        tab.close();
      }
    } finally {
      closePendingTab();
    }
  }
  markDigiSignOpened(): void {
    this.awaitingDigiSignReturn = true;
  }
  protected refreshIdentityOnReturn(): void {
    if (
      !this.awaitingDigiSignReturn ||
      document.visibilityState !== 'visible' ||
      this.store.pending()['identity']
    )
      return;
    this.awaitingDigiSignReturn = false;
    if (!this.identityDone()) void this.loadIdentity();
  }
  private scheduleIdentityPoll() {
    const identity = this.identity();
    if (
      this.destroy.destroyed ||
      this.identityDone() ||
      (identity?.status !== 'PENDING' && identity?.status !== 'REVIEW')
    )
      return;
    this.identityPoll = setTimeout(() => {
      if (document.visibilityState === 'visible') void this.loadIdentity();
      else this.scheduleIdentityPoll();
    }, 5000);
  }
  async upload(event: Event, type: ApplicationContract.PresignDocumentDto['documentType']) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.checkingPhoto() || this.store.pending()['upload']) return;
    this.photoWarning.set(null);
    this.store.clearError('upload');
    this.uploadType.set(type);
    if (file.type.startsWith('image/') && (type === 'gov-id' || type === 'payslip')) {
      this.checkingPhoto.set(true);
      const generation = this.session.generation();
      let warning: PhotoWarning | null = null;
      try {
        const { inspectDocumentPhoto } = await import('./document-photo-quality');
        warning = await inspectDocumentPhoto(file);
      } catch {
        // The server still checks the file when the photo check is unavailable.
      }
      if (this.destroy.destroyed || generation !== this.session.generation()) return;
      this.checkingPhoto.set(false);
      if (warning) {
        this.photoWarning.set({ file, type, warning });
        return;
      }
    }
    await this.uploadFile(file, type);
  }

  async uploadPhotoAnyway() {
    const pending = this.photoWarning();
    if (!pending || this.store.pending()['upload']) return;
    this.photoWarning.set(null);
    await this.uploadFile(pending.file, pending.type);
  }

  async copyReference(reference: string) {
    try {
      await navigator.clipboard.writeText(reference);
      if (!this.destroy.destroyed && this.status()?.reference === reference)
        this.copyState.set('copied');
    } catch {
      if (!this.destroy.destroyed && this.status()?.reference === reference)
        this.copyState.set('failed');
    }
  }

  async uploadFile(file: File, type: ApplicationContract.PresignDocumentDto['documentType']) {
    if (this.store.pending()['upload']) return;
    this.uploadType.set(type);
    const result = await this.store.run('upload', () => this.api.uploadDocument(file, type));
    if (result && !this.destroy.destroyed) this.documents.set(result);
  }
  async next() {
    if (
      !this.canContinue() ||
      this.recording() ||
      this.checkingPhoto() ||
      Object.entries(this.store.pending()).some(([key, value]) => key === 'upload' && value)
    )
      return;
    const app = await this.store.run('refresh', () => this.store.refresh());
    if (app && !this.destroy.destroyed)
      await this.router.navigateByUrl(
        this.page === 'documents'
          ? '/apply/verify-identity'
          : app.steps.offerLetter.status === 'DONE'
            ? this.store.nextRoute()
            : '/apply/offer-letter',
      );
  }
  scroll(event: Event) {
    const viewport = event.target as HTMLElement;
    if (viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 8)
      this.letterRead.set(true);
  }
  async acceptLetter() {
    this.agreed.markAsTouched();
    const letter = this.letter();
    if (!letter || !this.letterRead() || this.agreed.invalid) return;
    const accepted = await this.store.save('letter-accept', () =>
      this.api.acceptOfferLetter(letter.hash),
    );
    if (this.destroy.destroyed) return;
    if (accepted) {
      this.letterOpen.set(false);
      await this.router.navigateByUrl('/apply/mandate');
    } else if (this.store.errors()['letter-accept']?.code === 'OFFER_LETTER_CHANGED') {
      await this.load();
    }
  }
  async setupMandates() {
    const result = await this.store.run('mandates', () => this.api.mandates(true));
    if (result && !this.destroy.destroyed) {
      this.mandates.set(result);
      this.schedulePoll();
    }
  }
  private schedulePoll() {
    clearTimeout(this.poll);
    if (
      this.page !== 'mandate' ||
      this.mandates()?.complete ||
      !this.mandates()?.mandates.length ||
      this.destroy.destroyed
    )
      return;
    this.poll = setTimeout(async () => {
      if (document.visibilityState !== 'visible') {
        this.schedulePoll();
        return;
      }
      const result = await this.store.run('mandates-poll', () => this.api.mandates());
      if (result && !this.destroy.destroyed) {
        this.mandates.set(result);
        this.schedulePoll();
      }
    }, 5000);
  }
  async afterMandates() {
    if (!this.mandates()?.complete) return;
    if ((await this.store.run('refresh', () => this.store.refresh())) && !this.destroy.destroyed)
      await this.router.navigateByUrl('/apply/submit');
  }
  async submit() {
    this.submitted.markAsTouched();
    if (this.submitted.invalid || this.awaitingStatus()) return;
    const result = await this.store.run('submit', () => this.api.submitApplication());
    if (this.destroy.destroyed) return;
    if (result) {
      this.status.set(result);
      await this.router.navigateByUrl('/apply/status');
    } else {
      const error = this.store.errors()['submit'];
      this.awaitingStatus.set(!!error && (error.status === 0 || error.status >= 500));
    }
  }
  async checkStatus() {
    const result = await this.store.run('status', () => this.api.getSubmissionStatus());
    if (result && !this.destroy.destroyed) {
      this.status.set(result);
      this.awaitingStatus.set(false);
      this.store.clearError('submit');
      if (result.status !== 'DRAFT') await this.router.navigateByUrl('/apply/status');
    }
  }
  async openCamera(type: 'selfie-with-id' | 'terms-video') {
    this.captureType.set(type);
    const generation = this.session.generation();
    const stream = await this.store.run('camera', () => this.camera.open(type === 'terms-video'));
    if (!stream) return;
    if (this.destroy.destroyed || generation !== this.session.generation()) {
      this.camera.close();
      return;
    }
    this.cameraStream.set(stream);
  }
  async takePhoto() {
    const video = this.video()?.nativeElement;
    if (!video) return;
    const generation = this.session.generation();
    const photo = this.camera.snapshot(video);
    this.closeCamera();
    const blob = await photo;
    if (blob && !this.destroy.destroyed && generation === this.session.generation()) {
      await this.uploadFile(
        new File([blob], 'selfie.jpg', { type: 'image/jpeg' }),
        'selfie-with-id',
      );
    }
  }
  private closeCamera(): void {
    this.camera.close();
    this.cameraStream.set(null);
  }
  async record() {
    if (this.recording() || !this.cameraOpen()) return;
    this.seconds.set(0);
    this.recording.set(true);
    const result = await this.store.run('recording', () =>
      this.camera.startRecording((value) => this.seconds.set(value)),
    );
    this.recording.set(false);
    this.closeCamera();
    if (result && !this.destroy.destroyed)
      await this.uploadFile(
        new File([result.blob], result.mime.includes('mp4') ? 'terms.mp4' : 'terms.webm', {
          type: result.mime.split(';')[0],
        }),
        'terms-video',
      );
  }
  stopRecording() {
    this.camera.stopRecording();
  }
  finish() {
    this.store.reset();
    void this.router.navigateByUrl('/apply/welcome');
  }
}
