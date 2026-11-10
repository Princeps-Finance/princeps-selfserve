import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

const SITE_NAME = 'Princeps';

/**
 * After every navigation, moves focus to the new screen's heading and sets the tab title to it, so keyboard and
 * screen-reader users know the page changed. Single-page apps do not do this on their own.
 */
@Injectable({ providedIn: 'root' })
export class RouteAnnouncerService {
  private readonly document = inject(DOCUMENT);

  constructor() {
    inject(Router)
      .events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => setTimeout(() => this.announce()));
  }

  private announce(): void {
    const heading = this.document.querySelector<HTMLElement>('main h1, h1');
    if (!heading) return;
    const text = heading.textContent?.trim();
    if (text) this.document.title = `${text} · ${SITE_NAME}`;
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}
