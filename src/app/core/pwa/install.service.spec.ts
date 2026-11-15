import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ToastService } from '../toast/toast.service';
import { InstallService } from './install.service';

describe('InstallService', () => {
  beforeEach(() => localStorage.clear());

  it('offers the install until it is dismissed, and remembers the dismissal', () => {
    const install = TestBed.inject(InstallService);
    expect(install.offer()).toBe(true);
    install.dismiss();
    expect(install.offer()).toBe(false);
    expect(localStorage.getItem('princeps.install.dismissed')).toBe('1');
  });

  it('explains how to install by hand when the browser gives no install prompt', async () => {
    const install = TestBed.inject(InstallService);
    const toast = TestBed.inject(ToastService);
    await install.install();
    expect(toast.toasts()).toHaveLength(1);
    expect(toast.toasts()[0].tone).toBe('info');
  });
});
