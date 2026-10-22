// @maintained-by-ai
/**
 * Feature-decision lane: steps/features/colossusSlayer.js (Hunter's Prey choice).
 * Owns the colossusSlayer decision bytes: the "_Hunter's_Prey_choice" (with
 * apostrophe) condition byte vs 'Colossus Slayer', the below-max-HP gate
 * (null-guard ladder: currentHp null / maxHp null / full HP false, maxHp-1
 * and 0 HP true — 0 also falsifies a truthiness guard), the
 * '_Hunters_Prey_Colossus_UsedRound' (NO apostrophe — key bytes differ from
 * the condition key) once-per-round latch read/write, the +1d8 [extra]
 * formula/total/rolls append bytes, sideEffects-deferred stamping, and
 * zero-applied-must-not-burn on rollExpression failure (#1026).
 *
 * Family map (steps/features/): no sibling unit test touches colossusSlayer
 * (superiorHuntersPrey tests cover only the superior upgrade; the
 * hunterPreyHandler test covers the choice-prompt, citing this step's key).
 * Pipeline dispatch view (riders chain mounting at attackRollPostDamage)
 * lives on the featureDamage pipeline lane (#1034 owns dispatch) and is NOT
 * duplicated here; this lane pins the step handler internals.
 *
 * Latch round source (#1050 FIXED): getCurrentCombatRound now carries
 * ctx.campaignName at both call sites (:17 gate read, :29 sideEffects stamp),
 * mirroring siblings (assassinate.js:28, eldritchStrikes.js:27). Pre-fix the
 * no-arg read resolved getCurrentCombatRound(undefined) → getCombatSummary
 * (undefined) → null (combatData.js:48) → constant-1 fallback (combatData.js:
 * 81): the latch stamped/read round 1 regardless of the live campaign round,
 * so the once-per-round gate mis-armed across rounds and campaigns. The
 * live-cache capture test below pins the fix against the REAL combatData
 * cache with a second-campaign decoy.
 *
 * Self-log mandate (#1050 log fix): pre-fix this step was silent on trigger —
 * zero addEntry bytes anywhere in the file (captured red below). It now
 * self-logs inside sideEffects AFTER the latch stamp, mirroring the
 * byte-nearest sibling epitomeEmpoweredStrikes.js:30-39 (same dice-append
 * rider shape: stamp, then await addEntry ability_use, .catch console.error)
 * and carrying rolled values in the description per tavernBrawler.js:38-45.
 * The featureRiders dispatcher (attackRollPostDamage.js:35-45) stays pure
 * routing — every self-logging sibling logs in its own module; the loop
 * never logs for them — so no dispatcher edit. Refusal legs (no context,
 * no target, HP gate, latch, roll-null) stay addEntry-silent.
 *
 * Old→new: condition ×5→1; no-context + no-target ×2→1; full-HP ×2 +
 * null-hp ×2→1 HP-gate; success ×3 (adds, rolls 1d8, sideEffects setter)
 * →1 exact-bytes test; used-round + marks-used ×2→1 two-call honest latch
 * (+ 0-HP near-miss folded in); roll-null ×1 kept as the latch-not-burned
 * falsifier. Weird call-scanning getRuntimeValue mock replaced with the
 * faithful campaign-keyed store (#1049 shape); duplicate full-HP case,
 * duplicate latch case, and redundant second success case removed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) =>
    formula === '1d8' ? { total: 5, rolls: [5], modifier: 0, formula: '1d8' } : null
  ),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
}));

// Faithful campaign-keyed store: latch/condition reads and writes must carry campaignName.
// callJournal pins invocationCallOrder parity: latch stamp BEFORE trigger log (siblings).
const runtimeStore = {};
const callJournal = [];
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (name, key, campaign) => runtimeStore[`${campaign}:${name}:${key}`],
  setRuntimeValue: (name, key, value, campaign) => { runtimeStore[`${campaign}:${name}:${key}`] = value; callJournal.push('stamp'); },
}));

// Silence-proof seam: pre-fix the trigger legs recorded zero calls here (#1050).
vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => { callJournal.push('log'); return Promise.resolve(); }),
}));

// ── Imports ──────────────────────────────────────────────────────

import { colossusSlayer } from './colossusSlayer.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

// ── Helpers ──────────────────────────────────────────────────────

const CHOICE_KEY = "_Hunter's_Prey_choice"; // apostrophe — byte-exact vs latch key
const LATCH = '_Hunters_Prey_Colossus_UsedRound'; // no apostrophe
const LATCH_KEY = `test-campaign:Fighter1:${LATCH}`;

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: { name: 'Fighter1' },
    ...overrides,
  };
}

function makePrevData() {
  return { formula: '1d8+3', total: 11, rolls: [8, 3] };
}

// Arm every gate open except the byte under test: context present, target
// below max HP (default 7/10 — the maxHp-1 near-miss), fresh round.
function arm({ currentHp = 7, maxHp = 10, round = 3 } = {}) {
  const cs = { creatures: [] };
  getCombatContext.mockResolvedValue(cs);
  getTargetFromAttacker.mockReturnValue({ name: 'Goblin', currentHp, maxHp });
  getCurrentCombatRound.mockReturnValue(round);
  return cs;
}

// Exact trigger-log payload bytes (dice stub rolls 1d8 -> [5]/5; epitome-
// mirrored ability_use shape, rolled values carried per mandate).
function triggerLog({ name = 'Goblin', currentHp, maxHp }) {
  return {
    type: 'ability_use',
    characterName: 'Fighter1',
    abilityName: 'Colossus Slayer',
    description: `Fighter1 used Colossus Slayer on ${name} — +1d8 extra damage rolled 5 [5] (target below HP maximum ${currentHp}/${maxHp}, once per turn).`,
    targetName: name,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('colossusSlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    callJournal.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('condition is true only when the campaign-keyed _Hunter\'s_Prey_choice byte is exactly "Colossus Slayer"', () => {
    runtimeStore[`test-campaign:Fighter1:${CHOICE_KEY}`] = 'Colossus Slayer';
    expect(colossusSlayer.condition(makeCtx())).toBe(true);

    // Near-miss bytes and emptiness all refuse; another campaign's choice never leaks.
    runtimeStore[`test-campaign:Fighter1:${CHOICE_KEY}`] = 'colossus slayer';
    expect(colossusSlayer.condition(makeCtx())).toBe(false);
    runtimeStore[`test-campaign:Fighter1:${CHOICE_KEY}`] = 'Giant Slayer';
    expect(colossusSlayer.condition(makeCtx())).toBe(false);
    delete runtimeStore[`test-campaign:Fighter1:${CHOICE_KEY}`];
    expect(colossusSlayer.condition(makeCtx())).toBe(false);
    runtimeStore[`other-campaign:Fighter1:${CHOICE_KEY}`] = 'Colossus Slayer';
    expect(colossusSlayer.condition(makeCtx())).toBe(false);
  });

  it('missing combat context short-circuits before target lookup; an unresolvable target passes prevData through', async () => {
    getCombatContext.mockResolvedValueOnce(null);
    expect(await colossusSlayer.handler(makeCtx(), makePrevData())).toEqual({ data: makePrevData() });
    expect(getCombatContext).toHaveBeenCalledWith('test-campaign');
    expect(getTargetFromAttacker).not.toHaveBeenCalled(); // guard ordering: context before target

    const cs = { creatures: [] };
    getCombatContext.mockResolvedValue(cs);
    getTargetFromAttacker.mockReturnValueOnce(null);
    expect(await colossusSlayer.handler(makeCtx(), makePrevData())).toEqual({ data: makePrevData() });
    expect(getTargetFromAttacker).toHaveBeenCalledWith(cs, 'Fighter1');
    expect(rollExpression).not.toHaveBeenCalled();
    expect(runtimeStore).toEqual({});
    expect(addEntry).not.toHaveBeenCalled(); // refusal legs stay silent — no trigger spam
    expect(callJournal).toEqual([]);
  });

  it('HP gate: null currentHp, null maxHp, or a target at full HP gets no bonus and burns nothing', async () => {
    for (const target of [
      { currentHp: null, maxHp: 10 }, // null-guard leg
      { currentHp: 5, maxHp: null },  // null-guard leg
      { currentHp: 10, maxHp: 10 },   // exact-full-HP near-miss (>=, not >)
    ]) {
      arm(target);
      const prevData = makePrevData();
      expect(await colossusSlayer.handler(makeCtx(), prevData)).toEqual({ data: prevData });
    }
    expect(rollExpression).not.toHaveBeenCalled();
    expect(runtimeStore).toEqual({}); // latch never stamped on a refused hit
    expect(addEntry).not.toHaveBeenCalled(); // full-HP/null-HP refusals never log a trigger
  });

  it('below max HP adds exactly 1d8 [extra] and defers the campaign-keyed latch stamp to sideEffects', async () => {
    const cs = arm(); // 7/10, round 3
    const result = await colossusSlayer.handler(makeCtx(), makePrevData());

    expect(getTargetFromAttacker).toHaveBeenCalledWith(cs, 'Fighter1');
    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(rollExpression).toHaveBeenCalledWith('1d8');
    expect(result.data).toEqual({ formula: '1d8+3 + 1d8 [extra]', total: 16, rolls: [8, 3, 5] });

    expect(runtimeStore).toEqual({}); // nothing stamped before sideEffects runs
    expect(addEntry).not.toHaveBeenCalled(); // silent pre-fix (#1050); now gated on sideEffects too
    expect(callJournal).toEqual([]);
    await result.sideEffects();
    expect(runtimeStore[LATCH_KEY]).toBe(3);
    // #1050 fix pin: round read carries ctx.campaignName (siblings' shape).
    expect(getCurrentCombatRound).toHaveBeenCalledWith('test-campaign');
    // #1050 mandate pin: exactly one honest trigger log, rolled 1d8 values,
    // campaign-first — and stamped BEFORE logged (epitome sibling ordering).
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', triggerLog({ currentHp: 7, maxHp: 10 }));
    expect(callJournal).toEqual(['stamp', 'log']);
  });

  it('latches once per round: same-round follow-up refused, next round applies again at 0 HP', async () => {
    arm({ currentHp: 7, maxHp: 10, round: 1 });
    const prevData = makePrevData();
    const first = await colossusSlayer.handler(makeCtx(), prevData);
    expect(first.data).toEqual({ formula: '1d8+3 + 1d8 [extra]', total: 16, rolls: [8, 3, 5] });
    await first.sideEffects();
    expect(runtimeStore[LATCH_KEY]).toBe(1);
    expect(addEntry).toHaveBeenCalledTimes(1); // one honest log per applied trigger
    expect(addEntry).toHaveBeenCalledWith('test-campaign', triggerLog({ currentHp: 7, maxHp: 10 }));

    // Second hit, same round: latch byte equals current round — no dice, no reforged formula, no log.
    expect(await colossusSlayer.handler(makeCtx(), prevData)).toEqual({ data: prevData });
    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(runtimeStore[LATCH_KEY]).toBe(1);
    expect(addEntry).toHaveBeenCalledTimes(1); // latch refusal burns nothing and says nothing

    // Round 2 re-arms; currentHp 0 still counts as below max (falsifies a truthiness guard).
    getCurrentCombatRound.mockReturnValue(2);
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin', currentHp: 0, maxHp: 10 });
    const second = await colossusSlayer.handler(makeCtx(), prevData);
    expect(second.data).toEqual({ formula: '1d8+3 + 1d8 [extra]', total: 16, rolls: [8, 3, 5] });
    await second.sideEffects();
    expect(runtimeStore[LATCH_KEY]).toBe(2);
    expect(rollExpression).toHaveBeenCalledTimes(2);
    expect(addEntry).toHaveBeenCalledTimes(2); // second trigger logs again, with 0/10 gate bytes
    expect(addEntry).toHaveBeenLastCalledWith('test-campaign', triggerLog({ currentHp: 0, maxHp: 10 }));
  });

  it('a failed roll grants nothing and never burns the latch — the follow-up attack still gets its 1d8', async () => {
    arm(); // 7/10, round 3
    rollExpression.mockReturnValueOnce(null);
    const prevData = makePrevData();
    expect(await colossusSlayer.handler(makeCtx(), prevData)).toEqual({ data: prevData });
    expect(runtimeStore).toEqual({}); // stamp is gated on a successful roll, not merely attempted
    expect(addEntry).not.toHaveBeenCalled(); // a zero-grant fires no trigger log

    const retry = await colossusSlayer.handler(makeCtx(), prevData);
    expect(retry.data).toEqual({ formula: '1d8+3 + 1d8 [extra]', total: 16, rolls: [8, 3, 5] });
    await retry.sideEffects();
    expect(addEntry).toHaveBeenCalledTimes(1); // only the applied retry self-logs
    expect(addEntry).toHaveBeenCalledWith('test-campaign', triggerLog({ currentHp: 7, maxHp: 10 }));
  });

  // #1050 live capture: the mocked seam delegates to the REAL combatData
  // cache so the campaign-keyed round read executes production bytes.
  // Pre-fix (no-arg call) this stamp pinned to 1 (cache-miss fallback,
  // combatData.js:81) while the live campaign sat at round 7 — captured red.
  it('live-cache round read: test-campaign round 7 stamps 7, a second-campaign decoy reads its own round', async () => {
    const real = await vi.importActual('../../../encounters/combatData.js');
    real.setCombatSummaryCache({ round: 7, creatures: [] }, 'test-campaign');
    real.setCombatSummaryCache({ round: 5, creatures: [] }, 'other-campaign');
    getCurrentCombatRound.mockImplementation(real.getCurrentCombatRound);
    getCombatContext.mockResolvedValue({ creatures: [] });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin', currentHp: 7, maxHp: 10 });
    try {
      const first = await colossusSlayer.handler(makeCtx(), makePrevData());
      expect(getCurrentCombatRound).toHaveBeenCalledWith('test-campaign'); // never ()
      expect(first.data).toEqual({ formula: '1d8+3 + 1d8 [extra]', total: 16, rolls: [8, 3, 5] });
      await first.sideEffects();
      expect(runtimeStore[LATCH_KEY]).toBe(7);
      expect(addEntry).toHaveBeenCalledTimes(1); // trigger self-log at the live round-7 seam
      expect(addEntry).toHaveBeenCalledWith('test-campaign', triggerLog({ currentHp: 7, maxHp: 10 }));

      // Same-round follow-up refused at round 7 (pre-fix: refused only by
      // accident against a stale 1-stamp, and re-fired at every later round).
      expect(await colossusSlayer.handler(makeCtx(), makePrevData())).toEqual({ data: makePrevData() });
      expect(addEntry).toHaveBeenCalledTimes(1); // refusal stays silent

      // Second campaign: its own cache byte (5), never 7, never the 1-fallback.
      const other = await colossusSlayer.handler(makeCtx({ campaignName: 'other-campaign' }), makePrevData());
      await other.sideEffects();
      expect(runtimeStore[`other-campaign:Fighter1:${LATCH}`]).toBe(5);
      expect(getCurrentCombatRound).toHaveBeenLastCalledWith('other-campaign');
      expect(addEntry).toHaveBeenCalledTimes(2); // and lands in ITS OWN campaign log, campaign-first
      expect(addEntry).toHaveBeenLastCalledWith('other-campaign', triggerLog({ currentHp: 7, maxHp: 10 }));
    } finally {
      real.setCombatSummaryCache(null, 'test-campaign');
      real.setCombatSummaryCache(null, 'other-campaign');
      getCurrentCombatRound.mockReset();
    }
  });
});
