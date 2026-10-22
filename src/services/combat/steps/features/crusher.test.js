// @maintained-by-ai
/**
 * Feature-decision lane: steps/features/crusher.js (2024 Crusher feat —
 * once-per-turn bludgeoning rider move + enhanced-critical advantage).
 * Owns: the bludgeoning damage-type byte gate (condition and the
 * applyCrusherRiderMove re-check), the oncePerTurn attack_rider lookup
 * bytes, the `_<name>_usedRound` latch key construction (spaces →
 * underscores), the campaign-keyed targetEffects append and latch stamp
 * bytes, the same-round refusal, and applyCrusherEnhancedCritical's te /
 * addExpiration / log bytes.
 *
 * ROUND READ (#1050 FIXED, same class as colossusSlayer.js:17 and
 * epitomeEmpoweredStrikes.js:14): crusher.js:33 now passes ctx.campaignName
 * to getCurrentCombatRound(campaignName), mirroring siblings
 * (assassinate.js:28, eldritchStrikes.js:27). Pre-fix the no-arg read
 * resolved getCurrentCombatRound(undefined) → getCombatSummary(undefined) →
 * null (combatData.js:48) → constant 1 fallback (combatData.js:81): after
 * one use the latch stamp sat at 1 forever — the rider never re-armed at a
 * new round, and any attack while a stale 1-byte existed mis-refused. The
 * live-cache capture test below pins the fix against the REAL combatData
 * cache with a second-campaign decoy.
 *
 * Consumer view: src/components/char-sheet/useAttackDamageResolution.feats
 * .test.js dispatches this rider through the pipeline with an
 * argument-agnostic getCurrentCombatRound mock (round stubbed 1) — that lane
 * stays byte-intact; this lane pins the step internals (#1050 site).
 *
 * Store mock is faithful to useRuntimeState.js (reads consume
 * (characterKey, propertyName) only — the campaign byte is passed by callers
 * but ignored in-process; writes record the full campaign-keyed tuple for
 * byte pinning): #1049/#1051 shape, no call-scanning fake.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// Faithful to useRuntimeState.js: reads by (characterKey, propertyName) only;
// writes record the full campaign-keyed tuple (#1049 shape).
const runtimeStore = {};
const runtimeWrites = [];
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (characterKey, propertyName) =>
    runtimeStore[`${characterKey}:${propertyName}`] ?? null,
  setRuntimeValue: (characterKey, propertyName, value, campaignName) => {
    runtimeWrites.push([characterKey, propertyName, value, campaignName]);
    runtimeStore[`${characterKey}:${propertyName}`] = value;
  },
}));

// ── Imports ──────────────────────────────────────────────────────

import { crusher } from './crusher.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

// ── Helpers ──────────────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';
const OFF = 'other-campaign';
const LATCH = '_Crusher_usedRound';
const PREV = { formula: '1d8+5', total: 9, rolls: [4, 5] };

const CRUSHER_FEAT = {
  type: 'attack_rider',
  trigger: 'bludgeoning_damage_hit',
  oncePerTurn: true,
  name: 'Crusher',
  options: [{ name: 'Push 5 ft', effect: 'push', value: 5, sizeLimit: null, noOpportunityAttacks: false }],
};
const CC_FEAT = {
  type: 'conditional_advantage',
  trigger: 'critical_hit_bludgeoning',
  name: 'Crusher Enhanced Critical',
};

function makeStats(passives) {
  return { name: 'Barbarian1', automation: { passives } };
}

function makeCtx(overrides = {}) {
  return {
    campaignName: CAMPAIGN,
    playerStats: makeStats([CRUSHER_FEAT]),
    attack: { damageType: 'bludgeoning' },
    ...overrides,
  };
}

function writtenEffects() {
  return (runtimeWrites.filter((w) => w[1] === 'targetEffects').slice(-1)[0] || [])[2] || [];
}

// Arm every gate open except the byte under test: context present, target
// resolvable, round delivered by the mock.
function arm({ round = 3, target = { name: 'Goblin1' } } = {}) {
  getCombatContext.mockResolvedValue({ creatures: [] });
  getTargetFromAttacker.mockReturnValue(target);
  getCurrentCombatRound.mockReturnValue(round);
}

// ── Tests ────────────────────────────────────────────────────────

describe('crusher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    runtimeWrites.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('condition opens only on bludgeoning damage with passives present', () => {
    expect(crusher.condition(makeCtx())).toBe(true);
    expect(crusher.condition(makeCtx({ attack: { damageType: 'Bludgeoning' } }))).toBe(true); // case-folded byte
    expect(crusher.condition(makeCtx({ attack: { damageType: 'piercing' } }))).toBe(false);
    expect(crusher.condition(makeCtx({ attack: undefined }))).toBe(false);
    expect(crusher.condition(makeCtx({ playerStats: makeStats(undefined) }))).toBe(false);
  });

  it('live-cache round read (#1050 fix): test-campaign round 7 grants and stamps 7; second campaign reads its own round; round-wrap re-arms', async () => {
    // #1050 live capture: delegate the mocked seam to the REAL combatData
    // cache so the campaign-keyed read runs production bytes. Pre-fix the
    // no-arg read collapsed to constant 1 here (cache-miss fallback,
    // combatData.js:81) — the fresh grant stamped 1 and the round-8 re-arm
    // leg was unreachable.
    const real = await vi.importActual('../../../encounters/combatData.js');
    real.setCombatSummaryCache({ round: 7, creatures: [] }, CAMPAIGN);
    real.setCombatSummaryCache({ round: 5, creatures: [] }, OFF);
    getCurrentCombatRound.mockImplementation(real.getCurrentCombatRound);
    getCombatContext.mockResolvedValue({ creatures: [] });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin1' });
    try {
      const result = await crusher.handler(makeCtx(), PREV);
      expect(result).toEqual({ data: PREV }); // rider never reforges prevData
      expect(getCurrentCombatRound).toHaveBeenCalledWith(CAMPAIGN); // never ()

      expect(writtenEffects()).toEqual([
        {
          target: 'Goblin1',
          source: 'Crusher',
          option: 'Push 5 ft',
          effect: 'push',
          value: 5,
          sizeLimit: null,
          noOpportunityAttacks: false,
          duration: 'until_start_of_next_turn',
        },
      ]);
      const latchWrite = runtimeWrites.find((w) => w[1] === LATCH);
      expect(latchWrite).toEqual(['Barbarian1', LATCH, 7, CAMPAIGN]); // pre-fix: stamped 1

      // Same-round follow-up: latch equals the real round — refused, no re-grant.
      runtimeWrites.length = 0;
      await crusher.handler(makeCtx(), PREV);
      expect(runtimeWrites.find((w) => w[1] === LATCH)).toBeUndefined();

      // Round-wrap re-arm: cache moves to 8 → rider fires again (pre-fix this
      // never happened: the production round read was pinned to 1).
      real.setCombatSummaryCache({ round: 8, creatures: [] }, CAMPAIGN);
      await crusher.handler(makeCtx(), PREV);
      expect(runtimeWrites.find((w) => w[1] === LATCH)).toEqual(['Barbarian1', LATCH, 8, CAMPAIGN]);

      // Second campaign: its own cache byte (5), never 7/8, never the 1-fallback.
      runtimeWrites.length = 0;
      await crusher.handler(makeCtx({ campaignName: OFF }), PREV);
      expect(runtimeWrites.find((w) => w[1] === LATCH)).toEqual(['Barbarian1', LATCH, 5, OFF]);
      expect(getCurrentCombatRound).toHaveBeenLastCalledWith(OFF);
    } finally {
      real.setCombatSummaryCache(null, CAMPAIGN);
      real.setCombatSummaryCache(null, OFF);
      getCurrentCombatRound.mockReset();
    }
  });

  it('mocked-round latch cycle: fresh round grants once, same-round refuses, stale lower byte re-arms', async () => {
    arm({ round: 4 });
    await crusher.handler(makeCtx(), PREV);
    let latch = runtimeWrites.find((w) => w[1] === LATCH);
    expect(latch).toEqual(['Barbarian1', LATCH, 4, CAMPAIGN]);

    runtimeWrites.length = 0;
    await crusher.handler(makeCtx(), PREV); // same round 4 — refused
    expect(runtimeWrites).toEqual([]);

    getCurrentCombatRound.mockReturnValue(5); // stale 4 < 5 — re-arms
    await crusher.handler(makeCtx(), PREV);
    latch = runtimeWrites.find((w) => w[1] === LATCH);
    expect(latch).toEqual(['Barbarian1', LATCH, 5, CAMPAIGN]);
  });

  it('gates refuse the move without writes: non-bludgeoning, missing feat, missing oncePerTurn, no target, no options', async () => {
    // Non-bludgeoning re-check inside applyCrusherRiderMove.
    arm();
    await crusher.handler(makeCtx({ attack: { damageType: 'slashing' } }), PREV);
    expect(runtimeWrites).toEqual([]);

    // No passives at all / no matching rider / no oncePerTurn.
    for (const passives of [undefined, [], [{ ...CRUSHER_FEAT, trigger: 'weapon_attack_hit' }], [{ ...CRUSHER_FEAT, oncePerTurn: false }]]) {
      runtimeWrites.length = 0;
      await crusher.handler(makeCtx({ playerStats: makeStats(passives) }), PREV);
      expect(runtimeWrites).toEqual([]);
    }

    // Unresolvable target: never touches targetEffects, never stamps.
    arm({ target: null });
    await crusher.handler(makeCtx(), PREV);
    expect(runtimeWrites).toEqual([]);

    // Target present but feat has no options: short-circuit before writes.
    arm();
    await crusher.handler(makeCtx({ playerStats: makeStats([{ ...CRUSHER_FEAT, options: [] }]) }), PREV);
    expect(runtimeWrites).toEqual([]);
  });

  it('enhanced critical on a bludgeoning crit: te byte, expiration tuple, and exact log bytes; non-crit and missing passive stay silent', async () => {
    arm({ round: 2 });
    const critCtx = makeCtx({
      isCrit: true,
      playerStats: makeStats([CC_FEAT]), // no attack_rider here: move leg stays silent
    });
    await crusher.handler(critCtx, PREV);

    expect(writtenEffects()).toEqual([
      {
        target: 'Goblin1',
        source: 'Crusher Enhanced Critical',
        effect: 'crusher_enhanced_critical',
        duration: 'until_start_of_next_turn',
      },
    ]);
    expect(addExpiration).toHaveBeenCalledWith({
      attackerName: 'Barbarian1',
      targetName: 'Goblin1',
      effects: [{ type: 'remove_target_effect', effectKey: 'crusher_enhanced_critical', source: 'Crusher Enhanced Critical' }],
      campaignName: CAMPAIGN,
      rounds: undefined,
      expireOnCreatureName: 'Barbarian1',
    });
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'ability_use',
      characterName: 'Barbarian1',
      abilityName: 'Crusher Enhanced Critical',
      description: "Barbarian1 scored a critical hit with bludgeoning damage on Goblin1. Attack rolls against Goblin1 have Advantage until the start of Barbarian1's next turn.",
    });

    // Non-crit: no te, no expiration, no log.
    runtimeWrites.length = 0;
    addEntry.mockClear();
    addExpiration.mockClear();
    await crusher.handler(makeCtx({ playerStats: makeStats([CC_FEAT]) }), PREV);
    expect(writtenEffects()).toEqual([]);
    expect(addExpiration).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();

    // Crit without the conditional_advantage passive: the cc leg stays silent
    // (the move leg firing on its own merits is correct behavior, verified in
    // the fresh-grant test — hermetic store here so accumulation can't lie).
    delete runtimeStore['campaign:targetEffects'];
    runtimeWrites.length = 0;
    arm();
    await crusher.handler(makeCtx({ isCrit: true, playerStats: makeStats([CRUSHER_FEAT]) }), PREV);
    expect(runtimeWrites.filter((w) => w[0] === 'campaign' && JSON.stringify(w[2]).includes('crusher_enhanced_critical'))).toEqual([]);
    expect(addExpiration).not.toHaveBeenCalled();
  });
});
