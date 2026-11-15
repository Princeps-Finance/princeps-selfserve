import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_EXIT_MS, ToastService } from './toast.service';

describe('ToastService', () => {
  // jsdom has no matchMedia: motion is on, so a dismissed toast leaves through its exit animation first.
  let toast: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    toast = TestBed.inject(ToastService);
  });
  afterEach(() => vi.useRealTimers());

  it('does not stack the same message twice', () => {
    toast.error('Could not submit');
    toast.error('Could not submit');
    expect(toast.toasts()).toHaveLength(1);
  });

  it('shows at most three at a time, dropping the oldest', () => {
    ['a', 'b', 'c', 'd'].forEach((m) => toast.info(m));
    expect(toast.toasts().map((t) => t.message)).toEqual(['b', 'c', 'd']);
  });

  it('keeps errors on screen longer than confirmations', () => {
    toast.success('Saved');
    toast.error('Failed');
    vi.advanceTimersByTime(4_500 + TOAST_EXIT_MS);
    expect(toast.toasts().map((t) => t.tone)).toEqual(['error']);
    vi.advanceTimersByTime(3_000 + TOAST_EXIT_MS);
    expect(toast.toasts()).toHaveLength(0);
  });

  it('stays while paused and goes after it is resumed', () => {
    const id = toast.success('Saved');
    toast.pause(id);
    vi.advanceTimersByTime(60_000);
    expect(toast.toasts()).toHaveLength(1);
    toast.resume(id);
    vi.advanceTimersByTime(5_000 + TOAST_EXIT_MS);
    expect(toast.toasts()).toHaveLength(0);
  });

  it('carries one follow-up action', () => {
    const run = vi.fn();
    toast.error('Failed', { action: { label: 'Try again', run } });
    toast.toasts()[0].action?.run();
    expect(run).toHaveBeenCalledOnce();
  });

  it('marks a dismissed toast as leaving, then removes it after the exit animation', () => {
    const id = toast.info('Hello');
    toast.dismiss(id);
    expect(toast.toasts()[0].leaving).toBe(true);
    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(toast.toasts()).toHaveLength(0);
  });
});
