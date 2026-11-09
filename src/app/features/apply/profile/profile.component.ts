import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { focusFirstInvalid } from '../../../core/a11y/focus';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { NIGERIAN_STATES } from '../../../core/nigeria/states';

@Component({
  selector: 'app-profile',
  imports: [TPipe, WizardProgressComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly router = inject(Router);

  readonly states = NIGERIAN_STATES;

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
    const saved = this.state.profile();
    if (saved) {
      this.form.patchValue({
        fullName: saved.fullName,
        dateOfBirth: saved.dateOfBirth,
        street: saved.address.street,
        stateName: saved.address.state,
        lga: saved.address.lga,
        relationshipStatus: saved.relationshipStatus,
      });
      return;
    }
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
