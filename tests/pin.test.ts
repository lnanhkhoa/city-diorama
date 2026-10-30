import { describe, expect, it } from 'vitest';
import type { Weather } from '../src/weather/api';
import { applyPin, pinFromSearch, writePin } from '../src/weather/pin';

describe('pinFromSearch', () => {
  it('reads valid kind and phase', () => {
    expect(pinFromSearch(new URLSearchParams('weather=rain&time=dusk'))).toEqual({ kind: 'rain', daytime: 'dusk' });
  });

  it('ignores unknown, removed and inherited-key values', () => {
    expect(pinFromSearch(new URLSearchParams('weather=toString&time=noon'))).toEqual({ kind: null, daytime: null });
    for (const old of ['storm', 'drizzle', 'partly']) expect(pinFromSearch(new URLSearchParams(`weather=${old}`)).kind).toBeNull();
  });
});

describe('writePin', () => {
  it('sets pinned keys, drops unpinned ones and keeps the rest', () => {
    const params = new URLSearchParams('weather=snow&time=night&x=1');
    writePin(params, { kind: 'fog', daytime: null });
    expect(params.toString()).toBe('weather=fog&x=1');
  });
});

describe('applyPin', () => {
  const reported: Weather = { kind: 'clear', tempC: 21, daytime: 'day', live: true, snowDepthM: 0 };
  const snowy = { snow: true };
  const tropical = { snow: false };

  it('overrides only the pinned fields', () => {
    expect(applyPin(reported, { kind: null, daytime: 'night' }, snowy)).toEqual({ ...reported, daytime: 'night' });
    expect(applyPin(reported, { kind: 'fog', daytime: null }, snowy)).toEqual({ ...reported, kind: 'fog' });
    expect(applyPin(reported, { kind: 'snow', daytime: null }, snowy)).toEqual({ ...reported, kind: 'snow' });
  });

  it('ignores a snow pin in a no-snow city but keeps the time pin', () => {
    const typical: Weather = { ...reported, kind: 'rain', live: false };
    expect(applyPin(typical, { kind: 'snow', daytime: 'dusk' }, tropical)).toEqual({ ...typical, daytime: 'dusk' });
    expect(applyPin(typical, { kind: 'fog', daytime: null }, tropical)).toEqual({ ...typical, kind: 'fog' });
  });

  it('never reports snow in a no-snow city, whatever the feed says', () => {
    expect(applyPin({ ...reported, kind: 'snow' }, { kind: null, daytime: null }, tropical).kind).toBe('cloudy');
  });
});
