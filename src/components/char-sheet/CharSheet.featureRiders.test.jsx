// @improved-by-ai
// @cleaned-by-ai
//
// Cleaned: removed 25 redundant tests from 43 total.
// Removed 12 "does nothing when playerStats is null" tests (defensive
// programming assertions covered by CharSheet.handlers4.test.jsx).
// Removed 8 "does nothing when [resource] is 0" edge-case tests
// (redundant with handlers4.test.jsx which tests the same guards via
// simpler getRuntimeValue mock patterns).
// Removed 2 "does nothing when [data] is null" tests (same pattern).
// Removed 2 "does nothing when [flag] already used" tests (duplicate
// guards covered by handlers4).
// Removed 1 "does nothing when no BI die" test (redundant early-return).
//
// Retained 18 tests verify unique behavioral contracts:
//   - Positive execution paths (resource applied, logged, decremented)
//   - Cross-condition paths (raging vs disciplined_survivor vs indomitable)
//   - Default fallback behavior (missing popupHtml.name)
//   - Initiative update on initiative rolls
//   - Popup result info
//   - Energy expenditure on success vs failure

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  handleReroll,
  handleStrokeOfLuck,
  handleBardicInspiration,
  handleBiDefenseCombatSummary,
  handleBardicInspirationOffense,
  handleEmpoweredSpell,
  handlePuncture,
  handleSavageAttacker,
  handleSavageAttackerChoice,
  handleTacticalMind,
  handleDarkOnesLuck,
  handleSuperiorityManeuver,
  handlePsiBolsteredKnack,
} from './CharSheet.handlers';

import {
  createMockStore,
  createMockPlayerStats,
} from './CharSheet.test-utils';

// ---------------------------------------------------------------------------
// Mocks — services
// ---------------------------------------------------------------------------

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn().mockResolvedValue({ creatures: [] }),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue({ creatures: [] }),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn().mockReturnValue({ damageApplied: true }),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
  executeEmpoweredReroll: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  getManeuversForRules: vi.fn().mockResolvedValue([]),
  getSuperiorityDice: vi.fn().mockReturnValue(0),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getProperty: vi.fn().mockResolvedValue(null),
    setProperty: vi.fn().mockResolvedValue(undefined),
  },
}));

// ---------------------------------------------------------------------------
// Mocks — hooks
// ---------------------------------------------------------------------------

