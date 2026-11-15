import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import handlerOp from '../../api/selfserve/[op]';
import stateEmployers from '../../api/state-employers';
import { toBanks, toLgas, toStateGovernments, v2Get } from '../../api/_lib/v2';

const envelope = (data: unknown, status = 'success') =>
  new Response(JSON.stringify({ statusCode: 200, code: 'SUCCESS', message: 'Success', data, status, timestamp: 't' }));

let ip = 0;
const post = (op: string, body: unknown) =>
  new Request(`https://selfserve.example.com/api/selfserve/${op}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'selfserve.example.com', origin: 'https://selfserve.example.com', 'x-forwarded-for': `198.19.0.${++ip}` },
    body: JSON.stringify(body),
  });

describe('v2 reference lists', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    process.env['SELF_SERVICE_API_URL'] = 'https://api.test';
    delete process.env['BACKOFFICE_API_URL'];
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env['SELF_SERVICE_API_URL'];
  });

  it('v2Get returns the data of a success envelope and null for anything else', async () => {
    fetchMock.mockResolvedValueOnce(envelope([1]));
    expect(await v2Get('/x')).toEqual([1]);
    fetchMock.mockResolvedValueOnce(envelope([1], 'error'));
    expect(await v2Get('/x')).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 502 }));
    expect(await v2Get('/x')).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error('down'));
    expect(await v2Get('/x')).toBeNull();
  });

  it('serves the bank list from v2 without needing the back-office key', async () => {
    fetchMock.mockResolvedValueOnce(envelope([{ code: '044', name: 'Access Bank' }, { code: '044', name: 'dup' }, { code: '', name: 'x' }, { code: '999992', name: 'Opay' }]));
    const res = await handlerOp(post('banks', {}));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ banks: [{ code: '044', name: 'Access Bank' }, { code: '999992', name: 'Opay' }] });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/v2/banks');
  });

  it('serves local governments by turning the state name into v2\'s state code', async () => {
    fetchMock
      .mockResolvedValueOnce(envelope([{ code: 'AB', name: 'Abia' }, { code: 'AD', name: 'Adamawa' }]))
      .mockResolvedValueOnce(envelope(['Demsa', 'Fufure', 'Yola North']));
    const res = await handlerOp(post('lgas', { state: 'adamawa' }));
    expect(await res.json()).toEqual({ lgas: ['Demsa', 'Fufure', 'Yola North'] });
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.test/api/v2/states/AD/lgas');
  });

  it('answers an empty list for a state v2 does not know, and refuses a bad body', async () => {
    fetchMock.mockResolvedValueOnce(envelope([{ code: 'AB', name: 'Abia' }]));
    expect(await (await handlerOp(post('lgas', { state: 'Atlantis' }))).json()).toEqual({ lgas: [] });
    expect((await handlerOp(post('lgas', { state: 'a' }))).status).toBe(400);
  });

  it('turns the MDAs into the app\'s state list, one entry per MDA, named by state', async () => {
    expect(toStateGovernments([{ code: 'ondo-state-government', name: 'Ondo State Government', state: 'Ondo' }, { code: 'bad' }, { code: 'ondo-state-government', state: 'Ondo' }])).toEqual([
      { code: 'ondo-state-government', name: 'Ondo', channel: 'remita', employers: [] },
    ]);
    fetchMock.mockResolvedValueOnce(envelope([{ code: 'gombe-state-government', name: 'Gombe State Government', state: 'Gombe' }]));
    const res = await stateEmployers(new Request('https://selfserve.example.com/api/state-employers', { headers: { host: 'selfserve.example.com', 'x-forwarded-for': '198.19.1.1' } }));
    expect(await res.json()).toEqual({ states: [{ code: 'gombe-state-government', name: 'Gombe', channel: 'remita', employers: [] }] });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/v2/mdas');
  });

  it('cleans lists of rows that are not what v2 promises', () => {
    expect(toBanks('nope')).toEqual([]);
    expect(toLgas(['A', '', 3, ' B '])).toEqual(['A', 'B']);
  });
});
