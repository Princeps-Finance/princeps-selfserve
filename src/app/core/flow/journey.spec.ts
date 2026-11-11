import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_CLIENT } from '../api/api-client';
import { ApplicationStateService } from '../application/application-state.service';
import { APPLY } from './apply-routes';
import { FlowNavigator } from './flow-navigator.service';
import { JourneyService, sanitizeJourney } from './journey';

function setup(getJourney = vi.fn().mockResolvedValue(null), productId = 'ippis-advance') {
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: API_CLIENT, useValue: { getJourney } }] });
  const state = TestBed.inject(ApplicationStateService);
  state.setOffer({ productId } as never);
  return { journey: TestBed.inject(JourneyService), state, getJourney };
}

describe('JourneyService', () => {
  it('uses the standard order, and leaves out the ID check where the product does not need it', () => {
    const { journey } = setup();
    expect(journey.steps()).toEqual(['documents', 'identity', 'offer-letter', 'mandate', 'submit']);
    TestBed.resetTestingModule();
    expect(setup(undefined, 'ippis-standard').journey.steps()[0]).toBe('documents');
  });

  it('puts the ID check first where the product asks for it', () => {
    const { journey } = setup(undefined, 'dedukt-primary');
    expect(journey.steps()[0]).toBe('nin');
    expect(journey.previous(APPLY.nin)).toBe(APPLY.terms);
  });

  it('takes the order the back end sends for the product', async () => {
    const { journey } = setup(vi.fn().mockResolvedValue(['identity', 'documents', 'mandate', 'offer-letter']));
    await journey.load('ippis-advance');
    expect(journey.steps()).toEqual(['identity', 'documents', 'mandate', 'offer-letter', 'submit']);
    expect(journey.first()).toBe(APPLY.verifyIdentity);
    expect(journey.next(APPLY.documents)).toBe(APPLY.mandate);
    expect(journey.previous(APPLY.documents)).toBe(APPLY.verifyIdentity);
  });

  it('keeps the standard order when the back end cannot answer', async () => {
    const { journey } = setup(vi.fn().mockRejectedValue(new Error('down')));
    await journey.load('ippis-advance');
    expect(journey.steps()[0]).toBe('documents');
  });

  it('opens a step only once the steps before it are done, in whatever order they run', () => {
    const { journey, state } = setup();
    expect(journey.blockedAt('documents')).toBeNull();
    expect(journey.blockedAt('identity')).toBe(APPLY.documents);
    state.setDocs([{ id: 'a', name: 'A', status: 'uploaded' }]);
    expect(journey.blockedAt('identity')).toBeNull();
    expect(journey.blockedAt('mandate')).toBe(APPLY.verifyIdentity);
    expect(journey.blockedAt('submit')).toBe(APPLY.verifyIdentity);
  });

  it('moves on through the journey from each step', async () => {
    const { journey } = setup();
    const nav = TestBed.inject(FlowNavigator);
    const seen: string[] = [];
    nav.go = (url: string) => (seen.push(url), Promise.resolve(true));
    await nav.afterTerms();
    await nav.next(APPLY.documents);
    await nav.next(APPLY.mandate);
    expect(seen).toEqual([APPLY.documents, APPLY.verifyIdentity, APPLY.submit]);
    expect(journey.previous(APPLY.submit)).toBe(APPLY.mandate);
  });
});

describe('sanitizeJourney', () => {
  it('drops unknown and repeated steps, always ends on submit and never loses documents or the mandate', () => {
    expect(sanitizeJourney(['mandate', 'bogus', 'mandate', 'submit', 'identity'])).toEqual(['mandate', 'identity', 'documents', 'submit']);
    expect(sanitizeJourney('nope')).toBeNull();
    expect(sanitizeJourney([])).toBeNull();
  });
});
