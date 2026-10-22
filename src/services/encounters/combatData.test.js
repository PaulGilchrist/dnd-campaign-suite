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
 *          campaign-scoped cache — and loadActiveCreatureName deliberately SKIPS creatures[0].
 *   #1010  Plain transport tuple; encoding covered upstream at damageUtils.test.js:175.
 *
 * #1074-fix (2026-10-22): the ladder's third leg was getRuntimeValue('campaign',
 *   'activeCreatureName', campaignName) — campaignName was a 3rd arg to an arity-2
 *   signature (useRuntimeState.js:63; store Map keyed by characterKey ONLY, :4/:21-26),
 *   so the campaign was structurally discarded and the read resolved against the
 *   CURRENT-context store: cross-campaign bleed. Both sites now route through
 *   getActiveCreatureName(campaignName) — the module's own campaign-keyed accessor.
 *   Runtime-store abstinence + REAL-store cross-context capture pinned below.
 *   Systemic arity infra (1317+ call sites, useRuntimeState.js signature untouched here):
 *   deferred ledger #1517/#1520; arity pin-home spellPreparationService.resource-flow.test.js:427-428 (unflipped — pins spellPrep tuples, not combatData).
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
    // #1074-fix: combatData must NEVER consult the runtime store — the old :29/:59
    // fallback's campaignName arg was structurally ignored (arity-2 read), resolving
    // cross-campaign against the current-context store. Spy stays armed as a tripwire:
    // any call is a regression (abstinence pins in both ladder describes). Ladder legs
    // are now explicit cache seeds (#1057 determinism).
    runtimeSpy = vi.spyOn(useRuntimeState, 'getRuntimeValue').mockReturnValue(null);
    combatData.setCombatSummaryCache(null, CAMPAIGN);
    combatData.setCombatSummaryCache(null, OFF_CAMPAIGN);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useRuntimeState.clearRuntimeState('campaign');
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
    // #1074 decoy flip: the old third leg 'runtime top-level wins' pinned the DEFECT —
    // getRuntimeValue('campaign', 'activeCreatureName', campaignName) ignores campaignName
    // (arity-2, useRuntimeState.js:63) and reads the current-context store. The leg is now
    // the campaign-keyed cache; OFF_CAMPAIGN decoy proves it is never crossed.
    it.each([
      ['API bytes beat contradicting cache',
        { round: 4, activeCreatureName: 'Thorndeer', creatures: SUMMARY.creatures }, 'CachedImp', 'Thorndeer'],
      ['absent name + creatures → first creature beats cache',
        { round: 4, creatures: SUMMARY.creatures }, 'CachedImp', 'Thorndeer'],
      ['absent name + no creatures → campaign cache wins (#1074-fix: was runtime top-level)',
        { round: 4, creatures: [] }, 'CachedImp', 'CachedImp'],
      ['everything absent, own cache empty → stays undefined, read is null (cross-campaign never-resolves arm honest)',
        { round: 4, creatures: [] }, null, null],
    ])('resolveActiveCreatureName ladder — %s', async (_label, payload, cachedName, expected) => {
      combatData.setCombatSummaryCache(
        { round: 2, creatures: [], ...(cachedName ? { activeCreatureName: cachedName } : {}) },
        CAMPAIGN);
      // Planted decoy in its OWN campaign — must never surface on a CAMPAIGN load (#1050).
      combatData.setCombatSummaryCache({ round: 9, creatures: [], activeCreatureName: 'DecoyOrc' }, OFF_CAMPAIGN);
      stubFetch(payload);
      const result = await combatData.loadCombatSummary(CAMPAIGN);
      expect(result.activeCreatureName).toBe(expected ?? undefined);
      // Ladder mutates the object that lands in the cache (identity, not copy).
      expect(combatData.getCombatSummary(CAMPAIGN)).toBe(result);
      expect(combatData.getActiveCreatureName(CAMPAIGN)).toBe(expected);
      expect(combatData.getActiveCreatureName(OFF_CAMPAIGN)).toBe('DecoyOrc'); // decoy survives untouched
      expect(runtimeSpy).not.toHaveBeenCalled(); // #1074-fix abstinence: arity-violating read purged
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
    // creatures[0] — only explicit API bytes, then the campaign-keyed cache (:52-66).
    // #1074 decoy flip: second leg was the runtime store (campaignName structurally
    // ignored at :59 — arity-2 read); now getActiveCreatureName(campaignName).
    it.each([
      ['explicit API name wins over contradicting cache',
        { round: 1, activeCreatureName: 'Thorndeer', creatures: SUMMARY.creatures }, 'CachedImp', 'Thorndeer'],
      ['no API name: campaign cache wins even though creatures are present (no creatures[0]) — #1074-fix',
        { round: 1, creatures: SUMMARY.creatures }, 'CachedImp', 'CachedImp'],
      ['no API name, own cache empty → null; OFF decoy never crosses (cross-campaign never-resolves arm honest)',
        { round: 1, creatures: SUMMARY.creatures }, null, null],
    ])('%s', async (_label, payload, cachedName, expected) => {
      combatData.setCombatSummaryCache(
        { round: 1, creatures: [], ...(cachedName ? { activeCreatureName: cachedName } : {}) },
        CAMPAIGN);
      combatData.setCombatSummaryCache({ round: 9, creatures: [], activeCreatureName: 'DecoyOrc' }, OFF_CAMPAIGN);
      stubFetch(payload);
      expect(await combatData.loadActiveCreatureName(CAMPAIGN)).toBe(expected);
      expect(combatData.getActiveCreatureName(OFF_CAMPAIGN)).toBe('DecoyOrc'); // decoy survives untouched
      expect(runtimeSpy).not.toHaveBeenCalled(); // #1074-fix abstinence
    });
  });

  describe('#1074-fix cross-context bleed capture (REAL runtime store, not mock arguments)', () => {
    // Pre-fix bytes (:29/:59): getRuntimeValue('campaign', 'activeCreatureName', campaignName)
    // — 3rd arg discarded by the arity-2 signature (useRuntimeState.js:63); store Map is
    // keyed by characterKey ONLY (useRuntimeState.js:4/:21-26), so the fallback resolved
    // against whatever campaign the CURRENT context had loaded. Lane primed fix#71-style:
    // test-campaign round 7, other-campaign round 5. The runtime byte is written through
    // the REAL setRuntimeValue path so the pre-fix capture is live-store, not spy-fed.
    async function primeCurrentContextStore() {
      stubFetch({ round: 5, creatures: [] }); // transport carries no active name (stubFetch wraps into combatSummary)
      // Delegate the spy byte-for-byte to the REAL store impl (useRuntimeState.js:72-75)
      // so PRE-fix bytes actually capture the bleed instead of being neutralized by null.
      runtimeSpy.mockImplementation((characterKey, propertyName) => {
        const store = useRuntimeState.getStore(characterKey);
        return store.has(propertyName) ? store.get(propertyName) : null;
      });
      // REAL write: stores.get('campaign').activeCreatureName = byte (POST absorbed by stub).
      useRuntimeState.setRuntimeValue('campaign', 'activeCreatureName', 'CurrentContextImp', CAMPAIGN);
      expect(useRuntimeState.getStore('campaign').get('activeCreatureName')).toBe('CurrentContextImp');
    }

    it('loadActiveCreatureName(OFF_CAMPAIGN) never adopts the current-context runtime byte', async () => {
      combatData.setCombatSummaryCache({ round: 7, creatures: [], activeCreatureName: 'TestActive7' }, CAMPAIGN);
      combatData.setCombatSummaryCache({ round: 5, creatures: [] }, OFF_CAMPAIGN);
      await primeCurrentContextStore();
      // OFF cache has no name, OFF transport has no name → honest null.
      // Pre-fix capture: returned 'CurrentContextImp' (test-campaign's byte, bled cross-campaign).
      expect(await combatData.loadActiveCreatureName(OFF_CAMPAIGN)).toBeNull();
      expect(useRuntimeState.getStore('campaign').get('activeCreatureName')).toBe('CurrentContextImp'); // byte still live, simply never consulted
      expect(combatData.getActiveCreatureName(OFF_CAMPAIGN)).toBeNull();
    });

    it('loadCombatSummary(OFF_CAMPAIGN) never mutates+caches a cross-context runtime name', async () => {
      combatData.setCombatSummaryCache({ round: 7, creatures: [], activeCreatureName: 'TestActive7' }, CAMPAIGN);
      await primeCurrentContextStore();
      // Pre-fix capture: fromApi.activeCreatureName was mutated to 'CurrentContextImp' and
      // cached under OFF_CAMPAIGN at :41 — bleed persisted in the campaign cache.
      const result = await combatData.loadCombatSummary(OFF_CAMPAIGN);
      expect(result).toEqual({ round: 5, creatures: [] });
      expect(result.activeCreatureName).toBeUndefined();
      expect(combatData.getActiveCreatureName(OFF_CAMPAIGN)).toBeNull();
      expect(combatData.getCurrentCombatRound(OFF_CAMPAIGN)).toBe(5); // OFF keeps its own round-5 decoy
      expect(combatData.getActiveCreatureName(CAMPAIGN)).toBe('TestActive7'); // CAMPAIGN lane stays sealed
    });

    it('#1348 distinguishable pair: same no-name transport — own-cache-hit vs own-cache-miss give distinct bytes', async () => {
      await primeCurrentContextStore();
      // Arm 1: own cache named → cache byte wins, not the runtime byte.
      combatData.setCombatSummaryCache({ round: 5, creatures: [], activeCreatureName: 'OwnCacheName' }, OFF_CAMPAIGN);
      expect(await combatData.loadActiveCreatureName(OFF_CAMPAIGN)).toBe('OwnCacheName');
      // Arm 2: own cache nameless → null, not 'OwnCacheName' residue, not 'CurrentContextImp'.
      combatData.setCombatSummaryCache({ round: 5, creatures: [] }, OFF_CAMPAIGN);
      expect(await combatData.loadActiveCreatureName(OFF_CAMPAIGN)).toBeNull();
    });
  });
});
