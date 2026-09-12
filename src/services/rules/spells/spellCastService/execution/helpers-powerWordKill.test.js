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

import { applyPowerWordKillToTarget } from './helpers.js';
import { getRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../ui/logService.js';
import { applyDamageToTarget } from '../../../../../services/rules/combat/applyDamage.js';
import { getCombatContext } from '../../../combat/damageUtils.js';
import { rollExpression } from '../../../../dice/diceRoller.js';

// Reference mock modules for vi.mocked() usage in tests
void addEntry;
void applyDamageToTarget;
void getCombatContext;
void rollExpression;
void getRuntimeValue;

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

describe('helpers.js — applyPowerWordKillToTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
    applyDamageToTarget.mockReturnValue({ finalDamage: 50, damageReduced: false });
  });

  it('kills target when HP <= 100', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', maxHp: 80, currentHp: 80 }],
    });

    const playerStats = makePlayerStats();
    await applyPowerWordKillToTarget('Goblin', playerStats, 'test-campaign');

    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin', 80, ['Psychic'], 'test-campaign', [], { ignoreResistance: false, attackerName: 'TestWizard' },);
    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({
        type: 'hp_change',
        targetName: 'Goblin',
        note: 'Power Word Kill',
        threshold: 'dead',
      }),
    );
  });

  it('deals 12d12 Psychic damage when HP > 100', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Dragon', maxHp: 200, currentHp: 150 }],
    });

    const playerStats = makePlayerStats();
    await applyPowerWordKillToTarget('Dragon', playerStats, 'test-campaign');

    expect(rollExpression).toHaveBeenCalledWith('12d12');
    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Dragon', expect.any(Number), ['Psychic'], 'test-campaign', [], { ignoreResistance: false, attackerName: 'TestWizard' },);
  });

  it('returns early when combat context is null', async () => {
    getCombatContext.mockResolvedValue(null);

    const playerStats = makePlayerStats();
    await applyPowerWordKillToTarget('Goblin', playerStats, 'test-campaign');

    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('returns early when creature not found', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'OtherCreature', maxHp: 50, currentHp: 50 }],
    });

    const playerStats = makePlayerStats();
    await applyPowerWordKillToTarget('NonExistent', playerStats, 'test-campaign');

    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });
});
