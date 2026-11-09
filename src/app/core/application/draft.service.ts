import { Injectable, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { APP_VERSION } from '../app-version';
import { LangService } from '../i18n/lang.service';
import {
  ApplicationStateService,
  ConsentDraft,
  ContactDraft,
  EmploymentDraft,
  ApplyIntent,
  ProfileDraft,
  SalaryDraft,
} from './application-state.service';

const KEY = 'princeps.draft';
/** A saved application is deleted after this long without use. */
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Steps whose answers we save. Resume re-runs eligibility, so nothing after this is stored. */
export const RESUMABLE_ROUTES = ['/apply/profile', '/apply/employment', '/apply/salary'] as const;

/**
 * What is saved on the device so a customer can pick up later (Caltos only receives an
 * application at submission). Deliberately NOT saved: BVN, NIN, documents, photo, video,
 * OTP, and anything Caltos decides (eligibility, products, offers). Those are asked or
 * fetched again, which also means eligibility always re-runs on resume.
 */
export interface DraftData {
  v: 1;
  appVersion: string;
  savedAt: string;
  language: string;
  route: string;
  intent: ApplyIntent;
  consent: ConsentDraft | null;
  contact: ContactDraft;
  profile: ProfileDraft | null;
  employment: EmploymentDraft | null;
  salary: SalaryDraft | null;
}

@Injectable({ providedIn: 'root' })
export class DraftService {
  private readonly state = inject(ApplicationStateService);
  private readonly router = inject(Router);
  private readonly lang = inject(LangService);

  private readonly route = signal(this.router.url.split('?')[0]);

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.route.set(e.urlAfterRedirects.split('?')[0]);
    });
    effect(() => {
      const d = this.state.draft();
      const route = this.route();
      if (!d.contact || !d.phoneVerified || d.submission.status !== 'idle') return;
      if (!d.profile && !d.employment && !d.salary) return; // nothing worth saving yet
      this.write({
        v: 1,
        appVersion: APP_VERSION,
        savedAt: new Date().toISOString(),
        language: this.lang.lang(),
        route: this.stepFor(route, d.salary !== null, d.employment !== null),
        intent: d.intent,
        consent: d.consent,
        contact: d.contact,
        profile: d.profile,
        employment: d.employment,
        salary: d.salary,
      });
    });
  }

  /** Where to send the customer after restoring: the step they were on, or a fresh eligibility check. */
  private stepFor(route: string, hasSalary: boolean, hasEmployment: boolean): string {
    if ((RESUMABLE_ROUTES as readonly string[]).includes(route)) return route;
    if (hasSalary) return '/apply/eligibility';
    return hasEmployment ? '/apply/salary' : '/apply/employment';
  }

  /** The saved application for this phone number, if there is one and it has not expired. */
  find(phone: string): DraftData | null {
    const d = this.read();
    if (!d) return null;
    if (d.contact.phone !== phone) return null;
    return d;
  }

  restore(d: DraftData): string {
    this.state.hydrateFromDraft({
      intent: d.intent,
      consent: d.consent,
      profile: d.profile,
      employment: d.employment,
      salary: d.salary,
    });
    return d.route;
  }

  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Storage unavailable (private mode): nothing to clear.
    }
  }

  private read(): DraftData | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw) as DraftData;
      if (d.v !== 1 || !d.contact?.phone) return this.drop();
      if (Date.now() - new Date(d.savedAt).getTime() > DRAFT_TTL_MS) return this.drop();
      return d;
    } catch {
      return null;
    }
  }

  private drop(): null {
    this.clear();
    return null;
  }

  private write(d: DraftData): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
      // Storage full or blocked: resume simply is not available.
    }
  }
}
