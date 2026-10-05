// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks — dependencies of helpers.js                                */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../../effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../features/spellUtils.js', () => ({
  usesSpellSlot: vi.fn(() => true),
}));

vi.mock('../../../../automation/handlers/class-wizard/arcaneWardHandler.js', () => ({
  onAbjurationSpellCast: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })),
  rollExpressionMaximized: vi.fn(() => ({ total: 8, rolls: [8] })),
  applyHealingRerollOnes: vi.fn(() => ({ displayRolls: [5], originalRolls: [5] })),
}));

vi.mock('../../../../combat/automation/automationService.js', () => ({
  markFortifiedHealthUsedIfGranted: vi.fn(),
  resolveHealingBonusesWithDetails: vi.fn(() => ({ totalBonus: 0, details: [] })),
  hasHealingMaximizationForTarget: vi.fn(() => false),
  hasRerollHealingOnes: vi.fn(() => false),
}));

vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  SUT imports after mocks                                            */
/* ------------------------------------------------------------------ */

import {
  applyHexEffects,
  triggerArcaneWard,
} from './helpers.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { usesSpellSlot } from '../../../features/spellUtils.js';
import { onAbjurationSpellCast } from '../../../../automation/handlers/class-wizard/arcaneWardHandler.js';
import { addExpiration } from '../../../effects/expirations.js';
import { rollExpression } from '../../../../dice/diceRoller.js';
import {
  resolveHealingBonusesWithDetails,
  hasHealingMaximizationForTarget,
  hasRerollHealingOnes,
} from '../../../../combat/automation/automationService.js';
import { applyHealingToTarget } from '../../../combat/applyHealing.js';
import { applyDamageToTarget } from '../../../../../services/rules/combat/applyDamage.js';
import { getCombatContext } from '../../../combat/damageUtils.js';

// Reference mock modules for vi.mocked() usage in tests
void addExpiration;
void rollExpression;
void resolveHealingBonusesWithDetails;
void hasHealingMaximizationForTarget;
void hasRerollHealingOnes;
void applyHealingToTarget;
void applyDamageToTarget;
void getCombatContext;

/* ------------------------------------------------------------------ */
/*  Test-data factories                                                */
/* ------------------------------------------------------------------ */

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      toHit: 9,
      saveDc: 17,
      modifier: 5,
    },
    automation: { passives: [] },
    hitPoints: 100,
    level: 10,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  beforeEach — reset all mock implementations to safe defaults       */
/* ------------------------------------------------------------------ */

