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

import { triggerExpertDivination } from './helpers.js';
import { executeHandler } from '../../../../automation/index.js';
import { usesSpellSlot } from '../../../features/spellUtils.js';

// Reference mock modules for vi.mocked() usage in tests
void executeHandler;
void usesSpellSlot;

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

describe('helpers.js — triggerExpertDivination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usesSpellSlot.mockReturnValue(true);
    executeHandler.mockResolvedValue({ result: 'precognition' });
  });

  it('executes handler for divination school spells level 2+', async () => {
    const spell = { name: 'Arcane Eye', school: 'Divination' };
    const metaCtx = { slotLevel: 3 };
    const playerStats = makePlayerStats({
      automation: {
        passives: [{ name: 'Expert Divination', type: 'expert_divination' }],
      },
    });

    const result = await triggerExpertDivination(
      spell,
      metaCtx,
      playerStats,
      'test-campaign',
      'test-map',
    );

    expect(executeHandler).toHaveBeenCalled();
    expect(result).toEqual({ result: 'precognition' });
  });

  it('returns null for non-divination spells', async () => {
    const spell = { name: 'Fireball', school: 'Evocation' };
    const metaCtx = { slotLevel: 3 };
    const playerStats = makePlayerStats({
      automation: {
        passives: [{ name: 'Expert Divination', type: 'expert_divination' }],
      },
    });

    const result = await triggerExpertDivination(
      spell,
      metaCtx,
      playerStats,
      'test-campaign',
      'test-map',
    );

    expect(result).toBeNull();
    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('returns null for cantrips (level 0)', async () => {
    const spell = { name: 'Arcane Eye', school: 'Divination' };
    const metaCtx = { slotLevel: 0 };
    const playerStats = makePlayerStats({
      automation: {
        passives: [{ name: 'Expert Divination', type: 'expert_divination' }],
      },
    });

    const result = await triggerExpertDivination(
      spell,
      metaCtx,
      playerStats,
      'test-campaign',
      'test-map',
    );

    expect(result).toBeNull();
  });

  it('returns null for level 1 divination spells', async () => {
    const spell = { name: 'Arcane Eye', school: 'Divination' };
    const metaCtx = { slotLevel: 1 };
    const playerStats = makePlayerStats({
      automation: {
        passives: [{ name: 'Expert Divination', type: 'expert_divination' }],
      },
    });

    const result = await triggerExpertDivination(
      spell,
      metaCtx,
      playerStats,
      'test-campaign',
      'test-map',
    );

    expect(result).toBeNull();
  });

  it('returns null when spell does not use a spell slot', async () => {
    usesSpellSlot.mockReturnValue(false);
    const spell = { name: 'Arcane Eye', school: 'Divination' };
    const metaCtx = { slotLevel: 3 };
    const playerStats = makePlayerStats({
      automation: {
        passives: [{ name: 'Expert Divination', type: 'expert_divination' }],
      },
    });

    const result = await triggerExpertDivination(
      spell,
      metaCtx,
      playerStats,
      'test-campaign',
      'test-map',
    );

    expect(result).toBeNull();
  });

  it('throws when passives is null', async () => {
    const spell = { name: 'Arcane Eye', school: 'Divination' };
    const metaCtx = { slotLevel: 3 };
    const playerStats = makePlayerStats({
      automation: { passives: null },
    });

    await expect(
      triggerExpertDivination(spell, metaCtx, playerStats, 'test-campaign', 'test-map'),
    ).rejects.toThrow('playerStats.automation.passives is required for expert divination');
  });

  it('handles executeHandler errors gracefully', async () => {
    const spell = { name: 'Arcane Eye', school: 'Divination' };
    const metaCtx = { slotLevel: 3 };
    const playerStats = makePlayerStats({
      automation: {
        passives: [{ name: 'Expert Divination', type: 'expert_divination' }],
      },
    });

    executeHandler.mockRejectedValue(new Error('handler error'));

    const result = await triggerExpertDivination(
      spell,
      metaCtx,
      playerStats,
      'test-campaign',
      'test-map',
    );

    expect(result).toBeNull();
  });
});
