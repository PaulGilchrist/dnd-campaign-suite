// CLA-071: Cutting Words — debuff CONTENT & WORDING lane (non-latch sibling).
//
// reactionDebuffHandler octet — lane: CUTTING WORDS content (default route →
// handleBardicRoll → handleAttackRollDebuff / handleDamageDebuff /
// appendAttackOutcomeLines / attackRollHtml; automation/index.js
// `reaction_debuff` → handle → DEFAULT_EFFECT_ROUTE). This file owns the
// popup composition: d20-hit→MISS display, hit-outcome prose branches
// ("now misses!" + healed line, "No damage event found to reverse",
// "already missed — no effect"), damage-reduction wording incl. the
// max(0) floor and null-heal-result shape, the bardic-uses exhaustion early
// exit (the only no-uses_expression path in the octet), and the generic
// ability_use tail (DEFAULT_EFFECT_ROUTE, tail:null — the only file pinning
// it). Latch/round-stamp/rollback-args/identity canon lives in the sibling
// reactionDebuffHandler.cuttingWords.latch.test.js.
//
// Seam map (trimmed pass): still-hits prose + d20-floor-at-1 pins are owned
// by defaultPath.test.js (identical setups — the former copies here were
// removed); shield/target/null-combat-context exits are owned by
// earlyExits.test.js; no-recent-roll/mismatch exits by defaultPath.test.js.
// The BI-use economy stamp (latch + marker + bardicInspirationUses, exact
// keys + skipSync=true + flush) is a strict superset in latch test 3 — the
// former loose decrement test here was removed. The hit→miss rollback heal is
// an exact-args pair: latch test 4 pins (defender, 10, campaignName), this
// file pins the prose + defenderHp surfacing (full strings below).
// All randomness contained: mockRuntime router for the one uses-exit probe,
// fixed attack events, deterministic prose substrings.
// @maintained-by-ai
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

// Canonical dice lane mock (fix#169 recipe): the bardic inspiration die now
// rolls through diceRoller.rollDie, never raw Math.random — so the former
// distribution-proof substrings become exact seed pins on face 4.
vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollDie: vi.fn(),
}));

import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as logService from '../../../ui/logService.js';
import * as diceRoller from '../../../dice/diceRoller.js';

const campaignName = 'test-campaign';
const mapName = 'TestMap';

function makeBardStats(overrides = {}) {
  return {
    name: 'CuttingWordsBard',
    proficiency: 2,
    level: 3,
    class: {
      name: 'Bard',
      class_levels: [
        { level: 1, bardic_die: 6 },
        { level: 2, bardic_die: 6 },
        { level: 3, bardic_die: 6 },
      ],
    },
    abilities: [
      { name: 'Charisma', bonus: 4 },
      { name: 'Intelligence', bonus: 1 },
    ],
    characterAdvancement: [],
    _trackedResources: {
      bardicInspirationUses: { current: 4, max: 4 },
    },
    ...overrides,
  };
}

function makeCuttingWordsAction() {
  return {
    name: 'Cutting Words',
    automation: {
      type: 'reaction_debuff',
      trigger: 'damage_ability_check_or_attack_roll_within_60ft',
      debuffExpression: 'bardic_inspiration_die',
      subtractive: true,
      range: '60 ft',
      casting_time: '1 reaction',
    },
  };
}

function makeCombatSummary(creatures = []) {
  return { round: 1, creatures };
}

// Attack-roll lane (totalDamage must be overridden to 0 — see lane routing):
// findLastAttack result MERGES overrides, never replaces wholesale.
function setupAttackPath(attackEventOverrides = {}, damageOverrides = {}) {
  targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
  damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin', hp: 15 }]));
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent: {
      d20: 14,
      bonus: 3,
      targetName: 'Goblin',
      targetAc: 17,
      hit: true,
      timestamp: Date.now(),
      ...attackEventOverrides,
    },
    attackerName: 'Goblin',
    targetName: 'Goblin',
    primaryDamage: 10,
    secondaryDamage: 0,
    totalDamage: 10,
    damageTypes: ['Piercing'],
    ...damageOverrides,
  });
  return { action: makeCuttingWordsAction() };
}

function setupDamagePath(rawDamage = 10) {
  targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
  damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin', hp: 15 }]));
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent: { rawDamage, targetName: 'Goblin', timestamp: Date.now() },
    attackerName: 'Goblin',
    targetName: 'Goblin',
    primaryDamage: rawDamage,
    secondaryDamage: 0,
    totalDamage: rawDamage,
    damageTypes: ['Fire'],
  });
  return { action: makeCuttingWordsAction() };
}

