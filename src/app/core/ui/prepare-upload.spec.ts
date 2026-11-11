import { prepareUpload } from './prepare-upload';

const file = (name: string, type: string, bytes: number) => new File([new Uint8Array(bytes)], name, { type });

describe('prepareUpload', () => {
  it('refuses a type that cannot be reviewed', async () => {
    expect(await prepareUpload(file('a.exe', 'application/octet-stream', 50_000))).toEqual({ ok: false, reason: 'bad-type' });
  });

  it('refuses a file too small to be a page', async () => {
    expect(await prepareUpload(file('a.jpg', 'image/jpeg', 100))).toEqual({ ok: false, reason: 'too-small' });
  });

  it('lets a PDF and a small photo through unchanged', async () => {
    const pdf = file('a.pdf', 'application/pdf', 4 * 1024 * 1024);
    expect(await prepareUpload(pdf)).toMatchObject({ ok: true, shrunk: false, file: pdf });
    const photo = file('a.jpg', 'image/jpeg', 200_000);
    expect(await prepareUpload(photo)).toMatchObject({ ok: true, shrunk: false, file: photo });
  });

  it('knows the type from the name when the browser gives none', async () => {
    expect(await prepareUpload(file('scan.pdf', '', 50_000))).toMatchObject({ ok: true });
  });
});
