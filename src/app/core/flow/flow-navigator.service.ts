import { Injectable, inject } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { ApplicationStateService } from '../application/application-state.service';
import { JourneyService } from './journey';

/**
 * The only place steps use to move around the flow. Route guards decide whether a step may be shown;
 * this decides where to go next, so a step never needs to know the URL of its neighbours.
 */
@Injectable({ providedIn: 'root' })
export class FlowNavigator {
  private readonly router = inject(Router);
  private readonly journey = inject(JourneyService);
  private readonly state = inject(ApplicationStateService);

  /** Go to a step (or any app URL, such as a restored draft position). Resolves true when navigation succeeded. */
  go(url: string, extras?: NavigationExtras): Promise<boolean> {
    return this.router.navigateByUrl(url, extras);
  }

  /** After the terms: ask the back end for this product's order of steps, then open the first one. */
  async afterTerms(): Promise<boolean> {
    await this.journey.load(this.state.offer()?.productId ?? '');
    return this.go(this.journey.first());
  }

  /** The step after `current` in this product's journey. */
  next(current: string): Promise<boolean> {
    return this.go(this.journey.next(current));
  }
}
