// @maintained-by-ai
// reactionDebuffHandler octet — lane: DEFAULT EFFECT ROUTE CONTENT
// (handle → DEFAULT_EFFECT_ROUTE → handleBardicRoll → handleAttackRollDebuff /
// handleDamageDebuff; automation/index.js `reaction_debuff` → handle,
// auto.effect '' → default route). This file owns the two lane-internal
// detail pins + the gates that fire BEFORE them:
//   - 'caps reduced d20 at minimum of 1' (exact reduced-line, d20=1 floor)
//   - 'returns popup when damage event has no targetName' — the
//     gateBardicReaction no_defender gate (exact refusal string +
//     cutting_words_refused reason token; zero heal, zero stamp)
//   - AC ladder: effectiveAc ?? targetAc precedence + 'AC —' dash
//     (targetAc-fallback-with-a-value is pinned verbatim by cuttingWords
//     test 1 — this file pins the two shapes it does NOT cover)
//   - canonical 'Attack still hits.' prose + the no-recent-roll/mismatch
//     exits (exact full string, both trigger shapes: name mismatch and
//     null event) — shed by cuttingWords.main and now canonical repo-wide.
//
// Trim pass (octet #5): weak-shape handoffs removed —
// 'attempts healing when hit turns to miss…' (was mis-named: totalDamage 10
// made it the DAMAGE lane — folded into the damage routing pin),
// 'uses primaryDamage as fallback when totalDamage is 0' (attack-roll
// rollback branch pinned strictly stronger by cuttingWords.main full-string
// heal pin + latch exact-args pin),
// 'reduces d20…' 'Reduced'-substring-only (superseded by the cap test's
// exact reduced line + cuttingWords.flip exact HIT-line pins),
// hit→miss no-damage rollback + already-missed prose (cuttingWords.test.js
// tests 1/3 are strict supersets), damage-content 'HP: N'/defenderHp/
// null-heal pins (cuttingWords.test.js pins 'Goblin HP: 20', defenderHp
// 20/25/null + exact floor args). Generic ability_use tail stays owned by
// cuttingWords.test.js; latch/stamp/marker canon lives in
// reactionDebuffHandler.cuttingWords.latch.test.js.
//
// Deterministic: runtime/logService/range/rollback/healing/infoPopup fully
// mocked; the bardic d8 arrives through the mocked canonical diceRoller
// rollDie lane (fix#169 recipe, seed-pinned face 4) — former regex/floored
// numerals are now exact seed pins. No churn expected.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionDebuffHandler.js';

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
  setRuntimeObject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn().mockResolvedValue({
    attackEvent: null,
    attackerName: null,
    targetName: null,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
  }),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../common/infoPopup.js', () => ({
  infoPopup: vi.fn().mockImplementation((name, description, automation, extraProps) => {
    const result = {
      type: 'popup',
      payload: {
        type: 'automation_info',
        name,
        description,
        automation,
      },
    };
    if (extraProps) {
      Object.assign(result, extraProps);
    }
    return result;
  }),
}));

// Canonical dice lane mock (fix#169 recipe): the bardic die rolls through
// diceRoller.rollDie, never raw Math.random.
vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollDie: vi.fn(),
}));

import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as diceRoller from '../../../dice/diceRoller.js';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Bard',
    proficiency: 2,
    level: 3,
    class: {
      name: 'Bard',
      class_levels: [
        { level: 1, bardic_die: 6 },
        { level: 2, bardic_die: 6 },
        { level: 3, bardic_die: 8 },
      ],
    },
    abilities: [
      { name: 'Wisdom', bonus: 2 },
      { name: 'Charisma', bonus: 4 },
    ],
    characterAdvancement: [],
    _trackedResources: {
      bardicInspirationUses: { current: 4, max: 4 },
    },
    ...overrides,
  };
}

// MERGES overrides into the base automation — never replaces wholesale.
function makeAction(automation = {}) {
  return {
    name: 'Cutting Words',
    automation: {
      type: 'reaction_debuff',
      range: '60_ft',
      effect: '',
      uses_expression: null,
      recharge: 'long_rest',
      ...automation,
    },
  };
}

function makeCombatSummary(creatures = []) {
  return { round: 1, creatures };
}

// MERGES options into the base attack event (timestamp default present).
function freshAttackEvent(options = {}) {
  return {
    d20: 15,
    bonus: 5,
    targetName: 'Goblin',
    targetAc: 14,
    effectiveAc: null,
    hit: true,
    timestamp: Date.now(),
    ...options,
  };
}

const campaignName = 'test-campaign';
const mapName = 'TestMap';

