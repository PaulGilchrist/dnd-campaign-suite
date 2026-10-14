// @maintained-by-ai: 2026-10-14
/**
 * src/encounters/combatData.js is a shim consumed by src/services/combat/steps/*.js.
 * Full behavioral coverage of every function lives in
 * src/services/encounters/combatData.test.js; these tests pin the shim's
 * re-export identity and the live change-data contract end-to-end through it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as combatData from './combatData.js';
import * as realCombatData from '../services/encounters/combatData.js';

const CAMPAIGN = 'test-campaign';

/** Stub fetch to serve a change-data payload (or a 500 when ok=false). */
function stubFetch(changeData, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue(
    ok
      ? { ok: true, json: () => Promise.resolve(changeData) }
      : { ok: false, status: 500, statusText: 'Internal Server Error', json: () => Promise.resolve({}) }
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  combatData.setCombatSummaryCache(null, CAMPAIGN);
});

describe('combatData shim (src/encounters/combatData.js)', () => {
  it('re-exports every binding from services/encounters/combatData.js', () => {
    const names = Object.keys(combatData).sort();
    expect(names.length).toBeGreaterThan(0);
    expect(names).toEqual(Object.keys(realCombatData).sort());
    for (const name of names) {
      expect(combatData[name]).toBe(realCombatData[name]);
    }
  });

  it('serves the live combat-context contract through the shim path', async () => {
    const fetchMock = stubFetch({
      combatSummary: { round: 5, creatures: [{ name: 'Orc' }], activeCreatureName: 'StaleOrc' },
      // MA-1966: the live top-level tracker key wins over the baked field
      activeCreatureName: 'LiveGoblin',
    });

    const summary = await combatData.loadCombatSummary(CAMPAIGN);
    expect(fetchMock).toHaveBeenCalledWith(`/api/campaigns/${CAMPAIGN}/change-data`);
    expect(summary.activeCreatureName).toBe('LiveGoblin');
    expect(combatData.getCombatSummary(CAMPAIGN)).toBe(summary);
    expect(combatData.getCurrentCombatRound(CAMPAIGN)).toBe(5);
    expect(combatData.getActiveCreatureName(CAMPAIGN)).toBe('LiveGoblin');
    expect(await combatData.loadCurrentCombatRound(CAMPAIGN)).toBe(5);
    expect(await combatData.loadActiveCreatureName(CAMPAIGN)).toBe('LiveGoblin');
  });

  it('falls back to the first creature when no active name is provided', async () => {
    stubFetch({ combatSummary: { round: 1, creatures: [{ name: 'Orc' }, { name: 'Goblin' }] } });
    const summary = await combatData.loadCombatSummary(CAMPAIGN);
    expect(summary.activeCreatureName).toBe('Orc');
    expect(combatData.getActiveCreatureName(CAMPAIGN)).toBe('Orc');
  });

  it('returns null summary and round-1 defaults when the API fails', async () => {
    stubFetch({}, false);
    expect(await combatData.loadCombatSummary(CAMPAIGN)).toBeNull();
    expect(await combatData.loadActiveCreatureName(CAMPAIGN)).toBeNull();
    expect(await combatData.loadCurrentCombatRound(CAMPAIGN)).toBe(1);
    expect(combatData.getCombatSummary(CAMPAIGN)).toBeNull();
    expect(combatData.getCurrentCombatRound(CAMPAIGN)).toBe(1);
    expect(combatData.getActiveCreatureName(CAMPAIGN)).toBeNull();
  });
});
