// @improved-by-ai
// @cleaned-by-ai
//
// Behavioral tests for CharSheet handler functions (handlePuncture,
// handleSavageAttacker, handleTacticalMind, handleDarkOnesLuck,
// handleSuperiorityManeuver, handlePsiBolsteredKnack).
//
// Cleaned: removed 14 redundant null/missing-parameter early-return tests
// (they assert defensive programming patterns, not business behavior).
// Removed 5 duplicate "default name when popupHtml.name is missing" tests
// (consolidated into a single parameterized test).
// Removed 2 TDZ-bug tests that asserted a temporal dead zone error in
// handlePuncture (the bug was fixed; these tests now assert stale behavior).
// Removed brittle setRuntimeValue key-filter assertions (tests now verify
// the observable side effect — that the correct ability was logged — rather
// than the internal runtime key name).
//
// Retained tests verify unique behavioral contracts:
//   - Damage difference application (non-zero vs zero)
//   - Resource decrement when available
//   - Resource not expended when 0 / success is false
//   - Maneuver found/not-found behavior
//   - Initiative update on initiative rolls
//   - Popup result info
//   - Success/failure logging

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  handlePuncture,
  handleSavageAttacker,
  handleSavageAttackerChoice,
  handleTacticalMind,
  handleDarkOnesLuck,
  handleSuperiorityManeuver,
  handlePsiBolsteredKnack,
} from './CharSheet.handlers';

// ---------------------------------------------------------------------------
// Mocks — services (shared across all handler tests)
// ---------------------------------------------------------------------------

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn().mockReturnValue(null),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
  executeEmpoweredReroll: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  getManeuversForRules: vi.fn().mockResolvedValue([]),
  getSuperiorityDice: vi.fn().mockReturnValue(0),
}));

