import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IllustrationComponent } from '../../../core/ui/illustration.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { LangService } from '../../../core/i18n/lang.service';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { DraftData, DraftService } from '../../../core/application/draft.service';

/** Shown right after the OTP when this phone number has an application in progress. */
@Component({
  selector: 'app-resume',
  imports: [TPipe, IllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (draft(); as d) {
      <section class="step">
        <app-illustration name="document" [size]="120" />
        <h1 class="title">
          @if (firstName()) { {{ 'resume.title.named' | t: { name: firstName() } }} } @else { {{ 'resume.title' | t }} }
        </h1>

        <div class="card">
          <p class="label">{{ 'resume.stopped' | t }}</p>
          <p class="where">{{ stepLabel() }}</p>
          <div class="bar" aria-hidden="true">
            @for (i of segments; track i) { <span [class.on]="i <= stage()"></span> }
          </div>
          <p class="meta">{{ 'resume.saved' | t: { when: when() } }} · {{ 'resume.note' | t }}</p>
        </div>

        @if (!confirming()) {
          <div class="actions">
            <button type="button" class="cta" (click)="continueDraft(d)">
              <span>{{ 'resume.continue' | t }}</span>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <button type="button" class="alt" (click)="confirming.set(true)">{{ 'resume.start_over' | t }}</button>
          </div>
        } @else {
          <div class="actions">
            <p class="confirm" role="alert">{{ 'resume.confirm' | t }}</p>
            <button type="button" class="cta" (click)="confirming.set(false)">{{ 'resume.confirm.no' | t }}</button>
            <button type="button" class="alt alt--danger" (click)="startOver()">{{ 'resume.confirm.yes' | t }}</button>
          </div>
        }
      </section>
    }
  `,
  styles: [
    `
      .step { display: flex; flex-direction: column; gap: var(--space-5); padding-top: var(--space-6); }
      .title { margin: 0; text-align: center; font-size: clamp(26px, 7vw, 32px); line-height: 1.15; letter-spacing: -0.02em; }
      .card { padding: var(--space-5); border-radius: var(--radius-lg); background: var(--surface-0); border: 1px solid var(--hairline); display: flex; flex-direction: column; gap: var(--space-2); }
      .label { margin: 0; font-size: 13px; color: var(--ink-muted); }
      .where { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
      .where::first-letter { text-transform: uppercase; }
      .bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: var(--space-2); }
      .bar span { height: 4px; border-radius: 2px; background: var(--hairline); }
      .bar span.on { background: var(--action-primary); }
      .meta { margin: var(--space-2) 0 0; font-size: 14px; color: var(--ink-soft); }
      .actions { margin-top: auto; display: flex; flex-direction: column; gap: var(--space-3); padding-top: var(--space-4); }
      .confirm { margin: 0; padding: var(--space-4); border-radius: var(--radius-md); background: var(--warning-soft); }
      .cta, .alt {
        min-height: 56px; padding: 0 var(--space-6); border-radius: var(--radius-pill); cursor: pointer;
        font-family: var(--font-sans); font-size: 16px; font-weight: 600;
        display: inline-flex; align-items: center; justify-content: center; gap: var(--space-3);
      }
      .cta { border: 0; background: var(--action-primary); color: var(--action-on-primary); justify-content: space-between; margin-top: 0 !important; }
      .alt { border: 1.5px solid var(--action-primary); background: transparent; color: var(--action-primary); }
      .alt--danger { border-color: var(--danger-text); color: var(--danger-text); }
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
  protected readonly segments = [1, 2, 3, 4];

  protected readonly firstName = computed(() => {
    const raw = this.state.bvnIdentity()?.firstName ?? '';
    return raw.trim().toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
  });

  protected readonly stage = computed(() => {
    const d = this.draft();
    const key = d ? d.route.replace('/apply/', '') : 'profile';
    return Math.max(1, ['profile', 'employment', 'salary'].indexOf(key) + 1 || 4);
  });

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
