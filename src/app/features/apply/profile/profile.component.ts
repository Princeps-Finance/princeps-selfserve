import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { focusFirstInvalid } from '../../../core/a11y/focus';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { NIGERIAN_STATES } from '../../../core/nigeria/states';
import { API_CLIENT } from '../../../core/api/api-client';
import { DobFieldComponent } from '../../../core/ui/dob-field.component';
import { SelectFieldComponent, SelectOption } from '../../../core/ui/select-field.component';
import { LangService } from '../../../core/i18n/lang.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

@Component({
  selector: 'app-profile',
  imports: [TPipe, WizardProgressComponent, ReactiveFormsModule, DobFieldComponent, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
  private readonly api = inject(API_CLIENT);
  private readonly lang = inject(LangService);

  /** Name and date of birth come from the BVN record once its owner confirmed; they are not typed. */
  readonly identity = this.state.bvnIdentity();

  readonly stateOptions: SelectOption[] = NIGERIAN_STATES.map((n) => ({ value: n, label: n }));
  readonly lgas = signal<string[]>([]);
  readonly lgaOptions = computed<SelectOption[]>(() => this.lgas().map((n) => ({ value: n, label: n })));
  readonly relationshipOptions = computed<SelectOption[]>(() => {
    this.lang.lang();
    return (['single', 'married', 'divorced', 'widowed'] as const).map((v) => ({
      value: v, label: this.lang.t('step.profile.relationship.' + v),
    }));
  });

  readonly form = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    dateOfBirth: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    street: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(4)] }),
    stateName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lga: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    relationshipStatus: new FormControl<'single' | 'married' | 'divorced' | 'widowed'>('single', {
      nonNullable: true, validators: [Validators.required],
    }),
    // Optional: only checked when something is typed.
    email: new FormControl(this.state.contact()?.email ?? '', {
      nonNullable: true, validators: [Validators.pattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)],
    }),
  });

  /** First name only, to greet the customer. The rest of the BVN record is never shown. */
  readonly firstName = this.identity ? titleCase(this.identity.firstName) : '';

  readonly statusChanges = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  readonly attempted = signal(false);

  invalid(name: 'fullName' | 'dateOfBirth' | 'street' | 'stateName' | 'lga' | 'email'): true | null {
    return this.attempted() && this.form.controls[name].invalid ? true : null;
  }

  readonly canContinue = computed(() => {
    this.statusChanges();
    return this.form.valid;
  });

  readonly submitting = signal(false);

  constructor() {
    this.form.controls.stateName.valueChanges.subscribe((st) => void this.loadLgas(st, true));
    const saved = this.state.profile();
    const id = this.identity;
    if (id && !saved) {
      this.form.patchValue({ fullName: id.fullName, dateOfBirth: id.dateOfBirth }, { emitEvent: false });
    }
    if (saved) {
      this.form.patchValue({
        fullName: saved.fullName,
        dateOfBirth: saved.dateOfBirth,
        street: saved.address.street,
        stateName: saved.address.state,
        lga: saved.address.lga,
        relationshipStatus: saved.relationshipStatus,
      }, { emitEvent: false });
      if (saved.address.state) void this.loadLgas(saved.address.state, false);
      return;
    }
  }

  /** Not the customer's record: start over from the BVN. */
  notMe(): void {
    // Someone else's record: nothing from it, or from the steps built on it, may carry over.
    this.state.reset();
    void this.flow.go(APPLY.bvn);
  }

  private async loadLgas(stateName: string, clearLga: boolean): Promise<void> {
    if (clearLga) this.form.controls.lga.setValue('');
    this.lgas.set(stateName ? await this.api.getLgas(stateName) : []);
  }

  continue(): void {
    if (this.submitting()) return;
    if (!this.canContinue()) {
      this.attempted.set(true);
      this.form.markAllAsTouched();
      setTimeout(() => focusFirstInvalid());
      return;
    }
    this.submitting.set(true);
    const v = this.form.getRawValue();
    this.state.setContactEmail(v.email.trim().toLowerCase());
    this.state.setProfile({
      fullName: v.fullName.trim(),
      dateOfBirth: v.dateOfBirth,
      address: { street: v.street.trim(), state: v.stateName, lga: v.lga.trim() },
      relationshipStatus: v.relationshipStatus,
    });
    // Work details already given in the check are not asked again; only the salary account is confirmed.
    void this.flow.go(this.state.salary()?.fromCheck ? APPLY.salary : APPLY.employment);
  }
}

function titleCase(v: string): string {
  return v.trim().toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
}
