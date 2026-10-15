// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCombatSuperiorityModal } from './useCombatSuperiorityModal.js';

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  executeManeuver: vi.fn(),
  onCombatSuperioritySelected: vi.fn(),
}));

import { setRuntimeValue, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { executeManeuver } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

const mockPlayerStats = { name: 'Thorin', level: 5 };
const mockCampaignName = 'test-campaign';

// Precision Attack (2024 maneuvers.json: trigger 'attack_roll_miss',
// effect 'attack_roll_bonus', dieExpression 'superiority_die'): add the
// superiority die to the last attack roll, re-resolve hit/miss, and trigger
// damage when the amended roll now hits.
const lastAttack = {
  damageFormula: '2d6+3',
  damageType: 'Slashing',
  damageName: 'Longsword',
  attackName: 'Longsword',
  targetName: 'Orc',
};

const lastAttackRoll = (overrides = {}) => ({
  d20: 8,
  bonus: 5,
  targetAc: 16,
  isCrit: false,
  ...overrides,
});

// Open-and-confirm seam (shared shape with confirm-basic.test.js), stubbed
// so executeManeuver returns the attack_roll_bonus result the hook re-resolves.
async function openAndConfirmPrecision({
  roll = lastAttackRoll(),
  attack = lastAttack,
  dieValue = 4,
  rollDamage,
  playerStats = mockPlayerStats,
  campaignName = mockCampaignName,
} = {}) {
  getRuntimeValue.mockImplementation((ns, key) =>
    ns === 'campaign' && key === 'lastAttack' ? attack : roll
  );
  executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

  const onPopupHtml = vi.fn();
  const { result } = renderHook(() =>
    useCombatSuperiorityModal(playerStats, campaignName, vi.fn(), rollDamage, onPopupHtml)
  );
  act(() => {
    result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
  });
  await act(async () => {
    await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
  });
  return { result, onPopupHtml };
}

const lastAttackRollWrites = () =>
  setRuntimeValue.mock.calls.filter(call => call[0] === 'Thorin' && call[1] === 'lastAttackRoll');

describe('useCombatSuperiorityModal - Precision Attack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rollExpression.mockReturnValue({ total: 10, rolls: [4, 3], modifier: 3 });
  });

  it('turns a miss into a hit: rewrites both attack caches, rolls damage, clears the pending prompt', async () => {
    // Misses originally (8 + 5 = 13 < 16); the d4 of 4 amends it to 17.
    const rollDamage = vi.fn();
    const { onPopupHtml } = await openAndConfirmPrecision({ dieValue: 4, rollDamage });

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Thorin',
      'lastAttackRoll',
      expect.objectContaining({ bonus: 9, total: 17, hit: true, isCrit: false }),
      mockCampaignName
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'lastAttack',
      expect.objectContaining({ total: 17, hit: true, isCrit: false }),
      mockCampaignName
    );
    expect(rollDamage).toHaveBeenCalledWith({
      name: 'Longsword',
      formula: '2d6+3',
      total: 10,
      rolls: [4, 3],
      modifier: 3,
      context: expect.objectContaining({
        damageType: 'Slashing',
        targetName: 'Orc',
        attackerName: 'Thorin',
      }),
    });
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Thorin',
      'pendingCombatSuperiorityPrompt',
      null,
      mockCampaignName
    );
    expect(onPopupHtml).not.toHaveBeenCalled();
  });

  it('shows a popup instead of rolling damage when rollDamage is not provided', async () => {
    const { onPopupHtml } = await openAndConfirmPrecision({ dieValue: 4 });

    expect(onPopupHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'automation_info',
        name: 'Precision Attack',
        description: 'Precision Attack: Added 4 to the attack roll (8 + 5 + 4 = 17). The attack now hits!',
      })
    );
    expect(setRuntimeValue).not.toHaveBeenCalledWith(
      'Thorin',
      'pendingCombatSuperiorityPrompt',
      null,
      mockCampaignName
    );
  });

  it('counts newTotal equal to targetAc as a hit', async () => {
    const rollDamage = vi.fn();
    await openAndConfirmPrecision({ roll: lastAttackRoll({ d20: 15, bonus: 1, targetAc: 20 }), dieValue: 4, rollDamage });

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Thorin',
      'lastAttackRoll',
      expect.objectContaining({ hit: true, total: 20 }),
      mockCampaignName
    );
    expect(rollDamage).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['prior critical flag', lastAttackRoll({ d20: 18, targetAc: 16, isCrit: true })],
    ['natural 20 without the flag', lastAttackRoll({ d20: 20, bonus: 5, targetAc: 27 })],
  ])('preserves crit from %s', async (_label, roll) => {
    await openAndConfirmPrecision({ roll, dieValue: 2 });

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Thorin',
      'lastAttackRoll',
      expect.objectContaining({ isCrit: true }),
      mockCampaignName
    );
  });

  it('still misses: records hit:false, popups the miss, no damage roll, prompt kept', async () => {
    const rollDamage = vi.fn();
    const { onPopupHtml } = await openAndConfirmPrecision({
      roll: lastAttackRoll({ d20: 8, bonus: 2, targetAc: 18 }),
      dieValue: 3,
      rollDamage,
    });

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Thorin',
      'lastAttackRoll',
      expect.objectContaining({ hit: false, total: 13 }),
      mockCampaignName
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'lastAttack',
      expect.objectContaining({ hit: false, total: 13 }),
      mockCampaignName
    );
    expect(onPopupHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'automation_info',
        name: 'Precision Attack',
        description: 'Precision Attack: Added 3 to the attack roll (8 + 2 + 3 = 13). The attack still misses.',
      })
    );
    expect(rollDamage).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalledWith(
      'Thorin',
      'pendingCombatSuperiorityPrompt',
      null,
      mockCampaignName
    );
  });

  it('defaults an undefined bonus to 0', async () => {
    await openAndConfirmPrecision({ roll: lastAttackRoll({ bonus: undefined }) });

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Thorin',
      'lastAttackRoll',
      expect.objectContaining({ bonus: 4, total: 12 }),
      mockCampaignName
    );
  });

  it.each([
    ['missing d20', lastAttackRoll({ d20: null }), lastAttack],
    ['missing targetAc', lastAttackRoll({ targetAc: null }), lastAttack],
    ['lastAttack without damageFormula', lastAttackRoll(), { damageFormula: null }],
  ])('skips the precision rewrite when %s', async (_label, roll, attack) => {
    await openAndConfirmPrecision({ roll, attack });

    expect(lastAttackRollWrites()).toHaveLength(0);
    expect(addEntry).not.toHaveBeenCalledWith(
      mockCampaignName,
      expect.objectContaining({ abilityName: 'Precision Attack' })
    );
  });

  it('logs the ability_use entry with full description for the confirmed character', async () => {
    await openAndConfirmPrecision({
      roll: lastAttackRoll({ d20: 8, bonus: 2, targetAc: 18 }),
      dieValue: 3,
      playerStats: { name: 'Grimjaw', level: 7 },
    });

    expect(addEntry).toHaveBeenCalledWith(
      mockCampaignName,
      {
        type: 'ability_use',
        characterName: 'Grimjaw',
        abilityName: 'Precision Attack',
        description: 'Precision Attack: Added 3 to the attack roll (8 + 2 + 3 = 13). The attack still misses.',
      }
    );
  });
});
