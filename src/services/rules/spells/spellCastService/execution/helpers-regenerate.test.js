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

import { applyRegenerateSpell } from './helpers.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression, rollExpressionMaximized } from '../../../../dice/diceRoller.js';
import { addExpiration } from '../../../effects/expirations.js';
import { applyHealingToTarget } from '../../../combat/applyHealing.js';
import { getCombatContext } from '../../../combat/damageUtils.js';
import {
  resolveHealingBonusesWithDetails,
  hasHealingMaximizationForTarget,
  hasRerollHealingOnes,
} from '../../../../combat/automation/automationService.js';

// Reference mock modules for vi.mocked() usage in tests
void rollExpression;
void rollExpressionMaximized;
void addExpiration;
void applyHealingToTarget;
void getCombatContext;
void resolveHealingBonusesWithDetails;
void hasHealingMaximizationForTarget;
void hasRerollHealingOnes;

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
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('helpers.js — applyRegenerateSpell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(50);
    setRuntimeValue.mockResolvedValue(undefined);
    applyHealingToTarget.mockReturnValue({ actualHeal: 20, oldHp: 50, newHp: 70 });
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', maxHp: 100, currentHp: 50 }],
    });
    rollExpression.mockReturnValue({ total: 20, rolls: [5, 5, 5, 5] });
    resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
  });

  it('heals target and sets up regenerateActive', async () => {
    const spell = { name: 'Regenerate', level: 7, heal_at_slot_level: { 7: '4d8 + 15' } };
    const caster = makePlayerStats();

    const result = await applyRegenerateSpell(spell, { name: 'Goblin' }, caster, 'test-campaign');

    expect(applyHealingToTarget).toHaveBeenCalled();
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'regenerateActive', true, 'test-campaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'regenerateSource', 'TestWizard', 'test-campaign');
    expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestWizard', targetName: 'Goblin', effects: expect.arrayContaining([expect.objectContaining({ type: 'remove_regenerate_buff' })]), campaignName: 'test-campaign' });
    expect(result).toEqual(
      expect.objectContaining({
        targetName: 'Goblin',
        healAmount: expect.any(Number),
        formula: '4d8 + 15',
      }),
    );
  });

  it('falls back to highest slot level when exact level not found', async () => {
    const spell = { name: 'Regenerate', level: 8, heal_at_slot_level: { 7: '4d8 + 15', 9: '8d8 + 30' } };
    const caster = makePlayerStats();

    const result = await applyRegenerateSpell(spell, { name: 'Goblin' }, caster, 'test-campaign');

    expect(result.formula).toBe('4d8 + 15');
  });

  it('uses spell.level when metaCtx slotLevel is not provided', async () => {
    const spell = { name: 'Regenerate', level: 7, heal_at_slot_level: { 7: '4d8 + 15' } };
    const caster = makePlayerStats();

    await applyRegenerateSpell(spell, { name: 'Goblin' }, caster, 'test-campaign');

    expect(applyHealingToTarget).toHaveBeenCalled();
  });

  it('throws when spell.level is null', async () => {
    const spell = { name: 'Regenerate', level: null, heal_at_slot_level: { 7: '4d8 + 15' } };
    const caster = makePlayerStats();

    await expect(
      applyRegenerateSpell(spell, { name: 'Goblin' }, caster, 'test-campaign'),
    ).rejects.toThrow('spell.level is required for regenerate spell');
  });

  it('throws when heal_at_slot_level is not an object', async () => {
    const spell = { name: 'Regenerate', level: 7, heal_at_slot_level: null };
    const caster = makePlayerStats();

    await expect(
      applyRegenerateSpell(spell, { name: 'Goblin' }, caster, 'test-campaign'),
    ).rejects.toThrow('heal_at_slot_level must be an object');
  });

  it('applies healing bonus from resolveHealingBonusesWithDetails', async () => {
    resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 5, details: [{ amount: 5, name: 'Spell Power' }] });

    const spell = { name: 'Regenerate', level: 7, heal_at_slot_level: { 7: '4d8' } };
    const caster = makePlayerStats();

    const result = await applyRegenerateSpell(spell, { name: 'Goblin' }, caster, 'test-campaign');

    expect(result.rawTotal).toBe(25); // 20 from roll + 5 bonus
    expect(result.bonusHeal).toBe(5);
  });

  it('handles maximized healing', async () => {
    hasHealingMaximizationForTarget.mockReturnValue(true);
    rollExpressionMaximized.mockReturnValue({ total: 47, rolls: [8, 8, 8, 8] });

    const spell = { name: 'Regenerate', level: 7, heal_at_slot_level: { 7: '4d8 + 15' } };
    const caster = makePlayerStats();

    await applyRegenerateSpell(spell, { name: 'Goblin' }, caster, 'test-campaign');

    expect(rollExpressionMaximized).toHaveBeenCalledWith('4d8 + 15');
  });

  it('applies reroll ones when enabled', async () => {
    hasRerollHealingOnes.mockReturnValue(true);
    hasHealingMaximizationForTarget.mockReturnValue(false);
    rollExpression.mockReturnValue({ total: 15, rolls: [1, 5, 5, 4] });
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', maxHp: 100, currentHp: 50 }],
    });

    const spell = { name: 'Regenerate', level: 7, heal_at_slot_level: { 7: '4d8 + 15' } };
    const caster = makePlayerStats();

    await applyRegenerateSpell(spell, { name: 'Goblin' }, caster, 'test-campaign');

    expect(rollExpression).toHaveBeenCalledWith('4d8 + 15');
  });

  it('throws when max HP is missing for both creature and caster', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', maxHp: null, currentHp: null }],
    });
    getRuntimeValue.mockReturnValue(null);

    const spell = { name: 'Regenerate', level: 7, heal_at_slot_level: { 7: '4d8 + 15' } };
    const caster = makePlayerStats({ hitPoints: null });

    await expect(
      applyRegenerateSpell(spell, { name: 'Goblin' }, caster, 'test-campaign'),
    ).rejects.toThrow('max HP is required for regenerate spell');
  });

  it('returns result with empty arrays when expression is missing', async () => {
    const spell = { name: 'Regenerate', level: 7, heal_at_slot_level: {} };
    const caster = makePlayerStats();

    const result = await applyRegenerateSpell(spell, { name: 'Goblin' }, caster, 'test-campaign');

    expect(result.rolls).toEqual([]);
    expect(result.formula).toBeUndefined();
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'regenerateActive', true, 'test-campaign');
  });
});
