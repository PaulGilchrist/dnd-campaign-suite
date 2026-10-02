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

import { applyPowerWordHealToTarget } from './helpers.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../ui/logService.js';
import { applyHealingToTarget } from '../../../combat/applyHealing.js';
import { getCombatContext } from '../../../combat/damageUtils.js';

// Reference mock modules for vi.mocked() usage in tests
void addEntry;
void applyHealingToTarget;
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
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('helpers.js — applyPowerWordHealToTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockResolvedValue(undefined);
    applyHealingToTarget.mockReturnValue({ actualHeal: 50, oldHp: 50, newHp: 100 });
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', maxHp: 100, currentHp: 50 }],
    });
  });

  it('heals target to full HP and removes conditions', async () => {
    getRuntimeValue.mockImplementation((char, key) => {
      if (key === 'activeConditions') return ['charmed', 'frightened', 'poisoned'];
      return undefined;
    });

    const playerStats = makePlayerStats();
    await applyPowerWordHealToTarget('Goblin', playerStats, 'test-campaign');

    expect(applyHealingToTarget).toHaveBeenCalled();
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      [],
      'test-campaign',
    );
    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({
        type: 'condition',
        action: 'removed',
        condition: 'Charmed',
        reason: 'Power Word Heal',
      }),
    );
  });

  it('does not set powerWordHealStandPermission when target is not prone', async () => {
    getRuntimeValue.mockImplementation((char, key) => {
      if (key === 'activeConditions') return ['charmed'];
      return undefined;
    });

    const playerStats = makePlayerStats();
    await applyPowerWordHealToTarget('Goblin', playerStats, 'test-campaign');

    expect(setRuntimeValue).not.toHaveBeenCalledWith(
      'Goblin',
      'powerWordHealStandPermission',
      true,
      'test-campaign',
    );
  });

  it('sets powerWordHealStandPermission when target is prone', async () => {
    getRuntimeValue.mockImplementation((char, key) => {
      if (key === 'activeConditions') return ['prone'];
      if (key === 'powerWordHealStandPermission') return false;
      return undefined;
    });

    const playerStats = makePlayerStats();
    await applyPowerWordHealToTarget('Goblin', playerStats, 'test-campaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'powerWordHealStandPermission',
      true,
      'test-campaign',
    );
  });

  it('does not set powerWordHealStandPermission when already set', async () => {
    getRuntimeValue.mockImplementation((char, key) => {
      if (key === 'activeConditions') return ['prone'];
      if (key === 'powerWordHealStandPermission') return true;
      return undefined;
    });

    const playerStats = makePlayerStats();
    await applyPowerWordHealToTarget('Goblin', playerStats, 'test-campaign');

    const permCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
      (c) => c[1] === 'powerWordHealStandPermission',
    );
    expect(permCalls.length).toBe(0);
  });

  it('returns early when combat context is null', async () => {
    getCombatContext.mockResolvedValue(null);

    const playerStats = makePlayerStats();
    await applyPowerWordHealToTarget('Goblin', playerStats, 'test-campaign');

    expect(applyHealingToTarget).not.toHaveBeenCalled();
  });

  it('does not heal when target is already at full HP', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', maxHp: 100, currentHp: 100 }],
    });

    const playerStats = makePlayerStats();
    await applyPowerWordHealToTarget('Goblin', playerStats, 'test-campaign');

    expect(applyHealingToTarget).not.toHaveBeenCalled();
  });

  it('handles player-type creature using runtime HP values', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'TestWizard', maxHp: 100, currentHp: 50, type: 'player' }],
    });
    getRuntimeValue.mockImplementation((char, key) => {
      if (key === 'currentHitPoints') return 30;
      if (key === 'activeConditions') return [];
      return undefined;
    });

    const playerStats = makePlayerStats();
    await applyPowerWordHealToTarget('TestWizard', playerStats, 'test-campaign');

    // Should heal from 30 (runtime) to 100 (max) = 70 HP
    expect(applyHealingToTarget).toHaveBeenCalled();
  });

  it('throws when activeConditions is not an array', async () => {
    getRuntimeValue.mockReturnValue('not-an-array');

    const playerStats = makePlayerStats();

    await expect(
      applyPowerWordHealToTarget('Goblin', playerStats, 'test-campaign'),
    ).rejects.toThrow('activeConditions must be an array');
  });

  it('SP-002: null activeConditions key is empty conditions, not an abort', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'TestWizard', maxHp: 100, currentHp: 50, type: 'player' }],
    });
    getRuntimeValue.mockImplementation((char, key) => {
      if (key === 'currentHitPoints') return 30;
      if (key === 'activeConditions') return null;
      return undefined;
    });

    const playerStats = makePlayerStats();
    await applyPowerWordHealToTarget('TestWizard', playerStats, 'test-campaign');

    expect(applyHealingToTarget).toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalledWith(
      'TestWizard',
      'activeConditions',
      expect.anything(),
      'test-campaign',
    );
  });

  it('disables conditions case-insensitively', async () => {
    getRuntimeValue.mockImplementation((char, key) => {
      if (key === 'activeConditions') return ['CHARMED', 'Frightened', 'PARALYZED', 'Poisoned', 'Stunned', 'PRONE'];
      return undefined;
    });

    const playerStats = makePlayerStats();
    await applyPowerWordHealToTarget('Goblin', playerStats, 'test-campaign');

    const newConditions = vi.mocked(setRuntimeValue).mock.calls.find(
      (c) => c[1] === 'activeConditions',
    )?.[2];
    expect(newConditions).toEqual(['PRONE']);
  });
});
