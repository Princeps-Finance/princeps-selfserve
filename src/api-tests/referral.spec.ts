import handler from '../../api/referral';

let ip = 0;
function req(body: unknown, origin = 'https://selfserve.example.com'): Request {
  return new Request('https://selfserve.example.com/api/referral', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'selfserve.example.com',
      origin,
      'x-forwarded-for': `203.0.113.${++ip}`,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/referral', () => {
  it('answers with the discount for a real code, in any case', async () => {
    const res = await handler(req({ code: ' welcome ' }));
    expect(await res.json()).toEqual({ valid: true, code: 'WELCOME', rateDiscountPct: 0.75, label: '0.75% rate discount' });
  });

  it('answers valid:false for an unknown or badly formed code, and never lists codes', async () => {
    expect(await (await handler(req({ code: 'NOPE123' }))).json()).toEqual({ valid: false });
    expect(await (await handler(req({ code: '../etc' }))).json()).toEqual({ valid: false });
    expect(await (await handler(req({ code: 'toString' }))).json()).toEqual({ valid: false });
  });

  it('refuses foreign origins and slows down guessing from one address', async () => {
    expect((await handler(req({ code: 'WELCOME' }, 'https://evil.example'))).status).toBe(403);
    const same = { 'x-forwarded-for': '203.0.113.250' };
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = new Request('https://selfserve.example.com/api/referral', {
        method: 'POST',
        headers: { 'content-type': 'application/json', host: 'selfserve.example.com', origin: 'https://selfserve.example.com', ...same },
        body: JSON.stringify({ code: `GUESS${i}` }),
      });
      statuses.push((await handler(r)).status);
    }
    expect(statuses.filter((s) => s === 429).length).toBe(2);
  });
});