const mockStore = createMockStore();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((key, prop, _camp) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((_key, _prop, _val, _camp) => mockStore.set(`${_key}:${_prop}`, _val)),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createPlayerStats = (overrides = {}) => createMockPlayerStats({ name: 'Test Character', ...overrides });

const campaignName = 'test-campaign';

// ---------------------------------------------------------------------------
// Tests — handleReroll
// ---------------------------------------------------------------------------

describe('handleReroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('sets fanaticalFocusUsed to true when condition is raging', () => {
    const stats = createPlayerStats();
    const conditionEffects = { autoRerollCondition: 'raging' };

    handleReroll(stats, campaignName, conditionEffects);

    expect(mockStore.get('Test Character:fanaticalFocusUsed')).toBe(true);
  });

  it('decrements focusPoints when condition is disciplined_survivor and focus > 0', () => {
    const stats = createPlayerStats();
    const conditionEffects = { autoRerollCondition: 'disciplined_survivor' };
    mockStore.set('Test Character:focusPoints', 3);

    handleReroll(stats, campaignName, conditionEffects);

    expect(mockStore.get('Test Character:focusPoints')).toBe(2);
  });

  it('increments indomitableUses for other conditions', () => {
    const stats = createPlayerStats();
    const conditionEffects = { autoRerollCondition: 'indomitable' };

    handleReroll(stats, campaignName, conditionEffects);

    expect(mockStore.get('Test Character:indomitableUses')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — handleStrokeOfLuck
// ---------------------------------------------------------------------------

describe('handleStrokeOfLuck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('CLA-339: stroke of luck use stamps strokeOfLuckUsed only, no boonOfCombatProwessUsed collateral, and logs ability_use', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const stats = createPlayerStats();

    handleStrokeOfLuck(stats, campaignName, { name: 'Shortsword', rolls: [6], bonus: 8, hit: false }, 'strokeOfLuck');

    expect(mockStore.get('Test Character:strokeOfLuckUsed')).toBe(true);
    expect(mockStore.get('Test Character:boonOfCombatProwessUsed')).toBeUndefined();
    expect(addEntry).toHaveBeenCalled();
    const entry = addEntry.mock.calls.at(-1)[1];
    expect(entry.type).toBe('ability_use');
    expect(entry.abilityName).toBe('Stroke of Luck');
    expect(entry.description).toContain('d20 6 → 20');
    expect(entry.description).toContain('total 14 → 28');
  });

  it('CLA-339: boon of combat prowess use stamps boonOfCombatProwessUsed only, not strokeOfLuckUsed', () => {
    const stats = createPlayerStats();

    handleStrokeOfLuck(stats, campaignName, { name: 'Shortsword', rolls: [4], bonus: 8, hit: false }, 'boonOfCombatProwess');

    expect(mockStore.get('Test Character:boonOfCombatProwessUsed')).toEqual(expect.any(Number));
    expect(mockStore.get('Test Character:strokeOfLuckUsed')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests — handleBardicInspiration
// ---------------------------------------------------------------------------

describe('handleBardicInspiration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('logs ability_use and clears BI die when BI die is set', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const stats = createPlayerStats();
    mockStore.set('Test Character:bardicInspirationDie', 'd6');
    mockStore.set('Test Character:bardicInspirationGrantedBy', 'Bard');
    const popupHtml = { name: 'Persuasion Check', rolls: [15], bonus: 3, modifier: 2, dieSize: 'd6' };

    await handleBardicInspiration(stats, campaignName, popupHtml);

    expect(addEntry).toHaveBeenCalled();
    expect(mockStore.get('Test Character:bardicInspirationDie')).toBe(null);
    expect(mockStore.get('Test Character:bardicInspirationGrantedBy')).toBe(null);
  });

  it('uses default checkName when popupHtml.name is missing', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const stats = createPlayerStats();
    mockStore.set('Test Character:bardicInspirationDie', 'd6');
    mockStore.set('Test Character:bardicInspirationGrantedBy', 'Ally');

    await handleBardicInspiration(stats, campaignName, { rolls: [15], bonus: 3, modifier: 0 });

    expect(addEntry).toHaveBeenCalled();
    const entry = addEntry.mock.calls[0][1];
    expect(entry.description).toContain('Ability Check');
  });
});

// ---------------------------------------------------------------------------
// Tests — handleBiDefenseCombatSummary
// ---------------------------------------------------------------------------

describe('handleBiDefenseCombatSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('updates lastAttack with bardic inspiration defense data', async () => {
    mockStore.set('campaign:lastAttack', { hit: true, targetName: 'Enemy' });
    const { loadCombatSummary } = await import('../../services/encounters/combatData.js');
    loadCombatSummary.mockResolvedValue({ creatures: [] });

    const stats = createPlayerStats();
    await handleBiDefenseCombatSummary(stats, campaignName, { dieValue: 4, newAc: 18, willMiss: true });

    const lastAttack = mockStore.get('campaign:lastAttack');
    expect(lastAttack).toHaveProperty('bardicInspirationDefense');
    expect(lastAttack.bardicInspirationDefense.used).toBe(true);
    expect(lastAttack.hit).toBe(false);
  });

});

// ---------------------------------------------------------------------------
// Tests — handleBardicInspirationOffense
// ---------------------------------------------------------------------------