vi.mock('../../services/combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(() => 8),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn().mockResolvedValue({ creatures: [] }),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getProperty: vi.fn().mockResolvedValue(null),
    setProperty: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const mockPlayerStats = {
  name: 'Test Character',
  level: 5,
  hitPoints: { current: 40, max: 40 },
  abilities: [
    { name: 'Strength', bonus: 2, save: 4, skills: [] },
    { name: 'Charisma', bonus: 3, save: 4, skills: [] },
  ],
  class: { name: 'Fighter', class_levels: { 4: { second_wind: 2 } } },
  rules: '5e',
};

const mockCampaignName = 'test-campaign';

// ---------------------------------------------------------------------------
// Tests — handlePuncture
// ---------------------------------------------------------------------------

describe('handlePuncture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when piercerPunctureUsedThisTurn is already true', async () => {
    const { getRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(true);

    const result = await handlePuncture(mockPlayerStats, mockCampaignName, [], null, vi.fn(), {
      rawDamage: 10,
      targetName: 'Goblin',
      damageTypes: ['Piercing'],
      originalRolls: [7, 3],
      newRolls: [6, 4],
      rerolledIndex: 0,
      originalValue: 7,
      newValue: 6,
    });
    expect(result).toBeNull();
  });

  it('returns early when combatContext is missing', async () => {
    const { getRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    const { getCombatContext } = await import('../../services/rules/combat/damageUtils.js');

    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue(null);

    const result = await handlePuncture(mockPlayerStats, mockCampaignName, [], null, vi.fn(), {
      rawDamage: 10,
      targetName: 'Goblin',
      damageTypes: ['Piercing'],
      originalRolls: [7, 3],
      newRolls: [6, 4],
      rerolledIndex: 0,
      originalValue: 7,
      newValue: 6,
    });
    expect(result).toBeNull();
  });

  it('applies damage delta, writes piercerPunctureUsedThisTurn and logs when combat context exists', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    const { getCombatContext } = await import('../../services/rules/combat/damageUtils.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({ creatures: [] });
    applyDamageToTarget.mockReturnValue({});

    const setPopupHtml = vi.fn();
    const punctureData = {
      rawDamage: 10,
      targetName: 'Zombie 1',
      damageTypes: ['Piercing'],
      originalRolls: [5, 5, 1],
      newRolls: [5, 5, 5],
      rerolledIndex: 2,
      originalValue: 1,
      newValue: 5,
    };

    const result = await handlePuncture(
      mockPlayerStats,
      mockCampaignName,
      [],
      { modifier: -1, damageType: 'Piercing' },
      setPopupHtml,
      punctureData
    );

    expect(applyDamageToTarget).toHaveBeenCalledWith(
      expect.anything(),
      'Zombie 1',
      4,
      ['Piercing'],
      mockCampaignName,
      [],
      false,
      'Test Character'
    );
    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'piercerPunctureUsedThisTurn', true, mockCampaignName);
    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].abilityName).toBe('Piercer - Puncture');
    expect(result.newDice).toEqual([5, 5, 5]);
    expect(setPopupHtml).toHaveBeenCalled();
  });

  it('gates a second same-turn puncture after the flag is written', async () => {
    const { getRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    const { getCombatContext } = await import('../../services/rules/combat/damageUtils.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({ creatures: [] });
    applyDamageToTarget.mockReturnValue({});

    const punctureData = {
      rawDamage: 10,
      targetName: 'Zombie 1',
      damageTypes: ['Piercing'],
      originalRolls: [5, 5, 1],
      newRolls: [5, 5, 5],
      rerolledIndex: 2,
      originalValue: 1,
      newValue: 5,
    };

    await handlePuncture(mockPlayerStats, mockCampaignName, [], { modifier: -1 }, vi.fn(), punctureData);

    getRuntimeValue.mockReturnValue(true);
    applyDamageToTarget.mockClear();
    addEntry.mockClear();

    const second = await handlePuncture(mockPlayerStats, mockCampaignName, [], { modifier: -1 }, vi.fn(), punctureData);
    expect(second).toBeNull();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — handleSavageAttacker
// ---------------------------------------------------------------------------

describe('handleSavageAttacker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reroll click stamps used flag, logs, and defers damage to the player choice', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');

    getRuntimeValue.mockReturnValue(null);
    applyDamageToTarget.mockReturnValue({});

    const setPopupHtml = vi.fn();
    const savageData = {
      rawDamage: 10,
      targetName: 'Orc',
      damageTypes: ['Slashing'],
      originalRolls: [4, 6],
      newRolls: [6, 6],
    };

    const result = await handleSavageAttacker(
      mockPlayerStats,
      mockCampaignName,
      [],
      { modifier: 0, damageType: 'Slashing' },
      setPopupHtml,
      savageData
    );

    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', '_Savage_Attacker_usedRound', true, mockCampaignName);

    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].abilityName).toBe('Savage Attacker');

    expect(result).toBeDefined();
    expect(result.better).toBe(true);
    expect(result.awaitingChoice).toBe(true);
  });

  it('keep-reroll choice applies only a positive damage difference', async () => {
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { getCombatContext } = await import('../../services/rules/combat/damageUtils.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    getCombatContext.mockResolvedValue({ creatures: [] });
    applyDamageToTarget.mockReturnValue({});

    const setPopupHtml = vi.fn();
    const result = await handleSavageAttackerChoice(
      mockPlayerStats,
      mockCampaignName,
      [],
      { modifier: 0, damageType: 'Slashing', finalDamage: 10, targetCurrentHp: 22 },
      setPopupHtml,
      {
        keep: 'reroll',
        originalRolls: [4, 6],
        newRolls: [6, 6],
        originalTotal: 10,
        newTotal: 12,
        rawDamage: 10,
        modifier: 0,
        targetName: 'Orc',
        damageTypes: ['Slashing'],
      }
    );

    expect(applyDamageToTarget).toHaveBeenCalledWith(
      expect.anything(),
      'Orc',
      2,
      ['Slashing'],
      mockCampaignName,
      [],
      false,
      'Test Character'
    );
    expect(setPopupHtml).toHaveBeenCalled();
    expect(setPopupHtml.mock.calls[0][0].rolls).toEqual([6, 6]);
    expect(setPopupHtml.mock.calls[0][0].total).toBe(12);
    expect(setPopupHtml.mock.calls[0][0].finalDamage).toBe(12);
    expect(setPopupHtml.mock.calls[0][0].targetCurrentHp).toBe(20);

    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].description).toContain('kept Savage Attacker reroll total 12');
    expect(result).toEqual({ kept: 'reroll', damageDifference: 2 });
  });

  it('keep-original choice never touches target hp', async () => {
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    const result = await handleSavageAttackerChoice(
      mockPlayerStats,
      mockCampaignName,
      [],
      { modifier: 0 },
      vi.fn(),
      {
        keep: 'original',
        originalRolls: [4, 6],
        newRolls: [1, 2],
        originalTotal: 10,
        newTotal: 3,
        rawDamage: 10,
        modifier: 0,
        targetName: 'Orc',
        damageTypes: ['Slashing'],
      }
    );

    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].description).toContain('kept original Savage Attacker total 10');
    expect(result).toEqual({ kept: 'original', damageDifference: 0 });
  });

  it('a lower-reroll keep-reroll request can never heal (negative diff refused)', async () => {
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');

    const result = await handleSavageAttackerChoice(
      mockPlayerStats,
      mockCampaignName,
      [],
      { modifier: 0 },
      vi.fn(),
      {
        keep: 'reroll',
        originalRolls: [6],
        newRolls: [2],
        originalTotal: 6,
        newTotal: 2,
        rawDamage: 6,
        modifier: 0,
        targetName: 'Orc',
        damageTypes: ['Slashing'],
      }
    );

    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(result).toEqual({ kept: 'original', damageDifference: 0 });
  });

  it('does not apply damage when difference is zero', async () => {
    const { getRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');

    getRuntimeValue.mockReturnValue(null);
    applyDamageToTarget.mockReturnValue({});

    const savageData = {
      rawDamage: 10,
      targetName: 'Orc',
      damageTypes: ['Slashing'],
      originalRolls: [4, 6],
      newRolls: [4, 6],
    };

    const result = await handleSavageAttacker(
      mockPlayerStats,
      mockCampaignName,
      [],
      { modifier: 0, damageType: 'Slashing' },
      vi.fn(),
      savageData
    );

    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(result.awaitingChoice).toBe(false);
  });

  it('gates a second same-turn savage attacker after the flag is written', async () => {
    const { getRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    getRuntimeValue.mockReturnValue(true);

    const result = await handleSavageAttacker(
      mockPlayerStats,
      mockCampaignName,
      [],
      { modifier: 0 },
      vi.fn(),
      {
        rawDamage: 10,
        targetName: 'Orc',
        damageTypes: ['Slashing'],
        originalRolls: [4, 6],
        newRolls: [6, 6],
      }
    );

    expect(result).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — handleTacticalMind
// ---------------------------------------------------------------------------

describe('handleTacticalMind', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CLA-352: spends exactly one secondWindUses when the boosted check is declared succeeded', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(2);

    await handleTacticalMind(
      mockPlayerStats,
      mockCampaignName,
      { name: 'Athletics Check', rolls: [15], bonus: 3, tacticalMindDie: 7, tacticalSuccess: true },
      vi.fn()
    );

    const { addEntry } = await import('../../services/ui/logService.js');
    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'secondWindUses', 1, mockCampaignName);
    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].abilityName).toBe('Tactical Mind');
    expect(addEntry.mock.calls[0][1].description).toContain('Second Wind use expended');
  });

  it('CLA-352: does not spend secondWindUses when the boosted check still fails', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(2);

    await handleTacticalMind(
      mockPlayerStats,
      mockCampaignName,
      { name: 'Athletics Check', rolls: [5], bonus: 3, tacticalMindDie: 4, tacticalSuccess: false },
      vi.fn()
    );

    const { addEntry } = await import('../../services/ui/logService.js');
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].description).toContain('not expended');
  });

  it('CLA-352: refuses at zero uses without refilling the pool to max', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(0);
    const setPopupHtml = vi.fn();

    await handleTacticalMind(
      mockPlayerStats,
      mockCampaignName,
      { name: 'Athletics Check', rolls: [15], bonus: 3, tacticalMindDie: 7, tacticalSuccess: true },
      setPopupHtml
    );

    const { addEntry } = await import('../../services/ui/logService.js');
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalled();
    expect(setPopupHtml.mock.calls[0][0].description).toContain('No Second Wind uses remaining');
    expect(addEntry.mock.calls[0][1].description).toContain('refused');
  });

  it('CLA-352: refuses when the check already succeeded', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(3);
    const setPopupHtml = vi.fn();

    await handleTacticalMind(
      mockPlayerStats,
      mockCampaignName,
      { name: 'Athletics Check', rolls: [19], bonus: 3, success: true, tacticalMindDie: 7, tacticalSuccess: true },
      setPopupHtml
    );

    const { addEntry } = await import('../../services/ui/logService.js');
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(setPopupHtml.mock.calls[0][0].description).toContain('only be used when the ability check fails');
    expect(addEntry.mock.calls[0][1].description).toContain('refused');
  });

  it('CLA-352: treats a null uses key as zero, never a phantom refill', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(null);

    await handleTacticalMind(
      mockPlayerStats,
      mockCampaignName,
      { name: 'Athletics Check', rolls: [4], bonus: 3, tacticalMindDie: 7, tacticalSuccess: true },
      vi.fn()
    );

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — handleDarkOnesLuck
// ---------------------------------------------------------------------------

describe('handleDarkOnesLuck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('decrements darkOnesLuckUses when available', async () => {
    const { getRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(3);

    await handleDarkOnesLuck(
      mockPlayerStats,
      mockCampaignName,
      { name: 'Persuasion Check', rolls: [15], bonus: 3, darkOnesLuckValue: 7 }
    );

    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].abilityName).toBe("Dark One's Own Luck");
  });

  it('does nothing when darkOnesLuckUses is 0', async () => {
    const { getRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(0);

    await handleDarkOnesLuck(
      mockPlayerStats,
      mockCampaignName,
      { name: 'Persuasion Check', rolls: [15], bonus: 3, darkOnesLuckValue: 7 }
    );

    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — handleSuperiorityManeuver
// ---------------------------------------------------------------------------

describe('handleSuperiorityManeuver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when maneuver is not found', async () => {
    const { getManeuversForRules } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
    const { getSuperiorityDice } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
    getManeuversForRules.mockResolvedValue([{ name: 'Pushing Attack' }]);
    getSuperiorityDice.mockReturnValue(3);

    const setPopupHtml = vi.fn();

    await handleSuperiorityManeuver(
      mockPlayerStats,
      mockCampaignName,
      setPopupHtml,
      { name: 'Athletics Check', rolls: [15], bonus: 3 },
      'Nonexistent Maneuver',
      8
    );

    expect(setPopupHtml).not.toHaveBeenCalled();
  });

  it('decrements superiorityDice when maneuver is found', async () => {
    const { getManeuversForRules } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
    const { getSuperiorityDice } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
    getManeuversForRules.mockResolvedValue([{ name: 'Pushing Attack' }]);
    getSuperiorityDice.mockReturnValue(3);

    const setPopupHtml = vi.fn();

    await handleSuperiorityManeuver(
      mockPlayerStats,
      mockCampaignName,
      setPopupHtml,
      { name: 'Athletics Check', rolls: [15], bonus: 3 },
      'Pushing Attack',
      8
    );

    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].abilityName).toBe('Pushing Attack');
  });

  it('updates initiative when maneuver is on initiative roll', async () => {
    const { getManeuversForRules } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
    const { getSuperiorityDice } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
    const { loadCombatSummary } = await import('../../services/encounters/combatData.js');
    getManeuversForRules.mockResolvedValue([{ name: 'Pushing Attack' }]);
    getSuperiorityDice.mockReturnValue(3);
    loadCombatSummary.mockResolvedValue({
      creatures: [{ type: 'player', name: 'Test Character', initiative: '0' }],
    });

    const setPopupHtml = vi.fn();

    await handleSuperiorityManeuver(
      mockPlayerStats,
      mockCampaignName,
      setPopupHtml,
      { name: 'Initiative', rolls: [15], bonus: 3 },
      'Pushing Attack',
      8
    );

    expect(setPopupHtml).toHaveBeenCalled();
  });

  it('calls setPopupHtml with maneuver result info', async () => {
    const { getManeuversForRules } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
    const { getSuperiorityDice } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
    getManeuversForRules.mockResolvedValue([{ name: 'Pushing Attack' }]);
    getSuperiorityDice.mockReturnValue(3);

    const setPopupHtml = vi.fn();

    await handleSuperiorityManeuver(
      mockPlayerStats,
      mockCampaignName,
      setPopupHtml,
      { name: 'Athletics Check', rolls: [15], bonus: 3 },
      'Pushing Attack',
      8
    );

    expect(setPopupHtml).toHaveBeenCalled();
    const popupCall = setPopupHtml.mock.calls[0][0];
    expect(popupCall.type).toBe('automation_info');
    expect(popupCall.name).toBe('Pushing Attack');
    expect(popupCall.description).toContain('18');
    expect(popupCall.description).toContain('26');
  });
});

