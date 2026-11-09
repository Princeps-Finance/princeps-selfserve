import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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

@Component({
  selector: 'app-profile',
  imports: [TPipe, WizardProgressComponent, ReactiveFormsModule, DobFieldComponent, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly router = inject(Router);
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
  });

  readonly statusChanges = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  readonly attempted = signal(false);

  invalid(name: 'fullName' | 'dateOfBirth' | 'street' | 'stateName' | 'lga'): true | null {
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
      this.form.patchValue({
        fullName: id.fullName,
        dateOfBirth: id.dateOfBirth,
        street: id.street ?? '',
        stateName: id.state ?? '',
        lga: id.lga ?? '',
      }, { emitEvent: false });
      if (id.state) void this.loadLgas(id.state, false);
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

  readonly dobText = computed(() => {
    this.statusChanges();
    const iso = this.form.controls.dateOfBirth.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    try {
      return new Intl.DateTimeFormat(this.lang.lang(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'));
    } catch { return iso; }
  });

  /** Not the customer's record: start over from the BVN. */
  notMe(): void {
    this.state.setBvnIdentity(null);
    this.state.setBvn({ value: '', verified: false });
    void this.router.navigateByUrl('/apply/bvn');
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
    this.state.setProfile({
      fullName: v.fullName.trim(),
      dateOfBirth: v.dateOfBirth,
      address: { street: v.street.trim(), state: v.stateName, lga: v.lga.trim() },
      relationshipStatus: v.relationshipStatus,
    });
    void this.router.navigateByUrl('/apply/employment');
  }
}