describe('handleBardicInspirationOffense', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('applies damage and logs when biUses > 0 and targetName exists', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    mockStore.set('campaign:lastAttack', { targetName: 'Goblin', damageType: 'Slashing' });
    mockStore.set('Test Character:bardicInspirationUses', { current: 3 });

    const stats = createPlayerStats();
    await handleBardicInspirationOffense(stats, campaignName, [], 4, 'd6');

    expect(applyDamageToTarget).toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalled();
    expect(mockStore.get('Test Character:bardicInspirationUses')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests — handleEmpoweredSpell
// ---------------------------------------------------------------------------

describe('handleEmpoweredSpell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('calls executeEmpoweredReroll and returns result when empoweredSpellChaMod exists', async () => {
    const { executeEmpoweredReroll } = await import('../../services/rules/spells/empoweredSpellService.js');
    executeEmpoweredReroll.mockResolvedValue({ popupState: { result: { rerolledValue: 18 } } });

    const stats = createPlayerStats();
    const popupHtml = { empoweredSpellChaMod: 3 };
    const result = await handleEmpoweredSpell(stats, campaignName, [], popupHtml, {});

    expect(executeEmpoweredReroll).toHaveBeenCalled();
    expect(result).toEqual({ rerolledValue: 18 });
  });

});

// ---------------------------------------------------------------------------
// Tests — handlePuncture
// ---------------------------------------------------------------------------

describe('handlePuncture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('applies damage difference and marks puncture used when valid', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');

    const stats = createPlayerStats();
    const setPopupHtml = vi.fn();
    const popupHtml = { modifier: 3 };
    const punctureData = {
      rawDamage: 8,
      targetName: 'Goblin',
      damageTypes: ['Piercing'],
      originalRolls: [5],
      newRolls: [8],
      rerolledIndex: 0,
      originalValue: 5,
      newValue: 8,
    };

    const result = await handlePuncture(stats, campaignName, [], popupHtml, setPopupHtml, punctureData);

    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin', 3, ['Piercing'], campaignName, [], { ignoreResistance: false, attackerName: 'Test Character' });
    expect(mockStore.get('Test Character:piercerPunctureUsedThisTurn')).toBe(true);
    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].abilityName).toBe('Piercer - Puncture');
    expect(result.newDice).toEqual([8]);
    expect(setPopupHtml).toHaveBeenCalled();
  });

  it('does not re-offer puncture on a second same-turn hit once flag is written', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');

    const stats = createPlayerStats();
    const popupHtml = { modifier: 3 };
    const punctureData = {
      rawDamage: 8,
      targetName: 'Goblin',
      damageTypes: ['Piercing'],
      originalRolls: [5],
      newRolls: [8],
      rerolledIndex: 0,
      originalValue: 5,
      newValue: 8,
    };

    await handlePuncture(stats, campaignName, [], popupHtml, vi.fn(), punctureData);
    expect(mockStore.get('Test Character:piercerPunctureUsedThisTurn')).toBe(true);

    applyDamageToTarget.mockClear();
    addEntry.mockClear();

    const second = await handlePuncture(stats, campaignName, [], popupHtml, vi.fn(), punctureData);
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
    mockStore.clear();
  });

  it('marks used and logs without applying damage on reroll click', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');

    const stats = createPlayerStats();
    const setPopupHtml = vi.fn();
    const popupHtml = { modifier: 3 };
    const savageData = {
      rawDamage: 10,
      targetName: 'Goblin',
      damageTypes: ['Slashing'],
      originalRolls: [4, 4],
      newRolls: [6, 6],
    };

    const result = await handleSavageAttacker(stats, campaignName, [], popupHtml, setPopupHtml, savageData);

    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(mockStore.get('Test Character:_Savage_Attacker_usedRound')).toBe(true);
    expect(addEntry).toHaveBeenCalled();
    expect(result.awaitingChoice).toBe(true);
  });

  it('keeps-reroll choice applies the positive difference exactly once', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');

    const stats = createPlayerStats();
    const setPopupHtml = vi.fn();

    await handleSavageAttackerChoice(stats, campaignName, [], { modifier: 3, damageType: 'Slashing' }, setPopupHtml, {
      keep: 'reroll',
      originalRolls: [4, 4],
      newRolls: [6, 6],
      originalTotal: 8,
      newTotal: 12,
      rawDamage: 11,
      modifier: 3,
      targetName: 'Goblin',
      damageTypes: ['Slashing'],
    });

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(4);
    expect(addEntry).toHaveBeenCalled();
  });

  it('keep-original choice writes no damage and logs no change', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');

    const stats = createPlayerStats();
    const setPopupHtml = vi.fn();

    const result = await handleSavageAttackerChoice(stats, campaignName, [], { modifier: 0 }, setPopupHtml, {
      keep: 'original',
      originalRolls: [4, 4],
      newRolls: [6, 6],
      originalTotal: 8,
      newTotal: 12,
      rawDamage: 8,
      modifier: 0,
      targetName: 'Goblin',
      damageTypes: ['Slashing'],
    });

    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(result).toEqual({ kept: 'original', damageDifference: 0 });
    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].description).toContain('kept original');
  });

  it('never applies a negative difference when the reroll is lower', async () => {
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');

    const stats = createPlayerStats();

    const result = await handleSavageAttackerChoice(stats, campaignName, [], { modifier: 0 }, vi.fn(), {
      keep: 'reroll',
      originalRolls: [5],
      newRolls: [2],
      originalTotal: 5,
      newTotal: 2,
      rawDamage: 5,
      modifier: 0,
      targetName: 'Goblin',
      damageTypes: ['Piercing'],
    });

    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(result).toEqual({ kept: 'original', damageDifference: 0 });
  });
});

