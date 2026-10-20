// @maintained-by-ai
/**
 * Tavern Brawler PUSH lane (owner of src/services/combat/steps/features/tavernBrawlerPush.js).
 * Contract: condition is a coarse gate (unarmed weaponType + hit !== false +
 * automation.passives truthy). Handler: 'tavern_brawler_push' passive required
 * (else null, zero side effects); strict-=== once-per-turn latch on
 * _Tavern_Brawler_Push_UsedRound (refusal log + pass-through); target resolved
 * combat-context-first, ctx.targetName fallback, junk/unresolvable honest;
 * latch AWAITED before the te write (playbook §39); MA-0079 push te marker
 * appended to campaign targetEffects; one exact success log entry.
 *
 * Pair-split table (#1061, no lane re-drives another's bytes):
 *   tavernBrawler.test.js — reroll core (cited, maintained)
 *   this file — push lane: latch bytes, MA-0079 te marker bytes, refusal log bytes
 *   useAttackDamageResolution.feats.test.js — push dispatch at the pipeline seam (cited)
 *
 * Applied recs: #1061 verdicts — old :111 weak log test folded into the happy-path
 * exact-entry test (#829 log-exact mandate); old :105 te-read test subsumed by
 * exact getRuntimeValue/setRuntimeValue call tuples here (#786 bytes-once).
 * #1057/#1051 stubStore verbatim (campaign-faithful store, loud off-lane decoy,
 * per-row re-arm), strict-=== latch suite, zero-side-effect gates (#936/#1026),
 * distinguishable target bytes (#1022: combat-context target ≠ ctx fallback),
 * #945 unplaced/junk targets honest, #910 honest titles, #1012 registry-cited:
 * 'push' te key is real (targetEffectDefinitions.js:1385, fields source+value);
 * value 5 = hardcoded tavern-brawler push distance (seam math, no wall clock).
 *
 * Mock audit (#1049): all 4 mocked modules are live imports of the source.
 *
 * Old→new map (16 → 8 tests):
 *   condition ×6 (incl. dishonest 'fails without passive' that asserted true)
 *     → one honest truth table (+hit-undefined coarse pass, +coarse-gate row)
 *     + playerStats-null TypeError honesty
 *   handler 'latch stamp' + 'te marker' + 'te read' + 'logs push' + 'latch
 *     before te' → one happy-path test pinning exact call tuples + log bytes
 *   'refuses once per turn' → strict-=== refusal, exact refusal log bytes,
 *     zero writes, bails before getCombatContext
 *   'latch from previous round' → near-miss latch-value table (stale round,
 *     string round, object latch) — strict === never false-refuses
 *   'non-unarmed never fires' (dishonest: cleared passives) → honest
 *     missing-passive falsifier, null, zero reads
 *   'appends without clobbering' → kept, by-reference append pin
 *   'no target resolved' → target-resolution table (fallback/junk/unresolvable)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks (all imported by tavernBrawlerPush.js — verified, no dead mocks) ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

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

// ── Imports ──────────────────────────────────────────────────────

import { tavernBrawlerPush } from './tavernBrawlerPush.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

// ── Fixtures ─────────────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';
const ATTACKER = 'UnarmedUla';
const LATCH = '_Tavern_Brawler_Push_UsedRound';
const ROUND = 3;
// Distinguishable bytes (#1022): combat-context target ≠ ctx fallback target,
// so every happy-path pin proves WHICH source supplied the target.
const CS = { combatants: ['Goblin 7'] };
const CS_TARGET = 'Goblin 7';
const CTX_TARGET = 'Bandit 1';
const PREV_DATA = { formula: '1d4+3', total: 5, rolls: [2] };

// MA-0079 marker byte shape: numeric value, instant (registry key 'push').
const marker = (target) => ({ target, source: ATTACKER, effect: 'push', value: 5, duration: 'instant' });

function makeCtx(overrides = {}) {
  return {
    campaignName: CAMPAIGN,
    playerStats: {
      name: ATTACKER,
      automation: { passives: [{ effect: 'tavern_brawler_push', oncePerTurn: true }] },
    },
    attack: { name: 'Unarmed Strike', weaponType: 'unarmed', damage: '1d4+3' },
    targetName: CTX_TARGET,
    hit: true,
    ...overrides,
  };
}

// Campaign/character-faithful store stub (#1057/#1051): any read off the
// correct lane returns a loud decoy so a wrong-campaign read fails assertions.
function stubStore(map = {}) {
  getRuntimeValue.mockImplementation((character, key, campaign) => {
    if (campaign !== CAMPAIGN) return { attackName: 'DECOY-WRONG-CAMPAIGN' };
    return map[`${character}.${key}`] ?? null;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentCombatRound.mockReturnValue(ROUND);
  getCombatContext.mockResolvedValue(CS);
  getTargetFromAttacker.mockReturnValue({ name: CS_TARGET });
  setRuntimeValue.mockResolvedValue(undefined);
  stubStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── condition ────────────────────────────────────────────────────

describe('tavernBrawlerPush.condition', () => {
  it.each([
    ['unarmed hit with automation passives (baseline)', {}, true],
    ['hit undefined passes the coarse `hit !== false` gate', { hit: undefined }, true],
    ['coarse gate: unrelated passives still pass — the handler gates the effect', { playerStats: { name: ATTACKER, automation: { passives: [{ effect: 'other' }] } } }, true],
    ['armed melee weapon', { attack: { name: 'Longsword', weaponType: 'melee' } }, false],
    // FT-090 guard: unarmed rows collapse to melee weaponType upstream —
    // the flag alone must never false-fire this weaponType-based gate.
    ['melee-collapsed row carrying isUnarmedStrike', { attack: { name: 'Longsword', weaponType: 'melee', isUnarmedStrike: true } }, false],
    ['miss (hit: false)', { hit: false }, false],
    ['character without automation', { playerStats: { name: ATTACKER } }, false],
  ])('%s → %s', (_label, overrides, expected) => {
    expect(tavernBrawlerPush.condition(makeCtx(overrides))).toBe(expected);
  });

  it('throws TypeError honestly when playerStats is null (no silent fallback)', () => {
    expect(() => tavernBrawlerPush.condition({ campaignName: CAMPAIGN, attack: { weaponType: 'unarmed' }, playerStats: null })).toThrow(TypeError);
  });
});

// ── handler ──────────────────────────────────────────────────────

describe('tavernBrawlerPush.handler', () => {
  it('happy path: exact latch-then-te call tuples, campaign-threaded reads and writes, exact log entry', async () => {
    const result = await tavernBrawlerPush.handler(makeCtx(), PREV_DATA);

    expect(result).toEqual({ data: PREV_DATA });
    expect(result.data).toBe(PREV_DATA); // pass-through by identity, untouched
    expect(getCurrentCombatRound).toHaveBeenCalledWith(CAMPAIGN);
    expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
    // CS_TARGET ≠ CTX_TARGET proves the combat-context target won the byte.
    expect(getTargetFromAttacker).toHaveBeenCalledWith(CS, ATTACKER);
    // Reads: exactly the latch, then the campaign te list — both campaign-threaded.
    expect(getRuntimeValue.mock.calls).toEqual([
      [ATTACKER, LATCH, CAMPAIGN],
      ['campaign', 'targetEffects', CAMPAIGN],
    ]);
    // Writes: latch AWAITED before the te write (§39) — full tuple order pinned.
    expect(setRuntimeValue.mock.calls).toEqual([
      [ATTACKER, LATCH, ROUND, CAMPAIGN],
      ['campaign', 'targetEffects', [marker(CS_TARGET)], CAMPAIGN],
    ]);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'ability_use',
      characterName: ATTACKER,
      abilityName: 'Tavern Brawler',
      description: `Tavern Brawler Push: ${CS_TARGET} pushed 5 feet straight away from ${ATTACKER} after an Unarmed Strike hit (token position GM-enforced, gridless advisory).`,
      targetName: CS_TARGET,
      timestamp: expect.any(Number),
    });
  });

  it('appends the marker to existing targetEffects by reference, never clobbering', async () => {
    const existing = { target: 'Other', effect: 'restrained' };
    stubStore({ 'campaign.targetEffects': [existing] });

    await tavernBrawlerPush.handler(makeCtx(), PREV_DATA);

    const teWrite = setRuntimeValue.mock.calls.find(([c, k]) => c === 'campaign' && k === 'targetEffects');
    expect(teWrite).toEqual(['campaign', 'targetEffects', [existing, marker(CS_TARGET)], CAMPAIGN]);
    expect(teWrite[2][0]).toBe(existing); // kept by reference, appended not merged
  });

  it('once-per-turn: strict-=== latch for current round refuses — exact refusal bytes, zero writes, bails before combat context', async () => {
    stubStore({ [`${ATTACKER}.${LATCH}`]: ROUND });

    const result = await tavernBrawlerPush.handler(makeCtx(), PREV_DATA);

    expect(result).toEqual({ data: PREV_DATA });
    expect(result.data).toBe(PREV_DATA);
    expect(getRuntimeValue.mock.calls).toEqual([[ATTACKER, LATCH, CAMPAIGN]]); // never reaches the te read
    expect(getCombatContext).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled(); // 0 write bytes on refusal
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'automation',
      automationType: 'tavern_brawler_push_refused',
      characterName: ATTACKER,
      description: `${ATTACKER}'s Tavern Brawler Push already used this turn — Push refused (once_per_turn).`,
      targetName: CTX_TARGET,
      timestamp: expect.any(Number),
    });
  });

  it.each([
    ['stale round latch (2)', 2],
    ['string round latch ("3")', '3'],
    ['object latch from another feature\'s shape', { round: ROUND }],
  ])('strict === never false-refuses: %s → fires and re-stamps latch to round 3', async (_label, latch) => {
    stubStore({ [`${ATTACKER}.${LATCH}`]: latch });

    const result = await tavernBrawlerPush.handler(makeCtx(), PREV_DATA);

    expect(result).toEqual({ data: PREV_DATA });
    expect(setRuntimeValue).toHaveBeenCalledWith(ATTACKER, LATCH, ROUND, CAMPAIGN);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry.mock.calls[0][1].type).toBe('ability_use'); // success log, not refusal
  });

  it('no tavern_brawler_push passive → null, bails before any store/round/context read', async () => {
    const ctx = makeCtx({ playerStats: { name: ATTACKER, automation: { passives: [{ effect: 'tavern_brawler_reroll_ones' }] } } });

    expect(await tavernBrawlerPush.handler(ctx, PREV_DATA)).toBeNull();
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(getCurrentCombatRound).not.toHaveBeenCalled();
    expect(getCombatContext).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it.each([
    ['no combat context → ctx.targetName fallback', null, undefined, CTX_TARGET],
    ['junk combat-context target record → ctx.targetName fallback', {}, {}, CTX_TARGET],
    ['nothing resolvable → pass-through, zero writes, no log', {}, null, null],
  ])('target resolution: %s', async (_label, cs, resolved, finalTarget) => {
    getCombatContext.mockResolvedValue(cs);
    getTargetFromAttacker.mockReturnValue(resolved);
    stubStore();
    const ctx = makeCtx({ targetName: finalTarget });

    const result = await tavernBrawlerPush.handler(ctx, PREV_DATA);

    expect(result).toEqual({ data: PREV_DATA });
    if (cs) expect(getTargetFromAttacker).toHaveBeenCalledWith(cs, ATTACKER);
    else expect(getTargetFromAttacker).not.toHaveBeenCalled();
    if (finalTarget) {
      expect(setRuntimeValue.mock.calls).toEqual([
        [ATTACKER, LATCH, ROUND, CAMPAIGN],
        ['campaign', 'targetEffects', [marker(finalTarget)], CAMPAIGN],
      ]);
      expect(addEntry).toHaveBeenCalledTimes(1);
    } else {
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    }
  });
});
