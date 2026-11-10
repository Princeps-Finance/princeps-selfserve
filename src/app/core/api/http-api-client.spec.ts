import { TestBed } from '@angular/core/testing';
import { ApiUnavailableError, HttpApiClient } from './http-api-client';

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('HttpApiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: HttpApiClient;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    client = TestBed.inject(HttpApiClient);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('stores the application token from a verified OTP and sends it afterwards', async () => {
    fetchMock.mockResolvedValueOnce(reply({ status: 'ok', token: 'tok-123' }));
    expect(await client.verifyPhoneOtp('+2348031112233', '123456')).toEqual({ status: 'ok' });

    fetchMock.mockResolvedValueOnce(reply({ status: 'ok', monthlyIncome: 1, accountName: 'A' }));
    await client.verifySalary({ channel: 'ippis', bankCode: '058', accountNumber: '0123456789', fullName: 'Ada Obi' });
    const headers = fetchMock.mock.calls[1][1].headers as Record<string, string>;
    expect(headers['X-Application-Token']).toBe('tok-123');
  });

  it('fails closed when the backoffice says ok but issues no token', async () => {
    fetchMock.mockResolvedValueOnce(reply({ status: 'ok' }));
    await expect(client.verifyPhoneOtp('+2348031112233', '123456')).rejects.toBeInstanceOf(
      ApiUnavailableError,
    );
  });

  it('maps wrong, expired and rate-limited OTP results', async () => {
    fetchMock.mockResolvedValueOnce(reply({ status: 'wrong' }));
    expect(await client.verifyPhoneOtp('+2348031112233', '000001')).toEqual({ status: 'wrong' });
    fetchMock.mockResolvedValueOnce(reply({ status: 'expired' }));
    expect(await client.verifyPhoneOtp('+2348031112233', '000002')).toEqual({ status: 'expired' });
    fetchMock.mockResolvedValueOnce(reply({ error: { code: 'RATE_LIMITED' } }, 429));
    expect(await client.verifyPhoneOtp('+2348031112233', '000003')).toEqual({
      status: 'locked',
      retryAfterSeconds: 60,
    });
  });

  it('never reports a verification as ok when the network fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await client.verifyBvn('12345678901', 'Ada Obi', '1990-01-01')).toEqual({ status: 'service-down' });
    expect(await client.verifyNin('12345678901', 'Ada Obi', '1990-01-01')).toEqual({ status: 'service-down' });
    expect(
      await client.verifySalary({ channel: 'ippis', bankCode: '058', accountNumber: '0123456789', fullName: 'Ada Obi' }),
    ).toEqual({ status: 'service-down' });
    await expect(client.sendPhoneOtp('+2348031112233')).rejects.toBeInstanceOf(ApiUnavailableError);
  });

  it('falls back to the static bank list when the service is down', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const banks = await client.listBanks();
    expect(banks.length).toBeGreaterThan(10);
  });

  it('submit: returns the backoffice id and never invents an outcome on failure', async () => {
    const loan = { productId: 'ippis-advance' } as never;
    fetchMock.mockResolvedValueOnce(reply({ id: 'LN-1' }));
    const ok = await client.submitApplication({ loan } as never);
    expect(ok).toEqual({ status: 'received', referenceId: 'LN-1' });

    fetchMock.mockResolvedValueOnce(reply({ error: { code: 'UPSTREAM_DOWN' } }, 502));
    await expect(client.submitApplication({ loan } as never)).rejects.toBeInstanceOf(
      ApiUnavailableError,
    );
    await expect(client.submitApplication({} as never)).rejects.toBeInstanceOf(ApiUnavailableError);
  });

  it('only ever offers an https mandate link', async () => {
    fetchMock.mockResolvedValueOnce(reply({ url: 'javascript:alert(1)', reference: 'MD-123' }));
    await expect(
      client.createMandateLink({ productId: 'p', channel: 'ippis', monthlyAmount: 1000, tenorMonths: 6 }),
    ).rejects.toBeInstanceOf(ApiUnavailableError);
    fetchMock.mockResolvedValueOnce(reply({ url: 'https://bank.example/m/1', reference: 'MD-123' }));
    const link = await client.createMandateLink({ productId: 'p', channel: 'ippis', monthlyAmount: 1000, tenorMonths: 6 });
    expect(link.url).toBe('https://bank.example/m/1');
  });

  it('treats an unknown mandate status as pending', async () => {
    fetchMock.mockResolvedValueOnce(reply({ status: 'weird' }));
    expect(await client.getMandateStatus('MD-123')).toBe('pending');
    fetchMock.mockResolvedValueOnce(reply({ status: 'completed' }));
    expect(await client.getMandateStatus('MD-123')).toBe('completed');
  });

  it('sends the bot-check token with the OTP request when there is one', async () => {
    fetchMock.mockResolvedValueOnce(reply({ target: 'x', expiresInSeconds: 1 }));
    await client.sendPhoneOtp('+2348031112233', 'captcha-token');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ phone: '+2348031112233', captchaToken: 'captcha-token' });
  });

  it('rejects oversized documents without calling the network', async () => {
    const r = await client.uploadDocument({ docId: 'id', fileName: 'a.pdf', sizeBytes: 11 * 1024 * 1024 });
    expect(r).toEqual({ status: 'too-large' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the same Idempotency-Key when the same mandate is requested again, and a new one for a different amount', async () => {
    const link = { url: 'https://pay.test/x', reference: 'MND-1' };
    const ask = (monthlyAmount: number) => client.createMandateLink({ productId: 'p', channel: 'ippis', monthlyAmount, tenorMonths: 12 });
    fetchMock.mockImplementation(() => Promise.resolve(reply(link)));
    await ask(31_966);
    await ask(31_966);
    await ask(40_000);
    const keys = fetchMock.mock.calls.map((c) => (c[1].headers as Record<string, string>)['Idempotency-Key']);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });
});
