import { Injectable, inject } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { APPLY } from './apply-routes';

/**
 * The only place steps use to move around the flow. Route guards decide whether a step may be shown;
 * this decides where to go next, so a step never needs to know the URL of its neighbours.
 */
@Injectable({ providedIn: 'root' })
export class FlowNavigator {
  private readonly router = inject(Router);

  /** Go to a step (or any app URL, such as a restored draft position). Resolves true when navigation succeeded. */
  go(url: string, extras?: NavigationExtras): Promise<boolean> {
    return this.router.navigateByUrl(url, extras);
  }

  /** After the terms are accepted: the ID check comes first only when the chosen product asks for it. */
  afterTerms(needsNin: boolean): Promise<boolean> {
    return this.go(needsNin ? APPLY.nin : APPLY.documents);
  }
}