describe('helpers.js — applyHexEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockResolvedValue(undefined);
  });

  describe('basic Hex behavior', () => {
    it('applies hex_ability_check_disadvantage when spell is Hex with target and ability', () => {
      const spell = { name: 'Hex' };
      const playerStats = makePlayerStats();

      applyHexEffects(spell, playerStats, 'test-campaign', 'Goblin', 'STR');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'Goblin',
            effect: 'hex_ability_check_disadvantage',
            source: 'TestWizard',
            ability: 'STR',
            duration: 'hex_duration',
          }),
        ]),
        'test-campaign',
      );
    });

    it('does nothing when spell is not Hex', () => {
      const spell = { name: 'Fireball' };
      const playerStats = makePlayerStats();

      applyHexEffects(spell, playerStats, 'test-campaign', 'Goblin', 'STR');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does nothing when targetName is missing', () => {
      const spell = { name: 'Hex' };
      const playerStats = makePlayerStats();

      applyHexEffects(spell, playerStats, 'test-campaign', null, 'STR');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does nothing when ability is missing', () => {
      const spell = { name: 'Hex' };
      const playerStats = makePlayerStats();

      applyHexEffects(spell, playerStats, 'test-campaign', 'Goblin', null);

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('Eldritch Hex passive', () => {
    it('also applies hex_save_disadvantage when Eldritch Hex passive exists', () => {
      const spell = { name: 'Hex' };
      const playerStats = makePlayerStats({
        automation: {
          passives: [{ name: 'Eldritch Hex', type: 'conditional_disadvantage' }],
        },
      });

      applyHexEffects(spell, playerStats, 'test-campaign', 'Goblin', 'DEX');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({ effect: 'hex_ability_check_disadvantage' }),
          expect.objectContaining({ effect: 'hex_save_disadvantage' }),
        ]),
        'test-campaign',
      );
    });

    it('does not apply hex_save_disadvantage without Eldritch Hex passive', () => {
      const spell = { name: 'Hex' };
      const playerStats = makePlayerStats({
        automation: { passives: [] },
      });

      applyHexEffects(spell, playerStats, 'test-campaign', 'Goblin', 'CON');

      const effects = vi.mocked(setRuntimeValue).mock.calls[0][2];
      const hasSaveDisadvantage = effects.some(
        (e) => e.effect === 'hex_save_disadvantage',
      );
      expect(hasSaveDisadvantage).toBe(false);
    });
  });

  // CLA-107: hex tes previously had producer-only duration:'hex_duration' with
  // zero expiry consumer — arm ONE merged remove_target_effect clock on cast.
  describe('CLA-107 expiry clock registration', () => {
    it('arms ONE merged clock clearing both hex tes for the target (hours×600)', () => {
      const playerStats = makePlayerStats({
        automation: { passives: [{ name: 'Eldritch Hex', type: 'conditional_disadvantage' }] },
      });

      applyHexEffects({ name: 'Hex' }, playerStats, 'test-campaign', 'Bandit 1', 'DEX');

      expect(addExpiration).toHaveBeenCalledTimes(1);
      const call = vi.mocked(addExpiration).mock.calls[0][0];
      expect(call.attackerName).toBe('TestWizard');
      expect(call.targetName).toBe('Bandit 1');
      expect(call.rounds).toBe(600);
      expect(call.effects).toEqual([
        { type: 'remove_target_effect', effectKey: 'hex_ability_check_disadvantage', source: 'TestWizard', target: 'Bandit 1' },
        { type: 'remove_target_effect', effectKey: 'hex_save_disadvantage', source: 'TestWizard', target: 'Bandit 1' },
      ]);
    });

    it('base Hex (no Eldritch Hex passive) registers only the check-disadvantage leg', () => {
      const playerStats = makePlayerStats({ automation: { passives: [] } });

      applyHexEffects({ name: 'Hex' }, playerStats, 'test-campaign', 'Bandit 1', 'DEX');

      expect(addExpiration).toHaveBeenCalledTimes(1);
      const call = vi.mocked(addExpiration).mock.calls[0][0];
      expect(call.effects).toEqual([
        { type: 'remove_target_effect', effectKey: 'hex_ability_check_disadvantage', source: 'TestWizard', target: 'Bandit 1' },
      ]);
    });
  });

  describe('updating existing effects', () => {
    it('replaces existing hex_ability_check_disadvantage instead of adding duplicate', () => {
      const spell = { name: 'Hex' };
      const playerStats = makePlayerStats();

      getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'targetEffects') {
          return [
            {
              target: 'Goblin',
              effect: 'hex_ability_check_disadvantage',
              source: 'TestWizard',
              ability: 'INT',
              duration: 'old_duration',
            },
          ];
        }
        return [];
      });

      applyHexEffects(spell, playerStats, 'test-campaign', 'Goblin', 'STR');

      const effects = vi.mocked(setRuntimeValue).mock.calls[0][2];
      const hexAbilityEffects = effects.filter(
        (e) => e.effect === 'hex_ability_check_disadvantage',
      );
      expect(hexAbilityEffects.length).toBe(1);
      expect(hexAbilityEffects[0].ability).toBe('STR');
      expect(hexAbilityEffects[0].duration).toBe('hex_duration');
    });

    it('replaces existing hex_save_disadvantage instead of adding duplicate', () => {
      const spell = { name: 'Hex' };
      const playerStats = makePlayerStats({
        automation: {
          passives: [{ name: 'Eldritch Hex', type: 'conditional_disadvantage' }],
        },
      });

      getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'targetEffects') {
          return [
            {
              target: 'Goblin',
              effect: 'hex_save_disadvantage',
              source: 'TestWizard',
              ability: 'INT',
              duration: 'old_duration',
            },
          ];
        }
        return [];
      });

      applyHexEffects(spell, playerStats, 'test-campaign', 'Goblin', 'WIS');

      const effects = vi.mocked(setRuntimeValue).mock.calls[0][2];
      const hexSaveEffects = effects.filter(
        (e) => e.effect === 'hex_save_disadvantage',
      );
      expect(hexSaveEffects.length).toBe(1);
      expect(hexSaveEffects[0].ability).toBe('WIS');
    });
  });
});