describe('CLA-071: Cutting Words — content & wording (non-latch lane)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
    // Seed pin (fix#169 idiom): bardic d6 lands face 4 on every roll.
    diceRoller.rollDie.mockReturnValue(4);
  });

  describe('attack roll debuff wording', () => {
    it('flips a 17-vs-AC-17 hit to MISS and reports the reversal with no damage event to reverse', async () => {
      // d20(14)+3=17 HIT vs AC 17; BI d6 seed-pinned at 4 ⇒ reduced d20(10)+3=13 < 17 ⇒ MISS.
      // No damage recorded (total + primary == 0) ⇒ zero heal, reverse-failure prose.
      const { action } = setupAttackPath(
        { d20: 14, bonus: 3, targetAc: 17, hit: true },
        { totalDamage: 0, primaryDamage: 0, damageTypes: [] }
      );

      const result = await handle(action, makeBardStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Cutting Words');
      expect(result.payload.description).toContain('Cutting Words');
      expect(result.payload.description).toContain('Bardic Inspiration die: 1d6 = <b>4</b>');
      expect(result.payload.description).toContain('Attack roll: d20(14) + 3 = 17 vs AC 17 → <b>HIT</b>');
      expect(result.payload.description).toContain('Reduced: d20(10) + 3 = 13 vs AC 17 → <b>MISS</b>');
      expect(result.payload.description).toContain('→ <b>MISS</b>');
      expect(result.payload.description).toContain('The attack now misses!');
      expect(result.payload.description).toContain('No damage event found to reverse for Goblin.');
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
      expect(result.defenderHp).toBeNull();
    });

    it('heals target when attack roll hit turns to miss with primary damage available', async () => {
      // Exact-args complement lives in latch test 4 ('Bandit 1', 10, campaignName);
      // this pin owns the prose + defenderHp surfacing (full strings).
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 25, actualHeal: 10 });

      const { action } = setupAttackPath(
        { d20: 14, bonus: 3, targetAc: 17, hit: true },
        { totalDamage: 0, damageTypes: [], primaryDamage: 10 }
      );

      const result = await handle(action, makeBardStats(), campaignName, mapName);

      expect(result.payload.description).toContain('The attack now misses!');
      expect(result.payload.description).toContain('Goblin healed for 10 HP.');
      expect(result.defenderHp).toBe(25);
    });

    it('reports no effect when the attack already missed', async () => {
      // appendAttackOutcomeLines hit===false branch — prose owned here.
      const { action } = setupAttackPath(
        { d20: 8, bonus: 2, targetAc: 15, hit: false },
        { totalDamage: 0, primaryDamage: 0, damageTypes: [] }
      );

      const result = await handle(action, makeBardStats(), campaignName, mapName);

      expect(result.payload.description).toContain('Attack roll: d20(8) + 2 = 10 vs AC 15 → <b>MISS</b>');
      // Seed-pinned face 4 ⇒ reduced d20(4) + 2 = 6 (exact, was dice-agnostic).
      expect(result.payload.description).toContain('Reduced: d20(4) + 2 = 6 vs AC 15 → <b>MISS</b>');
      expect(result.payload.description).toContain('The attack already missed — no effect.');
      expect(result.payload.description).not.toContain('now misses');
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
      expect(result.defenderHp).toBeNull();
    });
  });

  describe('damage debuff wording', () => {
    it('reduces 15 damage by the bardic die and heals + surfaces new HP', async () => {
      // BI d6 seed-pinned at 4 ⇒ reduced = 15 − 4 = 11 exactly; heal == 4.
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 20 });

      const { action } = setupDamagePath(15);

      const result = await handle(action, makeBardStats(), campaignName, mapName);

      expect(result.payload.description).toContain('Bardic Inspiration die: 1d6 = <b>4</b>');
      expect(result.payload.description).toContain('Original damage: 15');
      expect(result.payload.description).toContain('Reduced damage: <b>11</b>');
      expect(result.payload.description).toContain('Healed Goblin for 4 HP.');
      expect(result.payload.description).toContain('Goblin HP: 20');
      expect(result.defenderHp).toBe(20);
    });

    it('floors 1 damage to 0 and returns null defenderHp when the heal result is missing', async () => {
      // original 1 − seed-pinned 4 ⇒ max(0, ·) == 0 and heal == 1 — same exact
      // pins as before, now deterministic-by-mock instead of every-roll-proof.
      // unique exact-amount pin (1) vs latch lane's 6/10.
      applyHealing.applyHealingToTarget.mockReturnValue(null);

      const { action } = setupDamagePath(1);

      const result = await handle(action, makeBardStats(), campaignName, mapName);

      expect(result.payload.description).toContain('Original damage: 1');
      expect(result.payload.description).toContain('Reduced damage: <b>0</b>');
      expect(result.payload.description).toContain('Healed Goblin for 1 HP.');
      expect(result.payload.description).not.toContain('Goblin HP:');
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin', 1, campaignName);
      expect(result.defenderHp).toBeNull();
    });
  });

  describe('bardic uses early exit', () => {
    it('exits before any dispatch when bardic uses are exhausted: full refusal wording, zero spend', async () => {
      // Only octet path exercising the _trackedResources.bardicInspirationUses
      // budget (no uses_expression); current runtime value 0 ⇒ early exit.
      useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'CuttingWordsBard' && prop === 'bardicInspirationUses') return 0;
        return undefined;
      });

      const result = await handle(makeCuttingWordsAction(), makeBardStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Cutting Words');
      expect(result.payload.description).toBe('Cutting Words has no uses remaining. Recharges on a Long Rest.');
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
      expect(diceRoller.rollDie).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeObject).not.toHaveBeenCalled();
    });
  });

  describe('generic ability_use tail', () => {
    it('logs exactly ONE ability_use tail entry for the default route', async () => {
      // DEFAULT_EFFECT_ROUTE (tail:null) falls through to handle()'s generic
      // addEntry — the only pin of that seam in the octet.
      const { action } = setupAttackPath(
        { d20: 14, bonus: 3, targetAc: 17, hit: true },
        { totalDamage: 0, primaryDamage: 0, damageTypes: [] }
      );

      await handle(action, makeBardStats(), campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledTimes(1);
      expect(diceRoller.rollDie).toHaveBeenCalledTimes(1);
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'CuttingWordsBard',
        abilityName: 'Cutting Words',
        targetName: 'Goblin',
      }));
    });
  });
});
