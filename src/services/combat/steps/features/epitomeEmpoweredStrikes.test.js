// @maintained-by-ai
/**
 * Feature-decision lane: steps/features/epitomeEmpoweredStrikes.js (2024 monk
 * Elemental Epitome — Way of the Four Elements analogue; Empowered Strikes die
 * rides the unarmed Strike while the epitome is attuned, once per round).
 * Owns: the condition gate (campaign-byte-carrying elementalEpitomeActive read
 * + attack.weaponType === 'unarmed' exact byte, consumed-bytes census #967),
 * the martial-arts die table read from class_levels with the ||4 default
 * (missing class / empty list / level-mismatch / absent field / 0-byte
 * truthiness legs), the ' + 1dN [Empowered Strikes]' formula/total/rolls
 * append bytes (exact full-result toEqual #829), the sideEffects-deferred
 * campaign-pinned latch write (#1021), the strict-=== once-per-round latch
 * including the 0-byte near-miss, the roll-null guard that must not burn the
 * latch (#1026), and exact log bytes (#app logging mandate).
 *
 * ROUND READ (#1050 FIXED, same class as colossusSlayer.js:17):
 * epitomeEmpoweredStrikes.js:14 now passes ctx.campaignName to
 * getCurrentCombatRound(campaignName), mirroring the eldritchStrikes.js:27
 * CORRECT sibling (#1051). Pre-fix the no-arg call resolved
 * getCurrentCombatRound(undefined) → getCombatSummary(undefined) → null
 * (combatData.js:48) → constant 1 fallback (combatData.js:81): the latch
 * stamped round 1 and every later attack compared 1 === 1 — the feature
 * fired once per rest, not once per round, until rest rules cleared
 * epitomeEmpoweredUsedRound (restRules-shortRest.js:71). The live-cache
 * capture test below pins the fix against the REAL combatData cache with a
 * second-campaign decoy; the round-5 re-arm leg is now production-reachable
 * because the campaign-keyed cache round moves with initiative (#910).
 *
 * Family map (steps/features/): eldritchStrikes.test.js (#1051) and
 * colossusSlayer.test.js (#1050) are distinct decision lanes; no sibling
 * executes epitome internals (index.js registers it in the riders chain —
 * #1034 owns dispatch). The elementalEpitomeActive byte this condition reads
 * is STAMPED by elementalEpitomeHandler.test.js (writer lane) and consumed by
 * destructiveStride/stepOfTheWind lanes — no duplication here.
 *
 * Store mock is faithful to useRuntimeState.js (reads consume
 * (characterKey, propertyName) only; writes carry the campaign byte): no
 * call-scanning fake (#1051 class — the old mock ignored campaign bytes).
 * MATH derived ONCE (#815): prev total 8 + deterministic stub total 1 = 9.
 *
 * Old→new: condition ×8→1 (false/null/undefined fold into absent-byte;
 * shortsword/dagger/no-attack/no-weaponType fold into one wrong-byte sweep;
 * planted wrong-character falsifier added, adapted from #1050 since the
 * faithful store keys reads by characterKey); used-round ×2 + multiple-attacks
 * ×1 + new-round ×1→one honest latch cycle + one strict-byte test (the old
 * "new round resets" claim was mock-only fiction pre-#1050 — re-arm now pinned live via the real-cache capture above);
 * class-lookup ×3 + level-success ×5→1 die-table test with deferral pins;
 * sideEffects-shape/no-invocation ×3 folded into deferral pins; log ×3→1
 * exact-bytes test (target + default legs); errors ×2→1 order-sensitive test;
 * per-character ×2 removed (single write tuples already byte-pinned). Old
 * call-scanning getRuntimeValue mock purged.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

// Deterministic dice stub (#1026): every formula rolls a 1 — one math fact.
vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => ({ total: 1, rolls: [1], modifier: 0, formula })),
}));

// Faithful to useRuntimeState.js: reads consume (characterKey, propertyName)
// only (campaign byte is passed by callers but ignored in-process); writes
// record the full campaign-keyed tuple for byte pinning (#1021).
const runtimeStore = {};
const runtimeReads = [];
const runtimeWrites = [];
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((characterKey, propertyName, campaignName) => {
    runtimeReads.push([characterKey, propertyName, campaignName]);
    return runtimeStore[`${characterKey}:${propertyName}`] ?? null;
  }),
  setRuntimeValue: vi.fn((characterKey, propertyName, value, campaignName) => {
    runtimeWrites.push([characterKey, propertyName, value, campaignName]);
    runtimeStore[`${characterKey}:${propertyName}`] = value;
  }),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ──────────────────────────────────────────────────────

import { epitomeEmpoweredStrikes } from './epitomeEmpoweredStrikes.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

// ── Helpers ──────────────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';
const LATCH = 'epitomeEmpoweredUsedRound';
// One prevData math fact for every leg (#815): total 8 + stub roll 1 = 9.
const PREV = { formula: '1d4+3', total: 8, rolls: [4, 3] };

function makeCtx(overrides = {}) {
  return {
    campaignName: CAMPAIGN,
    playerStats: { name: 'Monk1', level: 1 },
    attack: { weaponType: 'unarmed' },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('epitomeEmpoweredStrikes', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // keeps factory impls; clears call logs
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    runtimeReads.length = 0;
    runtimeWrites.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('condition opens only on an armed epitome byte for an unarmed Strike, consulting exactly one campaign-carrying key', () => {
    runtimeStore['Monk1:elementalEpitomeActive'] = true;
    expect(epitomeEmpoweredStrikes.condition(makeCtx())).toBe(true);
    // Consulted-bytes census (#967): one read, exact tuple.
    expect(runtimeReads).toEqual([['Monk1', 'elementalEpitomeActive', CAMPAIGN]]);

    // Refusal sweep: false byte, absent byte, and every wrong weapon byte —
    // including the no-attack/no-weaponType optional-chain legs.
    runtimeStore['Monk1:elementalEpitomeActive'] = false;
    expect(epitomeEmpoweredStrikes.condition(makeCtx())).toBe(false);
    delete runtimeStore['Monk1:elementalEpitomeActive'];
    expect(epitomeEmpoweredStrikes.condition(makeCtx())).toBe(false);
    runtimeStore['Monk1:elementalEpitomeActive'] = true;
    for (const attack of [
      { weaponType: 'shortsword' },
      { weaponType: 'dagger' },
      { weaponType: 'longbow' },
      {},
      undefined,
    ]) {
      expect(epitomeEmpoweredStrikes.condition(makeCtx({ attack }))).toBe(false);
    }

    // Planted wrong-character falsifier (#1050 shape): another monk's armed
    // epitome never leases this character's gate.
    delete runtimeStore['Monk1:elementalEpitomeActive'];
    runtimeStore['OtherMonk:elementalEpitomeActive'] = true;
    expect(epitomeEmpoweredStrikes.condition(makeCtx())).toBe(false);
  });

  it('once per round adds the level-scaled martial-arts die with exact append bytes, defaulting to 1d4 whenever class data refuses, and stamps nothing before sideEffects', async () => {
    getCurrentCombatRound.mockReturnValue(2);

    const CASES = [
      // martial_arts_die progression bytes from class_levels lookup by level:
      { level: 5, class: { class_levels: [{ level: 5, martial_arts_die: 6 }] }, die: '1d6' },
      { level: 11, class: { class_levels: [{ level: 11, martial_arts_die: 8 }] }, die: '1d8' },
      { level: 17, class: { class_levels: [{ level: 17, martial_arts_die: 10 }] }, die: '1d10' },
      { level: 20, class: { class_levels: [{ level: 20, martial_arts_die: 12 }] }, die: '1d12' },
      // ||4 default legs (#910 honest): each of these rolls 1d4, not the
      // class's would-be die.
      { level: 1, class: undefined, die: '1d4' },
      { level: 2, class: { class_levels: [] }, die: '1d4' },
      { level: 3, class: { class_levels: [{ level: 2, martial_arts_die: 6 }] }, die: '1d4' },
      { level: 4, class: { class_levels: [{ level: 4 }] }, die: '1d4' },
      { level: 6, class: { class_levels: [{ level: 6, martial_arts_die: 0 }] }, die: '1d4' }, // 0-byte truthiness
    ];

    for (const { level, class: cls, die } of CASES) {
      const result = await epitomeEmpoweredStrikes.handler(
        makeCtx({ playerStats: { name: 'Monk1', level, class: cls } }),
        PREV,
      );
      expect(result.data).toEqual({
        formula: `1d4+3 + ${die} [Empowered Strikes]`,
        total: 9, // 8 + stub 1, derived once
        rolls: [4, 3, 1],
      });
    }
    expect(rollExpression.mock.calls.map((c) => c[0])).toEqual(
      CASES.map((c) => c.die),
    );
    // sideEffects deferral: nine open hands, zero writes, zero logs.
    expect(runtimeWrites).toEqual([]);
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('latch cycle: fires fresh at round 4, defers the campaign-pinned stamp to sideEffects, refuses the same round, and re-arms at a new round', async () => {
    getCurrentCombatRound.mockReturnValue(4);

    const first = await epitomeEmpoweredStrikes.handler(makeCtx(), PREV);
    // #1050 fix pin: the round read carries ctx.campaignName
    // (eldritchStrikes.js:27 shape); pre-fix it took NO args and the
    // production read collapsed to constant 1 (header).
    expect(getCurrentCombatRound).toHaveBeenCalledWith(CAMPAIGN);
    expect(first.data).toEqual({ formula: '1d4+3 + 1d4 [Empowered Strikes]', total: 9, rolls: [4, 3, 1] });
    expect(runtimeWrites).toEqual([]); // nothing burns before sideEffects
    expect(addEntry).not.toHaveBeenCalled();

    await first.sideEffects();
    expect(runtimeWrites).toEqual([['Monk1', LATCH, 4, CAMPAIGN]]);
    expect(addEntry).toHaveBeenCalledTimes(1);

    // Same-round follow-up: exact prevData pass-through, no sideEffects, no reroll.
    const second = await epitomeEmpoweredStrikes.handler(makeCtx(), PREV);
    expect(second).toEqual({ data: PREV });
    expect(second.sideEffects).toBeUndefined();
    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(runtimeWrites).toHaveLength(1);

    // Round-5 re-arm: post-#1050-fix production moves with the campaign cache
    // (the live-capture test proves it); under the mock this still pins that
    // the strict-=== latch stays round-sensitive.
    getCurrentCombatRound.mockReturnValue(5);
    const third = await epitomeEmpoweredStrikes.handler(makeCtx(), PREV);
    expect(third.data).toEqual({ formula: '1d4+3 + 1d4 [Empowered Strikes]', total: 9, rolls: [4, 3, 1] });
    await third.sideEffects();
    expect(runtimeWrites[1]).toEqual(['Monk1', LATCH, 5, CAMPAIGN]);
  });

  it('latch compares strictly: a 0-byte at round 0 refuses (not truthiness) while a stale higher byte arms', async () => {
    getCurrentCombatRound.mockReturnValue(0);
    runtimeStore[`Monk1:${LATCH}`] = 0;
    expect(await epitomeEmpoweredStrikes.handler(makeCtx(), PREV)).toEqual({ data: PREV });
    expect(rollExpression).not.toHaveBeenCalled();
    expect(runtimeWrites).toEqual([]);

    // Stale future byte vs round 1: strict === arms; a truthiness gate would refuse.
    getCurrentCombatRound.mockReturnValue(1);
    const result = await epitomeEmpoweredStrikes.handler(makeCtx(), PREV);
    expect(result.data).toEqual({ formula: '1d4+3 + 1d4 [Empowered Strikes]', total: 9, rolls: [4, 3, 1] });
  });

  it('a refused roll grants nothing and never burns the latch — the next attack still rolls its die', async () => {
    getCurrentCombatRound.mockReturnValue(1);
    rollExpression.mockReturnValueOnce(null);

    const refused = await epitomeEmpoweredStrikes.handler(makeCtx(), PREV);
    expect(refused).toEqual({ data: PREV });
    expect(runtimeWrites).toEqual([]); // latch stamp is gated on a successful roll (#1026)
    expect(addEntry).not.toHaveBeenCalled();

    const retry = await epitomeEmpoweredStrikes.handler(makeCtx(), PREV);
    expect(retry.data).toEqual({ formula: '1d4+3 + 1d4 [Empowered Strikes]', total: 9, rolls: [4, 3, 1] });
    expect(rollExpression).toHaveBeenCalledTimes(2);
  });

  it('logs exact ability_use bytes naming the target, defaulting to "target", only via sideEffects', async () => {
    getCurrentCombatRound.mockReturnValue(1);

    const armed = await epitomeEmpoweredStrikes.handler(makeCtx({ targetName: 'Goblin1' }), PREV);
    expect(addEntry).not.toHaveBeenCalled(); // deferral (#1026)
    await armed.sideEffects();
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'ability_use',
      characterName: 'Monk1',
      abilityName: 'Elemental Epitome - Empowered Strikes',
      description: "Monk1's Unarmed Strike deals +1d4 damage (Empowered Strikes) against Goblin1.",
      targetName: 'Goblin1',
      timestamp: expect.any(Number),
    });

    // Default-target leg at a new round, exact bytes.
    getCurrentCombatRound.mockReturnValue(2);
    const second = await epitomeEmpoweredStrikes.handler(makeCtx(), PREV);
    await second.sideEffects();
    expect(addEntry).toHaveBeenLastCalledWith(CAMPAIGN, expect.objectContaining({
      description: "Monk1's Unarmed Strike deals +1d4 damage (Empowered Strikes) against target.",
      targetName: undefined,
    }));
    expect(addEntry).toHaveBeenCalledTimes(2);
  });

  it('sideEffects writes before logging: a rejected log is swallowed with its tag, a rejected store write propagates and skips the log', async () => {
    getCurrentCombatRound.mockReturnValue(1);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Log rejection: latch already stamped, sideEffects resolves, tag logged.
    addEntry.mockRejectedValueOnce(new Error('network failure'));
    const ok = await epitomeEmpoweredStrikes.handler(makeCtx(), PREV);
    await expect(ok.sideEffects()).resolves.toBeUndefined();
    expect(runtimeWrites).toEqual([['Monk1', LATCH, 1, CAMPAIGN]]);
    expect(errSpy).toHaveBeenCalledWith('[epitomeEmpoweredStrikes:log-error]', expect.any(Error));

    // Store rejection (no .catch on the setRuntimeValue call): propagates and
    // the log never fires — pins the write-before-log ordering.
    getCurrentCombatRound.mockReturnValue(2);
    setRuntimeValue.mockRejectedValueOnce(new Error('store failure'));
    const failing = await epitomeEmpoweredStrikes.handler(makeCtx(), PREV);
    await expect(failing.sideEffects()).rejects.toThrow('store failure');
    expect(addEntry).toHaveBeenCalledTimes(1); // only the first call's log ever fired
  });

  // #1050 live capture: the mocked seam delegates to the REAL combatData
  // cache so the campaign-keyed round read executes production bytes.
  // Pre-fix (no-arg call at :14) the stamp pinned to 1 (cache-miss fallback,
  // combatData.js:81) while the live campaign sat at round 7 — captured red.
  // WATCH fix (fix#212): flakecheck212 RED at 5005ms — this test's
  // vi.importActual of combatData (real module graph) exceeded the default
  // 5000ms testTimeout under full-suite transform contention (isolated:
  // green; same row also fired once in fix#203's oversubscribed window and
  // was dismissed un-fixed — recurrence here is the honest re-verdict).
  // Patience widened, zero assertions weakened; 15s = 3x worst sighting.
  it('live-cache round read: test-campaign round 7 stamps 7, a second-campaign decoy reads its own round', async () => {
    const real = await vi.importActual('../../../encounters/combatData.js');
    real.setCombatSummaryCache({ round: 7, creatures: [] }, CAMPAIGN);
    real.setCombatSummaryCache({ round: 5, creatures: [] }, 'other-campaign');
    getCurrentCombatRound.mockImplementation(real.getCurrentCombatRound);
    try {
      const first = await epitomeEmpoweredStrikes.handler(makeCtx(), PREV);
      expect(getCurrentCombatRound).toHaveBeenCalledWith(CAMPAIGN); // never ()
      expect(first.data).toEqual({ formula: '1d4+3 + 1d4 [Empowered Strikes]', total: 9, rolls: [4, 3, 1] });
      await first.sideEffects();
      expect(runtimeWrites).toEqual([['Monk1', LATCH, 7, CAMPAIGN]]);

      // Same-round follow-up refused at round 7 (strict === against the real cache).
      const second = await epitomeEmpoweredStrikes.handler(makeCtx(), PREV);
      expect(second).toEqual({ data: PREV });

      // Round-wrap re-arm in the real cache: stamp moves 7 → 8 (pre-fix the
      // production read never left 1, so the feature never re-armed).
      real.setCombatSummaryCache({ round: 8, creatures: [] }, CAMPAIGN);
      const third = await epitomeEmpoweredStrikes.handler(makeCtx(), PREV);
      await third.sideEffects();
      expect(runtimeWrites[1]).toEqual(['Monk1', LATCH, 8, CAMPAIGN]);

      // Second campaign: its own cache byte (5), never 7, never the 1-fallback.
      const other = await epitomeEmpoweredStrikes.handler(makeCtx({ campaignName: 'other-campaign' }), PREV);
      await other.sideEffects();
      expect(runtimeWrites[2]).toEqual(['Monk1', LATCH, 5, 'other-campaign']);
    } finally {
      real.setCombatSummaryCache(null, CAMPAIGN);
      real.setCombatSummaryCache(null, 'other-campaign');
      getCurrentCombatRound.mockReset();
    }
  }, 15000);
});