describe('helpers.js — triggerArcaneWard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usesSpellSlot.mockReturnValue(true);
  });

  it('calls onAbjurationSpellCast for abjuration spells with Arcane Ward passive', async () => {
    const spell = { name: 'Shield', school: 'Abjuration' };
    const metaCtx = { slotLevel: 1 };
    const playerStats = makePlayerStats({
      automation: {
        passives: [{ type: 'arcane_ward' }],
      },
    });

    await triggerArcaneWard(spell, metaCtx, playerStats, 'test-campaign');

    expect(onAbjurationSpellCast).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Arcane Ward' }),
      playerStats,
      'Shield',
      1,
      'test-campaign',
    );
  });

  it('does nothing for non-abjuration spells', async () => {
    const spell = { name: 'Fireball', school: 'Evocation' };
    const metaCtx = { slotLevel: 3 };
    const playerStats = makePlayerStats({
      automation: {
        passives: [{ type: 'arcane_ward' }],
      },
    });

    await triggerArcaneWard(spell, metaCtx, playerStats, 'test-campaign');

    expect(onAbjurationSpellCast).not.toHaveBeenCalled();
  });

  it('does nothing when Spell Slot is not used', async () => {
    usesSpellSlot.mockReturnValue(false);
    const spell = { name: 'Shield', school: 'Abjuration' };
    const metaCtx = { slotLevel: 1 };
    const playerStats = makePlayerStats({
      automation: {
        passives: [{ type: 'arcane_ward' }],
      },
    });

    await triggerArcaneWard(spell, metaCtx, playerStats, 'test-campaign');

    expect(onAbjurationSpellCast).not.toHaveBeenCalled();
  });

  it('throws when passives is null', async () => {
    const spell = { name: 'Shield', school: 'Abjuration' };
    const metaCtx = { slotLevel: 1 };
    const playerStats = makePlayerStats({
      automation: { passives: null },
    });

    await expect(
      triggerArcaneWard(spell, metaCtx, playerStats, 'test-campaign'),
    ).rejects.toThrow('playerStats.automation.passives is required for Arcane Ward');
  });

  it('handles onAbjurationSpellCast errors gracefully', async () => {
    const spell = { name: 'Shield', school: 'Abjuration' };
    const metaCtx = { slotLevel: 1 };
    const playerStats = makePlayerStats({
      automation: {
        passives: [{ type: 'arcane_ward' }],
      },
    });

    onAbjurationSpellCast.mockRejectedValue(new Error('test error'));

    // Should not throw — error is caught internally
    await expect(
      triggerArcaneWard(spell, metaCtx, playerStats, 'test-campaign'),
    ).resolves.toBeUndefined();
  });

  it('recognizes arcane_ward via passive_rule type', async () => {
    const spell = { name: 'Shield', school: 'Abjuration' };
    const metaCtx = { slotLevel: 1 };
    const playerStats = makePlayerStats({
      automation: {
        passives: [{ type: 'passive_rule', effect: 'arcane_ward' }],
      },
    });

    await triggerArcaneWard(spell, metaCtx, playerStats, 'test-campaign');

    expect(onAbjurationSpellCast).toHaveBeenCalled();
  });
});
