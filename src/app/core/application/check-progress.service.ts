import { Injectable, effect, inject } from '@angular/core';
import { ApplicationStateService, EligibilityDraft, EmploymentDraft, SalaryDraft } from './application-state.service';

const KEY = 'princeps.check-progress';

interface Saved {
  intent: 'apply' | 'check';
  employment: EmploymentDraft;
  salary: SalaryDraft | null;
  eligibility: EligibilityDraft | null;
}

/**
 * Keeps the "how much can I get" check across a reload. Before identity there is no saved application, so without
 * this a reload in the middle of the check would lose the answers and send the customer back to the start.
 * It uses session storage (gone when the tab closes), and never keeps the account number or IPPIS number.
 */
@Injectable({ providedIn: 'root' })
export class CheckProgressService {
  private readonly state = inject(ApplicationStateService);

  constructor() {
    this.restore();
    effect(() => {
      const employment = this.state.employment();
      const salary = this.state.salary();
      const checking = this.state.intent() === 'check' || !!salary?.fromCheck;
      if (!employment || !checking) {
        this.clear();
        return;
      }
      const saved: Saved = {
        intent: this.state.intent(),
        employment,
        salary: salary ? { ...salary, accountNumber: '', ippisNumber: undefined } : null,
        eligibility: this.state.eligibility(),
      };
      try {
        sessionStorage.setItem(KEY, JSON.stringify(saved));
      } catch {
        /* storage blocked: the check simply does not survive a reload */
      }
    });
  }

  private restore(): void {
    if (this.state.employment()) return;
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Saved;
      if (!s?.employment?.type) return;
      this.state.hydrateFromDraft({ intent: s.intent, consent: null, profile: null, employment: s.employment, salary: s.salary });
      if (s.eligibility) this.state.setEligibility(s.eligibility);
    } catch {
      this.clear();
    }
  }

  private clear(): void {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
  }
}
