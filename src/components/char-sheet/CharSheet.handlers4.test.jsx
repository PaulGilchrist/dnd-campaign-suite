// @maintained-by-ai
// Sheet-side handler lane for CharSheet.handlers: puncture damage/flag flow,
// Savage Attacker click + choice math (incl. FT-069 rider delta), Tactical
// Mind CLA-352 spend/refusal tiers, Dark One's Luck zero-uses guard,
// superiority maneuver guards, and Psi-Bolstered Knack eligibility.
//
// Trimmed 2026-10-16 (29 → 23 tests):
//   - Puncture "already used" early-return folded into the gate test (which
//     also proves no damage and no log on the blocked second use).
//   - Tactical Mind "null uses" folded into the zero-uses refusal via it.each.
//   - Psi-Bolstered Knack "raw ability check" refusal folded into the
//     non-proficient refusal via it.each (same ineligible branch).
//   - Dark One's Luck positive path removed — CharSheet.featureRiders.test.jsx
//     owns store decrement + exact log shape; only the zero-uses guard stays.
//   - Superiority decrement/log and initiative-tracker lanes removed —
//     CharSheet.featureRiders.test.jsx asserts the store write, tracker
//     rewrite, persistence and initiative-rolled event strictly; the
//     maneuver-not-found guard and popup content shape stay here.

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

  it('applies damage delta, stamps piercerPunctureUsedThisTurn, and rewrites the popup total', async () => {
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

    const result = await handlePuncture({
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      characters: [],
      popupHtml: { modifier: -1, damageType: 'Piercing' },
      setPopupHtml,
      punctureData
    });

    // Delta = newRolls 15 + modifier -1 − rawDamage 10 = +4.
    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Zombie 1', 4, ['Piercing'], { campaignName: mockCampaignName, characters: [], ignoreResistance: false, attackerName: 'Test Character' });
    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'piercerPunctureUsedThisTurn', true, mockCampaignName);
    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].abilityName).toBe('Piercer - Puncture');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      total: 14,
      adjustedTotal: 14,
      rolls: [5, 5, 5],
      finalDamage: 14,
    }));
    expect(result.newDice).toEqual([5, 5, 5]);
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

    await handlePuncture({ playerStats: mockPlayerStats, campaignName: mockCampaignName, characters: [], popupHtml: { modifier: -1 }, setPopupHtml: vi.fn(), punctureData: punctureData });

    getRuntimeValue.mockReturnValue(true);
    applyDamageToTarget.mockClear();
    addEntry.mockClear();

    const second = await handlePuncture({ playerStats: mockPlayerStats, campaignName: mockCampaignName, characters: [], popupHtml: { modifier: -1 }, setPopupHtml: vi.fn(), punctureData: punctureData });
    expect(second).toBeNull();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('consumes no use and applies no damage when combat context is missing', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    const { getCombatContext } = await import('../../services/rules/combat/damageUtils.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue(null);

    const result = await handlePuncture({ playerStats: mockPlayerStats, campaignName: mockCampaignName, characters: [], popupHtml: null, setPopupHtml: vi.fn(), punctureData: {
      rawDamage: 10,
      targetName: 'Goblin',
      damageTypes: ['Piercing'],
      originalRolls: [7, 3],
      newRolls: [6, 4],
      rerolledIndex: 0,
      originalValue: 7,
      newValue: 6,
    } });

    expect(result).toBeNull();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — handleSavageAttacker (click) + handleSavageAttackerChoice
// ---------------------------------------------------------------------------

describe('handleSavageAttacker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reroll click stamps used flag, logs, and defers damage to the player choice', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');

    getRuntimeValue.mockReturnValue(null);

    const savageData = {
      rawDamage: 10,
      targetName: 'Orc',
      damageTypes: ['Slashing'],
      originalRolls: [4, 6],
      newRolls: [6, 6],
    };

    const result = await handleSavageAttacker({
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      savageData
    });

    // The click alone never moves damage — the sheet waits for the keep choice.
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', '_Savage_Attacker_usedRound', true, mockCampaignName);

    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].abilityName).toBe('Savage Attacker');

    expect(result).toBeDefined();
    expect(result.better).toBe(true);
    expect(result.awaitingChoice).toBe(true);
  });

  it('an equal-totals reroll still consumes the feature but resolves without awaiting a choice', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    getRuntimeValue.mockReturnValue(null);

    const result = await handleSavageAttacker({
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      savageData: {
        rawDamage: 10,
        targetName: 'Orc',
        damageTypes: ['Slashing'],
        originalRolls: [4, 6],
        newRolls: [4, 6],
      }
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', '_Savage_Attacker_usedRound', true, mockCampaignName);
    expect(result.better).toBe(false);
    expect(result.awaitingChoice).toBe(false);
    expect(addEntry.mock.calls[0][1].description).toContain('kept original total 10');
  });

  it('gates a second same-turn savage attacker after the flag is written', async () => {
    const { getRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    getRuntimeValue.mockReturnValue(true);

    const result = await handleSavageAttacker({
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      savageData: {
        rawDamage: 10,
        targetName: 'Orc',
        damageTypes: ['Slashing'],
        originalRolls: [4, 6],
        newRolls: [6, 6],
      }
    });

    expect(result).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('keep-reroll choice applies only a positive damage difference', async () => {
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { getCombatContext } = await import('../../services/rules/combat/damageUtils.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    getCombatContext.mockResolvedValue({ creatures: [] });
    applyDamageToTarget.mockReturnValue({});

    const setPopupHtml = vi.fn();
    const result = await handleSavageAttackerChoice({
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      characters: [],
      popupHtml: { modifier: 0, damageType: 'Slashing', finalDamage: 10, targetCurrentHp: 22 },
      setPopupHtml,
      choiceData: {
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
    });

    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Orc', 2, ['Slashing'], { campaignName: mockCampaignName, characters: [], ignoreResistance: false, attackerName: 'Test Character' });
    expect(setPopupHtml).toHaveBeenCalled();
    expect(setPopupHtml.mock.calls[0][0].rolls).toEqual([6, 6]);
    expect(setPopupHtml.mock.calls[0][0].total).toBe(12);
    expect(setPopupHtml.mock.calls[0][0].finalDamage).toBe(12);
    expect(setPopupHtml.mock.calls[0][0].targetCurrentHp).toBe(20);

    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].description).toContain('kept Savage Attacker reroll total 12');
    expect(result).toEqual({ kept: 'reroll', damageDifference: 2 });
  });

  // FT-069: rawDamage carries the rider-inflated adjustedTotal (d10 2 +
  // flat mod 2 + Heavy Weapon Mastery 6 = 10, already applied as -10).
  // Keeping reroll 8 must pay the dice-vs-dice delta of +6.
  it('keep-reroll pays dice-vs-dice delta when rawDamage includes mastery riders', async () => {
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { getCombatContext } = await import('../../services/rules/combat/damageUtils.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    getCombatContext.mockResolvedValue({ creatures: [] });
    applyDamageToTarget.mockReturnValue({});

    const setPopupHtml = vi.fn();
    const result = await handleSavageAttackerChoice({
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      characters: [],
      popupHtml: { modifier: 2, damageType: 'Slashing', finalDamage: 10, targetCurrentHp: 15 },
      setPopupHtml,
      choiceData: {
        keep: 'reroll',
        originalRolls: [2],
        newRolls: [8],
        originalTotal: 2,
        newTotal: 8,
        rawDamage: 10,
        modifier: 2,
        targetName: 'Bandit 1',
        damageTypes: ['Slashing'],
      }
    });

    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Bandit 1', 6, ['Slashing'], { campaignName: mockCampaignName, characters: [], ignoreResistance: false, attackerName: 'Test Character' });
    expect(setPopupHtml.mock.calls[0][0].total).toBe(16);
    expect(setPopupHtml.mock.calls[0][0].finalDamage).toBe(16);
    expect(setPopupHtml.mock.calls[0][0].targetCurrentHp).toBe(9);

    expect(addEntry.mock.calls[0][1].description).toContain('+6 damage to Bandit 1');
    expect(addEntry.mock.calls[0][1].description).not.toContain('+0 damage');
    expect(result).toEqual({ kept: 'reroll', damageDifference: 6 });
  });

  it('keep-original choice never touches target hp, damage, or the popup', async () => {
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    const setPopupHtml = vi.fn();
    const result = await handleSavageAttackerChoice({
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      characters: [],
      popupHtml: { modifier: 0 },
      setPopupHtml,
      choiceData: {
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
    });

    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].description).toContain('kept original Savage Attacker total 10');
    expect(result).toEqual({ kept: 'original', damageDifference: 0 });
  });

  it('a lower-reroll keep-reroll request can never heal (negative diff refused)', async () => {
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    const result = await handleSavageAttackerChoice({
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      characters: [],
      popupHtml: { modifier: 0 },
      setPopupHtml: vi.fn(),
      choiceData: {
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
    });

    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(result).toEqual({ kept: 'original', damageDifference: 0 });
    expect(addEntry.mock.calls[0][1].description).toContain('kept original Savage Attacker total 6');
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

  it.each([
    { label: 'zero', uses: 0 },
    // A missing (null) uses key must read as zero — never a phantom refill.
    { label: 'missing', uses: null },
  ])('CLA-352: refuses at $label secondWindUses without any write', async ({ uses }) => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(uses);
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
});

// ---------------------------------------------------------------------------
// Tests — handleDarkOnesLuck (positive spend lane lives in featureRiders)
// ---------------------------------------------------------------------------

describe('handleDarkOnesLuck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing at zero uses — no write, no log', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(0);

    await handleDarkOnesLuck(
      mockPlayerStats,
      mockCampaignName,
      { name: 'Persuasion Check', rolls: [15], bonus: 3, darkOnesLuckValue: 7 }
    );

    expect(setRuntimeValue).not.toHaveBeenCalled();
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — handleSuperiorityManeuver guards + popup content
// (die spend, log, and initiative-tracker lanes live in featureRiders)
// ---------------------------------------------------------------------------

describe('handleSuperiorityManeuver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('spends no die and shows no popup when the maneuver is not found', async () => {
    const { setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    const { getManeuversForRules, getSuperiorityDice } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
    getManeuversForRules.mockResolvedValue([{ name: 'Pushing Attack' }]);
    getSuperiorityDice.mockReturnValue(3);

    const setPopupHtml = vi.fn();

    await handleSuperiorityManeuver({
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      setPopupHtml,
      popupHtml: { name: 'Athletics Check', rolls: [15], bonus: 3 },
      maneuverName: 'Nonexistent Maneuver',
      dieValue: 8
    });

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('shows an automation_info popup with the die size and adjusted total', async () => {
    const { getManeuversForRules, getSuperiorityDice } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
    getManeuversForRules.mockResolvedValue([{ name: 'Pushing Attack' }]);
    getSuperiorityDice.mockReturnValue(3);

    const setPopupHtml = vi.fn();

    await handleSuperiorityManeuver({
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      setPopupHtml,
      popupHtml: { name: 'Athletics Check', rolls: [15], bonus: 3 },
      maneuverName: 'Pushing Attack',
      dieValue: 8
    });

    expect(setPopupHtml).toHaveBeenCalled();
    const popupCall = setPopupHtml.mock.calls[0][0];
    expect(popupCall.type).toBe('automation_info');
    expect(popupCall.name).toBe('Pushing Attack');
    // dieValue 8 + (d20 15 + bonus 3) = 18 → 26
    expect(popupCall.description).toContain('Rolled d8 for 8');
    expect(popupCall.description).toContain('Athletics Check: 18 →');
    expect(popupCall.description).toContain('(+8)');
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

    await handlePsiBolsteredKnack({
        playerStats: soulknifeStats,
        campaignName: mockCampaignName,
        popupHtml: failedSkillPopup,
        dieValue: 5,
        dieSize: 8,
        success: true
      });

    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'psionicEnergy', 2, mockCampaignName);
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].abilityName).toBe('Psi-Bolstered Knack');
  });

  it('does not expend energy when success is false', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(3);

    await handlePsiBolsteredKnack({
        playerStats: soulknifeStats,
        campaignName: mockCampaignName,
        popupHtml: failedSkillPopup,
        dieValue: 5,
        dieSize: 8,
        success: false
      });

    expect(setRuntimeValue).not.toHaveBeenCalled();
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry.mock.calls[0][1].description).toContain('Still failed, energy not expended');
  });

  it('writes nothing at zero energy (and logs success verbatim — honest pin of current wording)', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(0);

    await handlePsiBolsteredKnack({
        playerStats: soulknifeStats,
        campaignName: mockCampaignName,
        popupHtml: failedSkillPopup,
        dieValue: 5,
        dieSize: 8,
        success: true
      });

    expect(setRuntimeValue).not.toHaveBeenCalled();
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].description).toContain('Succeeded, energy expended');
  });

  it('allows a proficient tool check and spends on success', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(4);

    await handlePsiBolsteredKnack({
        playerStats: soulknifeStats,
        campaignName: mockCampaignName,
        popupHtml: { name: "Thieves' Tools", rollType: 'check', rolls: [2], bonus: 5 },
        dieValue: 6,
        dieSize: 10,
        success: true
      });

    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'psionicEnergy', 3, mockCampaignName);
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry.mock.calls[0][1].description).toContain("Thieves' Tools");
  });

  it.each([
    { label: 'a non-proficient skill check', popupHtml: { name: 'Arcana', rollType: 'skill', rolls: [3], bonus: 0 } },
    { label: 'a raw ability check', popupHtml: { name: 'Intelligence', rollType: 'check', rolls: [8], bonus: -1 } },
  ])('refuses $label without spending energy', async ({ popupHtml }) => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(5);
    const setPopupHtml = vi.fn();

    await handlePsiBolsteredKnack({
        playerStats: soulknifeStats,
        campaignName: mockCampaignName,
        popupHtml,
        dieValue: 4,
        dieSize: 10,
        success: false,
        setPopupHtml
      });

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining('only applies when you fail a proficient skill or tool check'),
    }));
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry.mock.calls[0][1].description).toContain('refused');
  });

  it('refuses when the popup records an explicit success', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(5);
    const setPopupHtml = vi.fn();

    await handlePsiBolsteredKnack({
        playerStats: soulknifeStats,
        campaignName: mockCampaignName,
        popupHtml: { name: 'Athletics', rollType: 'skill', rolls: [15], bonus: 3, success: true },
        dieValue: 4,
        dieSize: 10,
        success: true,
        setPopupHtml
      });

    expect(setRuntimeValue).not.toHaveBeenCalled();
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry.mock.calls[0][1].description).toContain('refused');
  });
});
