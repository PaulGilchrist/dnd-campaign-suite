// @maintained-by-ai
// ── diceRoller DEV forced-d20 seam lane ──────────────────────────────
// Owns the harness seam added by backlog 2026-11-20 BBB: globalThis.__forceNextD20
// (one-shot arm → consume → auto-disarm) plus the `?testRoll=<n>` URL-param
// arming lane, both gated on import.meta.env.DEV. Mirrors the attach/guard/
// stubEnv pattern of Map3D.dev-census.test.jsx (which pins __map3d). The seam
// is a pin-FREE override — an armed roll consumes ZERO Math.random calls, so
// other RNG consumers (utils.guid() et al.) are provably untouched (#AC4).
// ./diceRoller.test.js owns the RNG engine math; nothing here duplicates it.
// ─────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Fresh module instance per case: the seam state (forcedD20) is module-level
// and the DEV attach + URL-param read run at import time.
async function freshImport() {
  vi.resetModules();
  return import('./diceRoller.js');
}

// Mock Math.random to a fixed face (never consumed while an override is armed;
// consumption counts are asserted to prove zero RNG bleed).
function mockRandomAt(value) {
  return vi.spyOn(Math, 'random').mockReturnValue(value);
}

const setUrl = (search) => window.history.replaceState({}, '', `/${search}`);

describe('diceRoller dev forced-d20 seam', () => {
  beforeEach(() => {
    setUrl('');
  });

  afterEach(() => {
    globalThis.__forceNextD20?.(null);
    delete globalThis.__forceNextD20;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('arm→consume is one-shot: exact value with zero RNG, next roll random again', async () => {
    const { rollD20 } = await freshImport();
    expect(globalThis.__forceNextD20).toBeTypeOf('function'); // DEV attach

    expect(globalThis.__forceNextD20(20)).toBe(true);
    const rng = mockRandomAt(0.4); // unpinned face would be 9
    expect(rollD20()).toBe(20);
    expect(rng).toHaveReturnedTimes(0); // seam never touches the global RNG
    expect(rollD20()).toBe(9); // auto-disarmed: following roll is random again
    expect(rng).toHaveReturnedTimes(1);
  });

  it('disarming with null drops a pending armed value', async () => {
    const { rollD20 } = await freshImport();
    expect(globalThis.__forceNextD20(5)).toBe(true);
    expect(globalThis.__forceNextD20(null)).toBe(true);
    const rng = mockRandomAt(0.4);
    expect(rollD20()).toBe(9);
    expect(rng).toHaveReturnedTimes(1);
  });

  it.each([
    { label: 'zero', value: 0 },
    { label: 'above 20', value: 21 },
    { label: 'negative', value: -3 },
    { label: 'non-integer', value: 1.5 },
    { label: 'string', value: '20' },
    { label: 'NaN', value: NaN },
    { label: 'undefined', value: undefined },
  ])('rejects $label ($value) with a loud console.error and stays unarmed', async ({ value }) => {
    const { rollD20 } = await freshImport();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(globalThis.__forceNextD20(value)).toBe(false);
    expect(err).toHaveBeenCalledTimes(1);
    const rng = mockRandomAt(0.4);
    expect(rollD20()).toBe(9); // rejection never armed the seam
    expect(rng).toHaveReturnedTimes(1);
  });

  it.each([1, 20])('?testRoll=%i URL param arms the one-shot at load, page-side', async (face) => {
    setUrl(`?testRoll=${face}`);
    const { rollD20 } = await freshImport(); // param read happens at import
    const rng = mockRandomAt(0.4); // would give 9 unpinned
    expect(rollD20()).toBe(face);
    expect(rng).toHaveReturnedTimes(0);
    expect(rollD20()).toBe(9); // one-shot: param force does not stick
    expect(rng).toHaveReturnedTimes(1);
  });

  it('invalid ?testRoll= value logs the rejection and leaves rolls random', async () => {
    setUrl('?testRoll=abc');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rollD20 } = await freshImport();
    expect(err).toHaveBeenCalledTimes(1);
    const rng = mockRandomAt(0.4);
    expect(rollD20()).toBe(9);
    expect(rng).toHaveReturnedTimes(1);
  });

  it('production builds (DEV=false): handle absent, ?testRoll= inert, roll always random', async () => {
    vi.stubEnv('DEV', false); // pins the import.meta.env.DEV guard branches
    expect(import.meta.env.DEV).toBe(false);
    setUrl('?testRoll=20');
    const { rollD20 } = await freshImport();
    expect(globalThis.__forceNextD20).toBeUndefined(); // never attached
    const rng = mockRandomAt(0.4);
    expect(rollD20()).toBe(9); // URL param armed nothing
    expect(rng).toHaveReturnedTimes(1);
  });
});
