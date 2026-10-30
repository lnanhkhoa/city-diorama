import { describe, expect, it } from 'vitest';
import { daytimeAt, formatLocalDate, localDaytime, type Weather } from '../src/weather/api';
import { kindFromWmo } from '../src/weather/codes';
import { surfaceFor } from '../src/weather/surface';

describe('kindFromWmo', () => {
  it.each([
    [0, 'clear'],
    [1, 'clear'],
    [2, 'clear'],
    [3, 'cloudy'],
    [45, 'fog'],
    [48, 'fog'],
    [51, 'rain'],
    [57, 'rain'],
    [61, 'rain'],
    [67, 'rain'],
    [80, 'rain'],
    [82, 'rain'],
    [71, 'snow'],
    [77, 'snow'],
    [85, 'snow'],
    [86, 'snow'],
    [95, 'rain'],
    [99, 'rain'],
  ])('maps WMO %i to %s', (code, kind) => {
    expect(kindFromWmo(code)).toBe(kind);
  });

  it('treats unknown codes as overcast rather than clear', () => {
    expect(kindFromWmo(4)).toBe('cloudy');
    expect(kindFromWmo(100)).toBe('cloudy');
  });
});

describe('surfaceFor', () => {
  const w = (over: Partial<Weather>): Weather => ({ kind: 'clear', tempC: 10, daytime: 'day', live: true, snowDepthM: 0, ...over });
  const snowy = { snow: true };

  it('draws no snow or ice in a no-snow city even when the feed reports snow', () => {
    expect(surfaceFor(w({ kind: 'snow', tempC: -5, snowDepthM: 0.3 }), { snow: false })).toMatchObject({ snow: 0, ice: 0 });
  });

  it('scales cover with lying snow under a clear sky, full at 5 cm', () => {
    expect(surfaceFor(w({ snowDepthM: 0.02 }), snowy).snow).toBeCloseTo(0.4);
    expect(surfaceFor(w({ snowDepthM: 0.2 }), snowy).snow).toBe(1);
    expect(surfaceFor(w({ kind: 'snow' }), snowy).snow).toBe(1);
  });

  it('freezes water below −2 °C and while snowing', () => {
    expect(surfaceFor(w({ tempC: -3 }), snowy).ice).toBe(1);
    expect(surfaceFor(w({ tempC: -1 }), snowy).ice).toBe(0);
  });

  it('wets ground in rain unless snow covers it', () => {
    expect(surfaceFor(w({ kind: 'rain' }), snowy)).toMatchObject({ wet: 1, fog: 0.25 });
    expect(surfaceFor(w({ kind: 'rain', snowDepthM: 0.04 }), snowy).wet).toBe(0);
  });
});

describe('city-local time', () => {
  // 2025-12-02 23:30 UTC: still Dec 2 in New York, already Dec 3 in Sydney.
  const instant = new Date(Date.UTC(2025, 11, 2, 23, 30));

  it('formats the date in the city timezone, not the viewer timezone', () => {
    expect(formatLocalDate('America/New_York', instant)).toBe('Tuesday, December 2, 2025');
    expect(formatLocalDate('Australia/Sydney', instant)).toBe('Wednesday, December 3, 2025');
  });

  it('picks the phase from the city local hour', () => {
    expect(localDaytime('America/New_York', instant)).toBe('dusk'); // 18:30
    expect(localDaytime('Australia/Sydney', instant)).toBe('day'); // 10:30
    expect(localDaytime('Asia/Tokyo', instant)).toBe('day'); // 08:30
    expect(localDaytime('Europe/Paris', instant)).toBe('dark'); // 00:30
    expect(localDaytime('Europe/London', new Date(Date.UTC(2025, 11, 2, 19, 0)))).toBe('night'); // 19:00 sunset boundary
    expect(localDaytime('Europe/London', new Date(Date.UTC(2025, 11, 2, 6, 0)))).toBe('dawn'); // 06:00 sunrise boundary
  });
});

describe('daytimeAt', () => {
  it('splits lit hours into dawn, day and dusk at 08:00 and 17:00', () => {
    expect(daytimeAt(7, true)).toBe('dawn');
    expect(daytimeAt(8, true)).toBe('day');
    expect(daytimeAt(16, true)).toBe('day');
    expect(daytimeAt(17, true)).toBe('dusk');
  });

  it('splits unlit hours into night and dark from 23:00 to before 04:00', () => {
    expect(daytimeAt(22, false)).toBe('night');
    expect(daytimeAt(23, false)).toBe('dark');
    expect(daytimeAt(3, false)).toBe('dark');
    expect(daytimeAt(4, false)).toBe('night');
  });

  it('lets the sun override the clock (polar summer evenings, winter mornings)', () => {
    expect(daytimeAt(22, true)).toBe('dusk');
    expect(daytimeAt(9, false)).toBe('night');
  });
});