// ---------------------------------------------------------------------------
// Tests — handleTacticalMind
// ---------------------------------------------------------------------------

describe('handleTacticalMind', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('CLA-352: logs Tactical Mind usage and decrements secondWindUses only on declared success', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    mockStore.set('Test Character:secondWindUses', 2);

    const stats = createPlayerStats({
      level: 5,
      class: { class_levels: [undefined, undefined, undefined, undefined, { second_wind: 2 }] },
    });
    const popupHtml = { name: 'Athletics Check', rolls: [15], bonus: 3, tacticalMindDie: 7, tacticalSuccess: true };

    await handleTacticalMind(stats, campaignName, popupHtml, vi.fn());

    expect(addEntry).toHaveBeenCalled();
    expect(mockStore.get('Test Character:secondWindUses')).toBe(1);
  });

  it('CLA-352: does not spend or refill when the boosted check still fails', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    addEntry.mockClear();
    mockStore.set('Test Character:secondWindUses', 2);

    const stats = createPlayerStats({
      level: 5,
      class: { class_levels: [undefined, undefined, undefined, undefined, { second_wind: 2 }] },
    });
    const popupHtml = { name: 'Check', rolls: [10], bonus: 2, tacticalMindDie: 5, tacticalSuccess: false };

    await handleTacticalMind(stats, campaignName, popupHtml, vi.fn());

    expect(mockStore.get('Test Character:secondWindUses')).toBe(2);
    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].description).toContain('not expended');
  });

  it('CLA-352: refuses at zero uses instead of phantom-refilling to max', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    addEntry.mockClear();
    mockStore.set('Test Character:secondWindUses', 0);

    const stats = createPlayerStats({
      level: 5,
      class: { class_levels: [undefined, undefined, undefined, undefined, { second_wind: 4 }] },
    });
    const popupHtml = { name: 'Check', rolls: [10], bonus: 2, tacticalMindDie: 5, tacticalSuccess: true };
    const setPopupHtml = vi.fn();

    await handleTacticalMind(stats, campaignName, popupHtml, setPopupHtml);

    expect(mockStore.get('Test Character:secondWindUses')).toBe(0);
    expect(setPopupHtml).toHaveBeenCalled();
    expect(setPopupHtml.mock.calls[0][0].description).toContain('No Second Wind uses remaining');
    expect(addEntry).toHaveBeenCalled();
    expect(addEntry.mock.calls[0][1].description).toContain('refused');
  });

});

