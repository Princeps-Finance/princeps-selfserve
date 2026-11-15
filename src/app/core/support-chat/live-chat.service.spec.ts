import { chatAllowedOn } from './live-chat.service';

describe('chatAllowedOn', () => {
  it('blocks the screens where a BVN, code or ID number is typed', () => {
    for (const url of ['/apply/bvn', '/apply/bvn?error=not-found', '/apply/verify', '/apply/nin']) {
      expect(chatAllowedOn(url)).toBe(false);
    }
  });

  it('allows the other screens', () => {
    for (const url of ['/', '/apply/welcome', '/apply/offers', '/apply/status', '/apply/loans/abc']) {
      expect(chatAllowedOn(url)).toBe(true);
    }
  });
});
