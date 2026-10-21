import { describe, expect, it } from 'vitest';
import type { Weather } from '../src/weather/api';
import { applyPin, pinFromSearch, writePin } from '../src/weather/pin';

describe('pinFromSearch', () => {
  it('reads valid kind and phase', () => {
    expect(pinFromSearch(new URLSearchParams('weather=rain&time=dusk'))).toEqual({ kind: 'rain', daytime: 'dusk' });
  });

  it('ignores unknown and inherited-key values', () => {
    expect(pinFromSearch(new URLSearchParams('weather=toString&time=noon'))).toEqual({ kind: null, daytime: null });
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
  const reported: Weather = { kind: 'clear', tempC: 21, daytime: 'day', live: true };

  it('overrides only the pinned fields', () => {
    expect(applyPin(reported, { kind: null, daytime: 'night' })).toEqual({ ...reported, daytime: 'night' });
    expect(applyPin(reported, { kind: 'storm', daytime: null })).toEqual({ ...reported, kind: 'storm' });
  });
});
