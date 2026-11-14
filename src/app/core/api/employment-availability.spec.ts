import { availabilityByType } from './employment-availability';

describe('availabilityByType', () => {
  it('maps the live codes to ours and reads availability', () => {
    expect(
      availabilityByType([
        { code: 'government', isAvailable: true },
        { code: 'nysc-corper', isAvailable: true },
        { code: 'private-sector', isAvailable: false },
      ]),
    ).toEqual({ government: true, corper: true, 'private-sector': false });
  });

  it('ignores codes it does not know, including prototype keys', () => {
    expect(availabilityByType([{ code: 'astronaut', isAvailable: true }, { code: 'constructor', isAvailable: true }])).toEqual({});
  });
});
