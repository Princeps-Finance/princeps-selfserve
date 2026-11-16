import { DestroyRef, Injectable, inject, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastOptions {
  /** How long it stays. Defaults to a time that fits the message length (errors stay longer). */
  durationMs?: number;
  /** One follow-up the customer can take straight from the toast, such as "Try again". */
  action?: ToastAction;
}

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
  /** True during the short exit animation, just before it is removed. */
  leaving?: boolean;
}

const MAX_VISIBLE = 3;
const MIN_MS = 4_000;
const MIN_ERROR_MS = 7_000;
const MS_PER_CHAR = 60;
const MAX_MS = 12_000;
/** How long the exit animation runs before the toast is removed. */
export const TOAST_EXIT_MS = 180;

interface Countdown {
  timer: ReturnType<typeof setTimeout> | null;
  remainingMs: number;
  startedAt: number;
}

/**
 * Short messages about something that just happened. Errors are announced at once, the rest politely;
 * the same message never stacks twice, only three show at a time, and a toast stays while it is hovered
 * or focused so it can be read and its action reached.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private stackPaused = false;
  private readonly countdowns = new Map<number, Countdown>();
  private readonly exitTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly messages = signal<Toast[]>([]);
  readonly toasts = this.messages.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const countdown of this.countdowns.values()) {
        if (countdown.timer !== null) clearTimeout(countdown.timer);
      }
      for (const timer of this.exitTimers.values()) clearTimeout(timer);
      this.countdowns.clear();
      this.exitTimers.clear();
    });
  }

  show(tone: ToastTone, message: string, options: ToastOptions | number = {}): number {
    const settings: ToastOptions = typeof options === 'number' ? { durationMs: options } : options;
    const existing = this.toasts().find(
      (toast) => !toast.leaving && toast.tone === tone && toast.message === message,
    );
    if (existing) {
      this.start(existing.id, settings.durationMs ?? this.durationFor(tone, message));
      return existing.id;
    }
    const toastId = this.nextId++;
    this.messages.update((list) =>
      [...list, { id: toastId, tone, message, action: settings.action }].slice(-MAX_VISIBLE),
    );
    this.forgetMissing();
    this.start(toastId, settings.durationMs ?? this.durationFor(tone, message));
    return toastId;
  }

  success(message: string, options?: ToastOptions | number): number {
    return this.show('success', message, options);
  }
  error(message: string, options?: ToastOptions | number): number {
    return this.show('error', message, options);
  }
  info(message: string, options?: ToastOptions | number): number {
    return this.show('info', message, options);
  }

  setStackPaused(paused: boolean): void {
    if (this.stackPaused === paused) return;
    this.stackPaused = paused;
    for (const toastId of this.countdowns.keys()) {
      if (paused) this.pause(toastId);
      else this.resume(toastId);
    }
  }

  /** Stops the countdown while the toast is being read (hover or keyboard focus). */
  pause(toastId: number): void {
    const countdown = this.countdowns.get(toastId);
    if (!countdown?.timer) return;
    clearTimeout(countdown.timer);
    countdown.timer = null;
    countdown.remainingMs = Math.max(
      1_000,
      countdown.remainingMs - (Date.now() - countdown.startedAt),
    );
  }

  resume(toastId: number): void {
    const countdown = this.countdowns.get(toastId);
    if (countdown && !countdown.timer) this.start(toastId, countdown.remainingMs);
  }

  /** Animates the toast out, then removes it (at once when the person prefers reduced motion). */
  dismiss(toastId: number): void {
    if (this.exitTimers.has(toastId) || !this.toasts().some((toast) => toast.id === toastId))
      return;
    const countdown = this.countdowns.get(toastId);
    if (countdown?.timer) clearTimeout(countdown.timer);
    this.countdowns.delete(toastId);
    if (this.reducedMotion()) {
      this.remove(toastId);
      return;
    }
    this.messages.update((list) =>
      list.map((toast) => (toast.id === toastId ? { ...toast, leaving: true } : toast)),
    );
    this.exitTimers.set(
      toastId,
      setTimeout(() => this.remove(toastId), TOAST_EXIT_MS),
    );
  }

  private remove(toastId: number): void {
    this.exitTimers.delete(toastId);
    this.messages.update((list) => list.filter((toast) => toast.id !== toastId));
  }

  private reducedMotion(): boolean {
    return (
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  private durationFor(tone: ToastTone, message: string): number {
    const base = tone === 'error' ? MIN_ERROR_MS : MIN_MS;
    return Math.min(MAX_MS, Math.max(base, message.length * MS_PER_CHAR));
  }

  private start(toastId: number, durationMs: number): void {
    const previous = this.countdowns.get(toastId);
    if (previous?.timer) clearTimeout(previous.timer);
    this.countdowns.set(toastId, {
      timer: this.stackPaused ? null : setTimeout(() => this.dismiss(toastId), durationMs),
      remainingMs: durationMs,
      startedAt: Date.now(),
    });
  }

  /** Toasts pushed out by the visible limit no longer need a timer. */
  private forgetMissing(): void {
    const visibleIds = new Set(this.toasts().map((toast) => toast.id));
    for (const [toastId, countdown] of this.countdowns) {
      if (visibleIds.has(toastId)) continue;
      if (countdown.timer !== null) clearTimeout(countdown.timer);
      this.countdowns.delete(toastId);
    }
    for (const [toastId, timer] of this.exitTimers) {
      if (visibleIds.has(toastId)) continue;
      clearTimeout(timer);
      this.exitTimers.delete(toastId);
    }
  }
}
