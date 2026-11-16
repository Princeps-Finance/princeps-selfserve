import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ApplicationApi } from '../data-access/application.api';
import { CompletionComponent } from './completion.component';

describe('DigiSign verification', () => {
  it('opens the signing URL and checks verification after the applicant returns', async () => {
    const signingUrl = 'https://sandbox.usedigisign.dev/sign/example';
    const getIdentityStatus = vi
      .fn()
      .mockResolvedValueOnce({ digisignAvailable: true, status: 'NOT_STARTED', done: false })
      .mockResolvedValueOnce({ digisignAvailable: true, status: 'VERIFIED', done: true });
    const startIdentityVerification = vi.fn().mockResolvedValue({
      digisignAvailable: true,
      status: 'PENDING',
      done: false,
      signingUrl,
    });
    const getDocuments = vi.fn();
    const signingTab = { opener: window, closed: false, location: { replace: vi.fn() } };
    const open = vi.spyOn(window, 'open').mockReturnValue(signingTab as unknown as Window);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { page: 'verify-identity' } } } },
        {
          provide: ApplicationApi,
          useValue: {
            getIdentityStatus,
            startIdentityVerification,
            getDocuments,
          },
        },
      ],
    });
    try {
      const fixture = TestBed.createComponent(CompletionComponent);
      const screen = fixture.nativeElement as HTMLElement;
      await fixture.whenStable();
      expect(screen.querySelector('input[type="file"], video')).toBeNull();
      expect(getDocuments).not.toHaveBeenCalled();
      const start = [...screen.querySelectorAll('button')].find((button) =>
        button.textContent.includes('Start DigiSign'),
      );
      expect(start).toBeDefined();
      start!.click();
      expect(open).toHaveBeenCalledWith('about:blank', '_blank');
      await fixture.whenStable();
      expect(signingTab.location.replace).toHaveBeenCalledWith(signingUrl);
      expect(signingTab.opener).toBeNull();

      window.dispatchEvent(new Event('focus'));
      await fixture.whenStable();
      expect(getIdentityStatus).toHaveBeenCalledTimes(2);
      expect(screen.textContent).toContain('Identity verification complete.');
    } finally {
      open.mockRestore();
    }
  });
});
