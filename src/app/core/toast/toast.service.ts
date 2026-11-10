import { Injectable, signal } from '@angular/core';

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
  private readonly countdowns = new Map<number, Countdown>();
  readonly toasts = signal<Toast[]>([]);

  show(tone: ToastTone, message: string, options: ToastOptions | number = {}): number {
    const opts: ToastOptions = typeof options === 'number' ? { durationMs: options } : options;
    const existing = this.toasts().find((t) => t.tone === tone && t.message === message);
    if (existing) {
      this.start(existing.id, opts.durationMs ?? this.durationFor(tone, message));
      return existing.id;
    }
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, tone, message, action: opts.action }].slice(-MAX_VISIBLE));
    this.forgetMissing();
    this.start(id, opts.durationMs ?? this.durationFor(tone, message));
    return id;
  }

  success(message: string, options?: ToastOptions | number): number { return this.show('success', message, options); }
  error(message: string, options?: ToastOptions | number): number { return this.show('error', message, options); }
  info(message: string, options?: ToastOptions | number): number { return this.show('info', message, options); }

  /** Stops the countdown while the toast is being read (hover or keyboard focus). */
  pause(id: number): void {
    const c = this.countdowns.get(id);
    if (!c?.timer) return;
    clearTimeout(c.timer);
    c.timer = null;
    c.remainingMs = Math.max(1_000, c.remainingMs - (Date.now() - c.startedAt));
  }

  resume(id: number): void {
    const c = this.countdowns.get(id);
    if (c && !c.timer) this.start(id, c.remainingMs);
  }

  /** Animates the toast out, then removes it (at once when the person prefers reduced motion). */
  dismiss(id: number): void {
    const c = this.countdowns.get(id);
    if (c?.timer) clearTimeout(c.timer);
    this.countdowns.delete(id);
    if (this.reducedMotion()) {
      this.remove(id);
      return;
    }
    this.toasts.update((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => this.remove(id), TOAST_EXIT_MS);
  }

  private remove(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private reducedMotion(): boolean {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private durationFor(tone: ToastTone, message: string): number {
    const base = tone === 'error' ? MIN_ERROR_MS : MIN_MS;
    return Math.min(MAX_MS, Math.max(base, message.length * MS_PER_CHAR));
  }

  private start(id: number, ms: number): void {
    const previous = this.countdowns.get(id);
    if (previous?.timer) clearTimeout(previous.timer);
    this.countdowns.set(id, { timer: setTimeout(() => this.dismiss(id), ms), remainingMs: ms, startedAt: Date.now() });
  }

  /** Toasts pushed out by the visible limit no longer need a timer. */
  private forgetMissing(): void {
    const live = new Set(this.toasts().map((t) => t.id));
    for (const [id, c] of this.countdowns) {
      if (live.has(id)) continue;
      if (c.timer) clearTimeout(c.timer);
      this.countdowns.delete(id);
    }
  }
}
