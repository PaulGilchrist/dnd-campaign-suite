// @maintained-by-ai
/**
 * Lane: canonical combat-data cache seam — src/services/encounters/combatData.js.
 * Pins the in-memory per-campaign combatSummary cache, the transport load via
 * getCombatContext (change-data), and the activeCreatureName resolution ladders.
 *
 * Consumers (non-exhaustive; dozens of consumer tests stub this module wholesale):
 *   App.jsx / Initiative.jsx        setCombatSummaryCache SSE seed (#1059 seam)
 *   encounterToInitiative.js        loadCombatSummary
 *   clearAllExpirationEffects.js    get + set (per-#app 'combat-scoped' clears)
 *   executeManeuver / knowEnemy / hurlThroughHell / executeActionManeuvers  getCurrentCombatRound
 *   quiveringPalm / bonusAttacks / turnStartEffects / monsterSummon / spellOverlayService  getCombatSummary
 *
 * Cite split (do not duplicate here):
 *   - Shim re-export identity + MA-1966 top-level-wins: src/encounters/combatData.test.js
 *   - URL-encoded change-data tuple (encodeURIComponent): src/services/rules/combat/damageUtils.test.js:175
 *   - Consumer-side real-cache decoy run: superiorHuntersPrey.integration.test.js (#1059)
 *
 * Defect-root cites (#1052 evidence chain, falsifiable at this root):
 *   #1052  getCombatSummary(undefined) → null (combatData.js:48) → getCurrentCombatRound
 *          const-1 fallback (combatData.js:81) → epitome/colossusSlayer/crusher
 *          once-per-rest latches stamp round 1. Pinned exactly in the key-miss table.
 *   #1050  Off-campaign cache entries are decoys — a miss on any other key must read
 *          null / round 1, never the primed campaign's live summary.
 *   #940   Round fallback honesty: absent round reads as 1 at every seam, never wall-clock.
 *   #967   resolveActiveCreatureName ladder exact winner: API bytes > creatures[0] >
 *          runtime top-level — and loadActiveCreatureName deliberately SKIPS creatures[0].
 *   #1010  Plain transport tuple; encoding covered upstream at damageUtils.test.js:175.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as combatData from './combatData.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';
const OFF_CAMPAIGN = 'other-campaign';

// Real change-data combatSummary shape (superiorHuntersPrey.integration.test.js family):
// { round, activeCreatureName?, creatures: [{ name, type?, currentHp?, maxHp? }] }
const SUMMARY = {
  round: 4,
  activeCreatureName: 'Thorndeer',
  creatures: [
    { name: 'Thorndeer', type: 'player', currentHp: 27, maxHp: 27 },
    { name: 'Goblin1', type: 'npc', currentHp: 7, maxHp: 7 },
  ],
};

// Fresh clone per serve: resolveActiveCreatureName mutates the loaded object.
const serveSummary = () => JSON.parse(JSON.stringify(SUMMARY));

function stubFetch(payload, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue(
    ok
      ? { ok: true, status: 200, statusText: 'OK', json: async () => ({ combatSummary: payload }) }
      : { ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) }
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function stubFetchReject() {
  const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('combatData cache seam', () => {
  let runtimeSpy;

  beforeEach(() => {
    // Runtime fallback is synchronous in-memory; default it to absent so every
    // ladder leg is explicit and re-armed each test (#1057 determinism).
    runtimeSpy = vi.spyOn(useRuntimeState, 'getRuntimeValue').mockReturnValue(null);
    combatData.setCombatSummaryCache(null, CAMPAIGN);
    combatData.setCombatSummaryCache(null, OFF_CAMPAIGN);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    combatData.setCombatSummaryCache(null, CAMPAIGN);
    combatData.setCombatSummaryCache(null, OFF_CAMPAIGN);
  });

  describe('cached reads (setCombatSummaryCache + get*)', () => {
    it.each([
      ['primed summary', SUMMARY, 4, 'Thorndeer'],
      ['empty-string activeCreatureName reads null (|| semantics)',
        { ...SUMMARY, activeCreatureName: '' }, 4, null],
      ['round-less summary falls back to round 1, never wall-clock (#940)',
        { creatures: SUMMARY.creatures }, 1, null],
    ])('%s', (_label, stored, roundExpect, nameExpect) => {
      combatData.setCombatSummaryCache(stored, CAMPAIGN);
      // getCombatSummary hands back the stored reference — cache-mutation semantics
      // live here (Initiative.jsx SSE seeds the same object, #1059 seam).
      expect(combatData.getCombatSummary(CAMPAIGN)).toBe(stored);
      expect(combatData.getCurrentCombatRound(CAMPAIGN)).toBe(roundExpect);
      expect(combatData.getActiveCreatureName(CAMPAIGN)).toBe(nameExpect);
    });

    // #1052 ROOT (:48 → :81) + #1050 decoy: with a live summary cached for
    // CAMPAIGN, every other key must read the honest miss — never the decoy.
    it.each([
      ['unknown campaign', OFF_CAMPAIGN],
      ['undefined campaign (#1052: latches see round 1)', undefined],
      ['null campaign', null],
      ['empty-string campaign', ''],
    ])('campaign-key miss → null / round 1 with decoy primed: %s', (_label, key) => {
      combatData.setCombatSummaryCache(serveSummary(), CAMPAIGN);
      expect(combatData.getCombatSummary(key)).toBeNull();
      expect(combatData.getCurrentCombatRound(key)).toBe(1);
      expect(combatData.getActiveCreatureName(key)).toBeNull();
    });

    it('null clears only its own campaign; other campaigns survive (combat-scoped clear)', () => {
      const off = { round: 9, creatures: [] };
      combatData.setCombatSummaryCache(serveSummary(), CAMPAIGN);
      combatData.setCombatSummaryCache(off, OFF_CAMPAIGN);
      combatData.setCombatSummaryCache(null, CAMPAIGN);
      expect(combatData.getCombatSummary(CAMPAIGN)).toBeNull();
      expect(combatData.getCurrentCombatRound(CAMPAIGN)).toBe(1);
      expect(combatData.getCombatSummary(OFF_CAMPAIGN)).toBe(off);
    });
  });

  describe('loadCombatSummary transport (#1010)', () => {
    it('GETs the plain change-data tuple once, returns payload verbatim, and caches by reference', async () => {
      const fetchMock = stubFetch(serveSummary());
      const result = await combatData.loadCombatSummary(CAMPAIGN);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith('/api/campaigns/test-campaign/change-data');
      expect(result).toEqual(SUMMARY);
      expect(combatData.getCombatSummary(CAMPAIGN)).toBe(result);
      expect(combatData.getCurrentCombatRound(CAMPAIGN)).toBe(4);
    });

    // #967 exact winners, through combatData's own resolveActiveCreatureName
    // (:23-33). Top-level-vs-baked MA-1966 merge lives upstream in getCombatContext
    // and is pinned at src/encounters/combatData.test.js — these stubs carry no
    // top-level activeCreatureName key so transport never overwrites these bytes.
    it.each([
      ['API bytes beat contradicting runtime',
        { round: 4, activeCreatureName: 'Thorndeer', creatures: SUMMARY.creatures }, 'RuntimeImp', 'Thorndeer'],
      ['absent name + creatures → first creature beats runtime',
        { round: 4, creatures: SUMMARY.creatures }, 'RuntimeImp', 'Thorndeer'],
      ['absent name + no creatures → runtime top-level wins',
        { round: 4, creatures: [] }, 'RuntimeImp', 'RuntimeImp'],
      ['everything absent → stays undefined, read is null',
        { round: 4, creatures: [] }, null, null],
    ])('resolveActiveCreatureName ladder — %s', async (_label, payload, runtime, expected) => {
      runtimeSpy.mockReturnValue(runtime);
      stubFetch(payload);
      const result = await combatData.loadCombatSummary(CAMPAIGN);
      expect(result.activeCreatureName).toBe(expected ?? undefined);
      // Ladder mutates the object that lands in the cache (identity, not copy).
      expect(combatData.getCombatSummary(CAMPAIGN)).toBe(result);
      expect(combatData.getActiveCreatureName(CAMPAIGN)).toBe(expected);
    });

    // #945 degenerate legs: the store is NEVER written on failure — the previous
    // cache survives untouched until an explicit SSE null-clear (latch semantics).
    // getCombatContext swallows both stubbed transport failures and returns null,
    // so all three legs land at loadCombatSummary's empty-result branch (its own
    // catch at :43 is defense-in-depth, unreachable through stubbed fetch).
    it.each([
      ['HTTP 500', () => stubFetch(null, false)],
      ['fetch rejects', () => stubFetchReject()],
      ['combatSummary null', () => stubFetch(null)],
    ])('failed load returns null trio and leaves the cache untouched (%s)', async (_label, stub) => {
      const previous = { round: 2, creatures: [] };
      combatData.setCombatSummaryCache(previous, CAMPAIGN);
      stub();
      expect(await combatData.loadCombatSummary(CAMPAIGN)).toBeNull();
      expect(await combatData.loadActiveCreatureName(CAMPAIGN)).toBeNull();
      expect(await combatData.loadCurrentCombatRound(CAMPAIGN)).toBe(1);
      expect(combatData.getCombatSummary(CAMPAIGN)).toBe(previous);
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty string', ''],
    ])('falsy campaign name is never fetched: %s (#1052 load leg)', async (_label, key) => {
      const fetchMock = stubFetch(serveSummary());
      expect(await combatData.loadCombatSummary(key)).toBeNull();
      expect(await combatData.loadActiveCreatureName(key)).toBeNull();
      expect(await combatData.loadCurrentCombatRound(key)).toBe(1);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('loadActiveCreatureName ladder divergence (#967)', () => {
    // Deliberately DIFFERENT from loadCombatSummary: this path never adopts
    // creatures[0] — only explicit API bytes, then runtime top-level (:52-66).
    it.each([
      ['explicit API name wins over contradicting runtime',
        { round: 1, activeCreatureName: 'Thorndeer', creatures: SUMMARY.creatures }, 'RuntimeImp', 'Thorndeer'],
      ['no API name: runtime wins even though creatures are present (no creatures[0])',
        { round: 1, creatures: SUMMARY.creatures }, 'RuntimeImp', 'RuntimeImp'],
      ['no API name, no runtime',
        { round: 1, creatures: SUMMARY.creatures }, null, null],
    ])('%s', async (_label, payload, runtime, expected) => {
      runtimeSpy.mockReturnValue(runtime);
      stubFetch(payload);
      expect(await combatData.loadActiveCreatureName(CAMPAIGN)).toBe(expected);
    });
  });
});
