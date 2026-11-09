import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { focusFirstInvalid } from '../../../core/a11y/focus';
import { TPipe } from '../../../core/i18n/t.pipe';
import {
  API_CLIENT,
  IncomeBand,
  WaitlistChannel,
  WaitlistResult,
} from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';

@Component({
  selector: 'app-waitlist',
  imports: [TPipe, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './waitlist.component.html',
  styleUrl: './waitlist.component.css',
})
export class WaitlistComponent {
  private readonly api = inject(API_CLIENT);
  private readonly state = inject(ApplicationStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly submitting = signal(false);
  readonly attempted = signal(false);
  readonly result = signal<WaitlistResult | null>(null);

  readonly form = new FormGroup({
    employer: new FormControl('', { nonNullable: true }),
    incomeBand: new FormControl<IncomeBand | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    channel: new FormControl<WaitlistChannel>('whatsapp', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  readonly statusChanges = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  readonly canSubmit = computed(() => {
    this.statusChanges();
    return this.form.valid && !this.submitting();
  });

  readonly incomeBands: { value: IncomeBand; key: string }[] = [
    { value: 'under-100k', key: 'waitlist.income.under100k' },
    { value: '100-250k', key: 'waitlist.income.100to250k' },
    { value: '250-500k', key: 'waitlist.income.250to500k' },
    { value: '500-1m', key: 'waitlist.income.500to1m' },
    { value: 'over-1m', key: 'waitlist.income.over1m' },
  ];

  setChannel(c: WaitlistChannel): void {
    this.form.controls.channel.setValue(c);
  }

  async join(): Promise<void> {
    if (this.submitting()) return;
    if (!this.form.valid) {
      this.attempted.set(true);
      this.form.markAllAsTouched();
      setTimeout(() => focusFirstInvalid());
      return;
    }
    const contact = this.state.contact();
    if (!contact) {
      await this.router.navigateByUrl('/apply/contact');
      return;
    }
    this.submitting.set(true);
    const v = this.form.getRawValue();
    try {
      const res = await this.api.joinWaitlist({
        phone: contact.phone,
        email: contact.email,
        type: this.params().get('type') ?? 'unknown',
        employer: v.employer.trim() || undefined,
        incomeBand: v.incomeBand || undefined,
        channel: v.channel,
      });
      this.result.set(res);
    } finally {
      this.submitting.set(false);
    }
  }

  home(): void {
    void this.router.navigateByUrl('/');
  }
}
