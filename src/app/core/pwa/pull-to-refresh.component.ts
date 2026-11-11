import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TPipe } from '../i18n/t.pipe';
import { HapticsService } from '../ui/haptics.service';

const THRESHOLD = 72;
const MAX_PULL = 110;

/**
 * Pull down from the top of the page to reload it, like a phone app. The installed app has no browser reload
 * button, so this is how a customer refreshes a stuck screen. It only reacts to a downward drag that starts while the
 * page is at the very top, never inside a window or while a text box is being used.
 */
@Component({
  selector: 'app-pull-to-refresh',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:touchstart)': 'start($event)',
    '(document:touchmove)': 'move($event)',
    '(document:touchend)': 'end()',
    '(document:touchcancel)': 'cancel()',
    '(window:scroll)': 'onScroll()',
  },
  template: `
    @if (pull() > 0 || loading()) {
      <div class="ptr" role="status" [style.transform]="'translateY(' + offset() + 'px)'" [class.is-ready]="ready()" [class.is-loading]="loading()">
        <svg class="icon" [style.transform]="loading() ? null : 'rotate(' + rotation() + 'deg)'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 11a8 8 0 1 0-2.3 5.7" />
          <path d="M20 4v7h-7" />
        </svg>
        <span>{{ (loading() ? 'ptr.loading' : ready() ? 'ptr.release' : 'ptr.pull') | t }}</span>
      </div>
    }
  `,
  styles: [
    `
      .ptr {
        position: fixed; top: calc(env(safe-area-inset-top) - 52px); left: 50%; margin-left: -80px; width: 160px; z-index: 90;
        display: flex; align-items: center; justify-content: center; gap: var(--space-2);
        height: 40px; border-radius: var(--radius-pill); pointer-events: none;
        background: var(--surface-0); color: var(--ink); border: 1px solid var(--hairline-strong); box-shadow: var(--shadow-2);
        font-size: var(--fs-sm); font-weight: 500;
      }
      .icon { flex: none; }
      .is-ready .icon { color: var(--text-accent); }
      .is-loading .icon { animation: ptr-spin 800ms linear infinite; }
      @keyframes ptr-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .is-loading .icon { animation: none; } }
    `,
  ],
})
export class PullToRefreshComponent {
  private readonly haptics = inject(HapticsService);

  protected readonly pull = signal(0);
  protected readonly loading = signal(false);
  protected readonly ready = computed(() => this.pull() >= THRESHOLD);
  protected readonly offset = computed(() => (this.loading() ? 64 : this.pull()));
  protected readonly rotation = computed(() => Math.min(this.pull() / THRESHOLD, 1) * 270);

  private startY: number | null = null;
  private startX = 0;
  private wasReady = false;

  protected start(e: TouchEvent): void {
    this.startY = null;
    if (this.loading() || e.touches.length !== 1 || window.scrollY > 0) return;
    const target = e.target as Element | null;
    // Not while a window is open, a field is being used, or the drag begins inside something that scrolls on its own.
    if (document.querySelector('dialog[open]')) return;
    if (target?.closest?.('input, textarea, select, [contenteditable], app-pdf-viewer, video')) return;
    this.startY = e.touches[0].clientY;
    this.startX = e.touches[0].clientX;
  }

  protected move(e: TouchEvent): void {
    if (this.startY === null) return;
    const dy = e.touches[0].clientY - this.startY;
    const dx = Math.abs(e.touches[0].clientX - this.startX);
    if (dy <= 0 || dx > dy || window.scrollY > 0) {
      if (this.pull() > 0) this.pull.set(0);
      return;
    }
    this.pull.set(Math.min(MAX_PULL, dy * 0.5));
    if (this.ready() && !this.wasReady) this.haptics.step();
    this.wasReady = this.ready();
  }

  protected end(): void {
    if (this.startY === null) return;
    const go = this.ready();
    this.startY = null;
    this.wasReady = false;
    if (go) {
      this.loading.set(true);
      this.pull.set(0);
      this.haptics.success();
      setTimeout(() => location.reload(), 350);
    } else {
      this.pull.set(0);
    }
  }

  protected cancel(): void {
    this.startY = null;
    this.wasReady = false;
    this.pull.set(0);
  }

  /** Tells the stylesheet the page has moved, so a solid strip can cover the status bar area. */
  protected onScroll(): void {
    document.documentElement.classList.toggle('is-scrolled', window.scrollY > 4);
  }
}
