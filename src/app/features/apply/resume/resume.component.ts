import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TPipe } from '../../../core/i18n/t.pipe';
import { LangService } from '../../../core/i18n/lang.service';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { DraftData, DraftService } from '../../../core/application/draft.service';

/** Shown right after the OTP when this phone number has an application in progress. */
@Component({
  selector: 'app-resume',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (draft(); as d) {
      <section class="step">
        <h1 class="title">{{ 'resume.title' | t }}</h1>
        <p class="body">{{ 'resume.body' | t }}</p>
        <p class="saved">{{ 'resume.saved' | t: { when: when() } }}</p>
        <p class="note">{{ 'resume.note' | t }}</p>

        @if (!confirming()) {
          <button type="button" class="cta" (click)="continueDraft(d)">
            {{ 'resume.continue' | t: { step: stepLabel() } }}
          </button>
          <button type="button" class="alt" (click)="confirming.set(true)">{{ 'resume.start_over' | t }}</button>
        } @else {
          <p class="confirm" role="alert">{{ 'resume.confirm' | t }}</p>
          <button type="button" class="cta cta--danger" (click)="startOver()">{{ 'resume.confirm.yes' | t }}</button>
          <button type="button" class="alt" (click)="confirming.set(false)">{{ 'resume.confirm.no' | t }}</button>
        }
      </section>
    }
  `,
  styles: [
    `
      .step { display: flex; flex-direction: column; gap: var(--space-4); padding-top: var(--space-4); }
      .title { margin: 0; font-size: clamp(30px, 7vw, 40px); line-height: 1.1; }
      .body { margin: 0; font-size: 18px; }
      .saved, .note { margin: 0; color: var(--ink-soft); font-size: 14px; }
      .confirm { margin: 0; padding: var(--space-4); border-radius: var(--radius-md); background: var(--warning-soft); }
      .cta, .alt { min-height: 56px; border-radius: var(--radius-pill); font: inherit; font-weight: 500; cursor: pointer; padding: 0 var(--space-5); }
      .cta { border: 0; background: var(--action-primary); color: var(--action-on-primary); }
      .cta--danger { background: var(--danger-text); }
      .alt { border: 1px solid var(--ink); background: transparent; color: var(--ink); }
      .cta:focus-visible, .alt:focus-visible { outline: 2px solid transparent; outline-offset: 2px; box-shadow: var(--focus-ring); }
    `,
  ],
})
export class ResumeComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly drafts = inject(DraftService);
  private readonly router = inject(Router);
  private readonly lang = inject(LangService);

  readonly draft = signal<DraftData | null>(null);
  readonly confirming = signal(false);

  readonly stepLabel = computed(() => {
    const d = this.draft();
    const key = d ? d.route.replace('/apply/', '') : 'profile';
    const known = ['profile', 'employment', 'salary'];
    return this.lang.t(`resume.step.${known.includes(key) ? key : 'eligibility'}`);
  });

  /** Own translated wording: the browser's relative-time data is missing for some of our languages. */
  readonly when = computed(() => {
    const d = this.draft();
    if (!d) return '';
    this.lang.lang();
    const mins = Math.max(0, Math.round((Date.now() - new Date(d.savedAt).getTime()) / 60_000));
    const t = (key: string, n: number) => this.lang.t(key).replace('{n}', String(n));
    if (mins < 1) return this.lang.t('time.now');
    if (mins < 60) return t('time.minutes', mins);
    if (mins < 60 * 24) return t('time.hours', Math.round(mins / 60));
    return t('time.days', Math.round(mins / (60 * 24)));
  });

  constructor() {
    const contact = this.state.contact();
    const found = contact && this.state.phoneVerified() ? this.drafts.find(contact.phone) : null;
    if (!found) {
      void this.router.navigateByUrl('/apply/profile');
      return;
    }
    this.draft.set(found);
  }

  continueDraft(d: DraftData): void {
    void this.router.navigateByUrl(this.drafts.restore(d));
  }

  startOver(): void {
    this.drafts.clear();
    void this.router.navigateByUrl('/apply/profile');
  }
}