describe('reactionDebuffHandler — default path: attack roll & damage debuff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks does NOT reset return values — neutralise leaks between tests
    applyHealing.applyHealingToTarget.mockReturnValue(undefined);
    // Seed pin (fix#169 idiom): bardic d8 lands face 4 on every roll.
    diceRoller.rollDie.mockReturnValue(4);
  });

  // Attack-roll lane (isDamageLane false ⇒ totalDamage 0 + damageTypes []).
  // findLastAttack MERGES damageOverride, never replaces wholesale.
  function setupAttackPath(attackEvent, damageOverride = {}) {
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
    damageRollback.findLastAttack.mockResolvedValue({
      attackEvent,
      attackerName: 'Goblin',
      targetName: 'Goblin',
      primaryDamage: 10,
      secondaryDamage: 0,
      totalDamage: 0,
      damageTypes: [],
      ...damageOverride,
    });
    return handle(makeAction(), makePlayerStats(), campaignName, mapName);
  }

  describe('default path — attack roll debuff', () => {
    it('still-hits lane: full HIT lines, canonical "Attack still hits." prose, zero heal', async () => {
      // d20(20)+5=25 vs AC 14; seed-pinned d8 face 4 ⇒ reduced d20(16)+5=21 ≥ 14 ⇒
      // still hits — exact seed pin (was every-roll regex). No rollback heal, null defenderHp.
      const result = await setupAttackPath(
        freshAttackEvent({ d20: 20, bonus: 5, hit: true, targetAc: 14 })
      );

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Cutting Words');
      expect(result.payload.description).toContain('Attack roll: d20(20) + 5 = 25 vs AC 14 → <b>HIT</b>');
      expect(result.payload.description).toContain('Reduced: d20(16) + 5 = 21 vs AC 14 → <b>HIT</b>');
      expect(diceRoller.rollDie).toHaveBeenCalledWith(8);
      expect(result.payload.description).toContain('Attack still hits.');
      expect(result.payload.description).not.toContain('now misses');
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
      expect(result.defenderHp).toBeNull();
    });

    it('caps reduced d20 at minimum of 1', async () => {
      // d20(1) − 1d8 ⇒ max(1, ·) == 1 for every roll — exact reduced line pinned.
      const result = await setupAttackPath(
        freshAttackEvent({ d20: 1, bonus: 5, hit: false, targetAc: 20 })
      );

      expect(result.payload.description).toContain('Reduced: d20(1) + 5 = 6 vs AC 20 → <b>MISS</b>');
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
      expect(result.defenderHp).toBeNull();
    });

    it('prefers effectiveAc over targetAc and falls back to a dash when both are null', async () => {
      // effectiveAc priority (targetAc 14 present but shadowed by effectiveAc 20;
      // 1d8 reduction ⇒ reduced+3 ≤ 16 < 20 ⇒ reduced MISS, deterministic)
      let result = await setupAttackPath(
        freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: 20 })
      );
      expect(result.payload.description).toContain('Attack roll: d20(14) + 3 = 17 vs AC 20 → <b>HIT</b>');
      expect(result.payload.description).toMatch(/Reduced: d20\([0-9]+\) \+ 3 = \d+ vs AC 20 → <b>MISS<\/b>/);
      expect(result.payload.description).not.toContain('vs AC 14');

      // both null ⇒ AC — and reduced outcome N/A (ac == null ⇒ reducedHit null)
      result = await setupAttackPath(
        freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: null, targetAc: null })
      );
      expect(result.payload.description).toContain('Attack roll: d20(14) + 3 = 17 vs AC \u2014 → <b>HIT</b>');
      expect(result.payload.description).toContain('vs AC \u2014 → <b>N/A</b>');
    });
  });

  describe('default path — damage debuff', () => {
    function setupDamagePath() {
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: { rawDamage: 10, targetName: 'Goblin', timestamp: Date.now() },
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['Fire'],
      });
      return handle(makeAction(), makePlayerStats(), campaignName, mapName);
    }

    it('routes to damage handler when attack has damage: exact original amount, heal threaded', async () => {
      // isDamageLane (damageTypes ['Fire'] + totalDamage 10) ⇒ handleDamageDebuff.
      // reduced = 10 − 1d8 ⇒ [2,9]; heal > 0 for every roll. Content wording is
      // owned by cuttingWords.test.js (15/1) — this pin owns routing + numerics.
      const result = await setupDamagePath();

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Cutting Words');
      expect(result.payload.description).toContain('Original damage: 10');
      expect(result.payload.description).toMatch(/Reduced damage: <b>\d+<\/b>/);
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
        expect.anything(), 'Goblin', expect.any(Number), campaignName
      );
    });

    it('refuses via the no_defender gate when damage event has no targetName: exact string, reason token, zero heal, zero stamp', async () => {
      // gateBardicReaction isDamageLane && !attackEvent.targetName — the lane
      // never reaches handleDamageDebuff (its own :95 guard is unreachable).
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: { rawDamage: 5, timestamp: Date.now() },
        attackerName: 'Goblin',
        targetName: null,
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Fire'],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Cutting Words');
      expect(result.payload.description).toBe('Could not determine who Goblin damaged. Cannot apply Cutting Words.');
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'automation',
        automationType: 'cutting_words_refused',
        reason: 'no_defender',
        characterName: 'Bard',
      }));
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeObject).not.toHaveBeenCalled();
    });
  });

  describe('default path — no fresh events', () => {
    it('returns the exact no-recent-roll popup when the last attack is missing or belongs to another creature: zero heal, zero stamp', async () => {
      // handleBardicRoll :646 gate — both trigger shapes emit the same popup.
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());

      // shape 1: attacker name mismatch
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent(),
        attackerName: 'Orc',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['Piercing'],
      });
      const mismatch = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      // shape 2: no attack event at all
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });
      const missing = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      const expected = 'No recent roll found for Goblin (attack, damage, or ability check). ' +
        'Cutting Words must be used shortly after the roll.';
      for (const result of [mismatch, missing]) {
        expect(result.type).toBe('popup');
        expect(result.payload.name).toBe('Cutting Words');
        expect(result.payload.description).toBe(expected);
      }
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeObject).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });
});
