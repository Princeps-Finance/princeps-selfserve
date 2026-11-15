import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { StateEmployersService } from '../../../core/api/state-employers.service';
import type { StateEmployer, StateGovernment } from '../../../core/api/state-employers';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { whatsappLink } from '../../../core/support';
import { TPipe } from '../../../core/i18n/t.pipe';
import { IconComponent } from '../../../shared/icon.component';
import { WizardProgressComponent } from '../wizard-progress.component';

/**
 * State government staff say which state they work in. A state with several employers (Adamawa's SUBEB, LGA and PHCDA)
 * asks one more question on this same screen, because the employer decides how repayments are collected.
 * The list comes from the back end, so a state or employer is added without a release.
 */
@Component({
  selector: 'app-state',
  imports: [IconComponent, TPipe, WizardProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../employment/employment.component.css',
  template: `
    <section class="step">
      <app-wizard-progress [current]="4" [total]="14" [label]="'step.employment.eyebrow' | t" />

      @if (active(); as st) {
        <header class="head">
          <h1 class="title" id="state-title" tabindex="-1">{{ 'step.state.employer.title' | t: { state: st.name } }}</h1>
          <p class="subtitle">{{ 'step.state.employer.subtitle' | t }}</p>
        </header>
        <ul class="options" [attr.aria-labelledby]="'state-title'">
          @for (e of st.employers; track e.code) {
            <li>
              <button type="button" class="option" [class.is-selected]="selectedEmployer() === e.code" (click)="pickEmployer(st, e)">
                <span class="option-body"><span class="option-label">{{ e.name }}</span></span>
                <app-icon name="bold-chevron-down" [size]="20" [rotate]="-90" class="go" />
              </button>
            </li>
          }
        </ul>
        <button type="button" class="text-btn" (click)="backToStates()">{{ 'step.state.change' | t }}</button>
      } @else {
        <header class="head">
          <h1 class="title" id="state-title" tabindex="-1">{{ 'step.state.title' | t }}</h1>
          <p class="subtitle">{{ 'step.state.subtitle' | t }}</p>
        </header>
        <ul class="options" [attr.aria-labelledby]="'state-title'">
          @for (s of states(); track s.code) {
            <li>
              <button type="button" class="option" [class.is-selected]="selectedState() === s.code" (click)="pickState(s)">
                <span class="option-body"><span class="option-label">{{ s.name }}</span></span>
                <app-icon name="bold-chevron-down" [size]="20" [rotate]="-90" class="go" />
              </button>
            </li>
          }
        </ul>
        <p class="hint">
          {{ 'step.state.missing' | t }}
          <a class="link" [attr.href]="whatsapp" target="_blank" rel="noopener">{{ 'step.eligibility.declined.whatsapp' | t }}</a>
        </p>
      }
    </section>
  `,
  styles: [
    `
      .text-btn { align-self: flex-start; min-height: 44px; padding: 0 var(--space-2); border: 0; background: none; color: var(--text-accent); font: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
      .hint { margin: 0; font-size: var(--fs-md); color: var(--ink-soft); }
      .link { color: var(--text-accent); font-weight: 600; margin-inline-start: var(--space-1); }
    `,
  ],
})
export class StateComponent implements OnInit {
  private readonly app = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
  private readonly source = inject(StateEmployersService);

  readonly states = this.source.states;
  readonly whatsapp = whatsappLink('Hello Princeps, I work for a state government that is not on your list and I would like help.');
  /** The state whose employers are being shown, when it has more than one. */
  readonly active = signal<StateGovernment | null>(null);
  readonly selectedState = computed(() => this.app.employment()?.state?.code ?? null);
  readonly selectedEmployer = computed(() => this.app.employment()?.state?.employer?.code ?? null);

  async ngOnInit(): Promise<void> {
    await this.source.load();
  }

  pickState(s: StateGovernment): void {
    if (s.employers.length > 0) {
      this.active.set(s);
      this.focusTitle();
      return;
    }
    void this.finish(s);
  }

  pickEmployer(s: StateGovernment, e: StateEmployer): void {
    void this.finish(s, e);
  }

  backToStates(): void {
    this.active.set(null);
    this.focusTitle();
  }

  private focusTitle(): void {
    setTimeout(() => document.getElementById('state-title')?.focus());
  }

  private async finish(s: StateGovernment, e?: StateEmployer): Promise<void> {
    const employment = this.app.employment();
    if (!employment) return; // the route guard guarantees it; this only narrows the type
    this.app.setEmployment({
      ...employment,
      state: {
        code: s.code,
        name: s.name,
        employer: e ? { code: e.code, name: e.name } : undefined,
        channel: e?.channel ?? s.channel,
      },
    });
    await this.flow.go(APPLY.salary);
  }
}