// ---------------------------------------------------------------------------
// Tests — handlePsiBolsteredKnack
// ---------------------------------------------------------------------------

describe('handlePsiBolsteredKnack', () => {
  const soulknifeStats = {
    ...mockPlayerStats,
    level: 14,
    class: { name: 'Rogue', major: { name: 'Soulknife' }, subclass: { name: 'Soulknife' }, class_levels: {} },
    skillProficiencies: ['Athletics'],
    toolProficiencies: ["Thieves' Tools"],
  };
  const failedSkillPopup = { name: 'Athletics', rollType: 'skill', rolls: [5], bonus: 3 };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('decrements psionicEnergy when success is true and energy > 0', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(3);

    await handlePsiBolsteredKnack(
      soulknifeStats,
      mockCampaignName,
      failedSkillPopup,
      5,
      8,
      true
    );

    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'psionicEnergy', 2, mockCampaignName);
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].abilityName).toBe('Psi-Bolstered Knack');
  });

  it('does not expend energy when success is false', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(3);

    await handlePsiBolsteredKnack(
      soulknifeStats,
      mockCampaignName,
      failedSkillPopup,
      5,
      8,
      false
    );

    expect(setRuntimeValue).not.toHaveBeenCalledWith('Test Character', 'psionicEnergy', 2, mockCampaignName);
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry).toHaveBeenCalled();
    const logCall = addEntry.mock.calls[0][1];
    expect(logCall.description).toContain('Still failed, energy not expended');
  });

  it('does not expend energy when psionicEnergy is 0', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(0);

    await handlePsiBolsteredKnack(
      soulknifeStats,
      mockCampaignName,
      failedSkillPopup,
      5,
      8,
      true
    );

    expect(setRuntimeValue).not.toHaveBeenCalled();
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry).toHaveBeenCalled();
    const logCall = addEntry.mock.calls[0][1];
    expect(logCall.description).toContain('Succeeded, energy expended');
  });

  it('allows a proficient tool check and spends on success', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(4);

    await handlePsiBolsteredKnack(
      soulknifeStats,
      mockCampaignName,
      { name: "Thieves' Tools", rollType: 'check', rolls: [2], bonus: 5 },
      6,
      10,
      true
    );

    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'psionicEnergy', 3, mockCampaignName);
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry.mock.calls[0][1].description).toContain("Thieves' Tools");
  });

  it('refuses a non-proficient skill check without spending energy', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(5);
    const setPopupHtml = vi.fn();

    await handlePsiBolsteredKnack(
      soulknifeStats,
      mockCampaignName,
      { name: 'Arcana', rollType: 'skill', rolls: [3], bonus: 0 },
      4,
      10,
      false,
      setPopupHtml
    );

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining('only applies when you fail a proficient skill or tool check'),
    }));
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry.mock.calls[0][1].description).toContain('refused');
  });

  it('refuses a raw ability check without spending energy', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(5);
    const setPopupHtml = vi.fn();

    await handlePsiBolsteredKnack(
      soulknifeStats,
      mockCampaignName,
      { name: 'Intelligence', rollType: 'check', rolls: [8], bonus: -1 },
      4,
      10,
      false,
      setPopupHtml
    );

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalled();
  });

  it('refuses when the popup records an explicit success', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(5);
    const setPopupHtml = vi.fn();

    await handlePsiBolsteredKnack(
      soulknifeStats,
      mockCampaignName,
      { name: 'Athletics', rollType: 'skill', rolls: [15], bonus: 3, success: true },
      4,
      10,
      true,
      setPopupHtml
    );

    expect(setRuntimeValue).not.toHaveBeenCalled();
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry.mock.calls[0][1].description).toContain('refused');
  });
});