// ---------------------------------------------------------------------------
// Tests — handleDarkOnesLuck
// ---------------------------------------------------------------------------

describe('handleDarkOnesLuck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('logs Dark One\'s Own Luck and decrements uses when available', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    mockStore.set('Test Character:darkOnesLuckUses', 3);

    const stats = createPlayerStats({
      abilities: [{ name: 'Charisma', bonus: 3 }],
    });
    const popupHtml = { name: 'Persuasion Check', rolls: [12], bonus: 3, darkOnesLuckValue: 7 };

    await handleDarkOnesLuck(stats, campaignName, popupHtml);

    expect(addEntry).toHaveBeenCalled();
    expect(mockStore.get('Test Character:darkOnesLuckUses')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests — handleSuperiorityManeuver
// ---------------------------------------------------------------------------

describe('handleSuperiorityManeuver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('logs maneuver use and decrements superiorityDice when dice available and maneuver found', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const { getManeuversForRules, getSuperiorityDice } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
    getManeuversForRules.mockResolvedValue([{ name: 'Tripping Attack' }]);
    getSuperiorityDice.mockReturnValue(3);

    const stats = createPlayerStats({ rules: '2024' });
    const setPopupHtml = vi.fn();
    const popupHtml = { name: 'Athletics Check', rolls: [15], bonus: 3 };

    await handleSuperiorityManeuver(stats, campaignName, setPopupHtml, popupHtml, 'Tripping Attack', 8);

    expect(mockStore.get('Test Character:superiorityDice')).toBe(2);
    expect(addEntry).toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalled();
  });

  it('updates initiative when maneuver is on initiative roll', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const { loadCombatSummary } = await import('../../services/encounters/combatData.js');
    const { getManeuversForRules, getSuperiorityDice } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
    loadCombatSummary.mockResolvedValue({
      creatures: [{ type: 'player', name: 'Test Character', initiative: '10' }],
    });
    getManeuversForRules.mockResolvedValue([{ name: 'Tripping Attack' }]);
    getSuperiorityDice.mockReturnValue(3);

    const stats = createPlayerStats({ rules: '2024' });
    const setPopupHtml = vi.fn();
    const popupHtml = { name: 'Initiative', rolls: [15], bonus: 3 };

    await handleSuperiorityManeuver(stats, campaignName, setPopupHtml, popupHtml, 'Tripping Attack', 8);

    expect(addEntry).toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalled();
  });

});

// ---------------------------------------------------------------------------
// Tests — handlePsiBolsteredKnack
// ---------------------------------------------------------------------------

describe('handlePsiBolsteredKnack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('logs and expends psionic energy on success', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    addEntry.mockResolvedValue(undefined);
    mockStore.set('Test Character:psionicEnergy', 3);

    const stats = createPlayerStats({ skillProficiencies: ['Arcana'] });
    const popupHtml = { name: 'Arcana', rollType: 'skill', rolls: [4], bonus: 3 };

    await handlePsiBolsteredKnack({ playerStats: stats, campaignName, popupHtml, dieValue: 5, dieSize: 6, success: true });

    expect(mockStore.get('Test Character:psionicEnergy')).toBe(2);
    expect(addEntry).toHaveBeenCalled();
  });

  it('does not expend energy on failure', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    addEntry.mockResolvedValue(undefined);
    mockStore.set('Test Character:psionicEnergy', 3);

    const stats = createPlayerStats({ skillProficiencies: ['Arcana'] });
    const popupHtml = { name: 'Arcana', rollType: 'skill', rolls: [4], bonus: 3 };

    await handlePsiBolsteredKnack({ playerStats: stats, campaignName, popupHtml, dieValue: 5, dieSize: 6, success: false });

    expect(mockStore.get('Test Character:psionicEnergy')).toBe(3);
    expect(addEntry).toHaveBeenCalled();
  });
});
