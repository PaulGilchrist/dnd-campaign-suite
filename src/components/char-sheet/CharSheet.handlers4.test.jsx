// @maintained-by-ai 2026-11-27
// Sheet-side handler lane for CharSheet.handlers: puncture damage/flag flow
// (incl. the fix#345 signed-delta arms and the settleRerollDelta damageTypes
// fallback legs), Savage Attacker click + choice math (incl. FT-069 rider
// delta and the choice-side damageTypes legs #1933 handed off here), Tactical
// Mind CLA-352 spend/refusal tiers (success-flag AND natural-20 gates),
// Dark One's Luck zero-uses guard, superiority maneuver guard + popup copy,
// and Psi-Bolstered Knack eligibility.
//
// Swept 2026-11-27 (26 → 27 it-blocks, 28 → 32 cases: −1 block from the
// higher-arm fold, +2 it.each blocks closing the named handoff legs):
//   - Puncture "higher-arm" folded into the main lane test (same >0 branch;
//     it now additionally pins applyHealingToTarget untouched).
//   - ADDED the #1933 handoff legs: damageTypes absent (fallback fires,
//     reading popupHtml.damageType — contradicted fixture vs the baked
//     defaults) and damageTypes: [] (the upstream builder's
//     `damageType ? [damageType] : []` leg, DiceRollResult.handlers.js:103/
//     149/213/233 — truthy, so `damageTypes ||` does NOT fall back and []
//     dispatches verbatim). One it.each per consumer branch
//     (settleRerollDelta:268 via puncture, handleSavageAttackerChoice:389).
//   - ADDED the natural-20 refusal arm of Tactical Mind's fail-gate
//     (handlers.js:450 `success === true || d20 === 20` — second leg was
//     unexercised; refusal tier is this lane's ownership per featureRiders).
//   - Log/popup pins upgraded from toContain fragments to byte-exact
//     full-shape toEqual (#1966); combatSummary pins upgraded from
//     expect.anything() to reference identity (#1890) proving the
//     getCombatContext result flows to apply*/heal uncloned.
//   Earlier history: Dark One's Luck positive path + superiority die-spend/
//   log/initiative-tracker lanes live in CharSheet.featureRiders.test.jsx
//   (store write, tracker rewrite, persistence, initiative-rolled event);
//   only the guards, popup copy, and refusal tiers stay here.

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
// Mocks — services (shared across all handler tests). Every key below is a
// module-level import of CharSheet.handlers.js itself (lines 1-12); the real
// psiBolsteredKnack.js + boonOfCombatProwess.js ride unmocked (pure logic).
// ---------------------------------------------------------------------------

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn().mockReturnValue(null),
}));

// fix#345: LOWER-reroll refunds route through the canonical heal choke point
// (applyHealing.js:8, synchronous, resolves { actualHeal, oldHp, newHp, maxHp }).
vi.mock('../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn().mockReturnValue({ actualHeal: 0, oldHp: 10, newHp: 10, maxHp: 20 }),
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

const punctureOptions = (characters) => ({
  campaignName: mockCampaignName,
  characters,
  ignoreResistance: false,
  attackerName: 'Test Character',
});

// ---------------------------------------------------------------------------
// Tests — handlePuncture
// ---------------------------------------------------------------------------

describe('handlePuncture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies damage delta, stamps piercerPunctureUsedThisTurn, logs byte-exact, rewrites the popup, and never touches the heal lane', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    const { getCombatContext } = await import('../../services/rules/combat/damageUtils.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { applyHealingToTarget } = await import('../../services/rules/combat/applyHealing.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    getRuntimeValue.mockReturnValue(null);
    const cs = { creatures: [] };
    getCombatContext.mockResolvedValue(cs);
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

    // Delta = newRolls 15 + modifier -1 − rawDamage 10 = +4. combatSummary
    // pinned by REFERENCE (#1890): the getCombatContext object flows through
    // settleRerollDelta to the damage lane uncloned.
    expect(applyDamageToTarget).toHaveBeenCalledWith(cs, 'Zombie 1', 4, ['Piercing'], punctureOptions([]));
    expect(applyHealingToTarget).not.toHaveBeenCalled();
    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'piercerPunctureUsedThisTurn', true, mockCampaignName);
    expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
      type: 'ability_use',
      characterName: 'Test Character',
      abilityName: 'Piercer - Puncture',
      description: 'Test Character used Piercer - Puncture: rerolled die 3 from 1 → 5 (5, 5, 1 → 5, 5, 5).',
      timestamp: expect.any(Number),
    });
    expect(setPopupHtml).toHaveBeenCalledWith({
      modifier: -1,
      damageType: 'Piercing',
      total: 14,
      adjustedTotal: 14,
      rolls: [5, 5, 5],
      finalDamage: 14,
    });
    expect(result.newDice).toEqual([5, 5, 5]);
  });

  it('fix#345 LOWER-reroll arm: a negative delta refunds |delta| through the HEAL lane, never the damage lane (which loud-refuses negatives, applyDamage.js:985 fix#143)', async () => {
    const { getRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    const { getCombatContext } = await import('../../services/rules/combat/damageUtils.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { applyHealingToTarget } = await import('../../services/rules/combat/applyHealing.js');

    getRuntimeValue.mockReturnValue(null);
    const cs = { creatures: [{ name: 'Zombie 1' }] };
    getCombatContext.mockResolvedValue(cs);
    applyHealingToTarget.mockReturnValue({ actualHeal: 3, oldHp: 12, newHp: 15, maxHp: 20 });

    // newRolls 9 + modifier 0 − rawDamage 12 = -3 (reroll LOWERED the total).
    const punctureData = {
      rawDamage: 12,
      targetName: 'Zombie 1',
      damageTypes: ['Piercing'],
      originalRolls: [6, 6],
      newRolls: [4, 5],
      rerolledIndex: 0,
      originalValue: 6,
      newValue: 4,
    };

    await handlePuncture({ playerStats: mockPlayerStats, campaignName: mockCampaignName, characters: [], popupHtml: { modifier: 0, damageType: 'Piercing' }, setPopupHtml: vi.fn(), punctureData });

    // pre-fix dispatched -3 here — must never see a negative:
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    // refund lands once, positive, through the canonical heal choke point,
    // combatSummary by reference identity (#1890):
    expect(applyHealingToTarget).toHaveBeenCalledTimes(1);
    expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Zombie 1', 3, mockCampaignName);
  });

  it('fix#345 zero-arm: an equal-totals reroll is a verbatim no-op on BOTH lanes (fix#143 zero-preserved contract)', async () => {
    const { getRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    const { getCombatContext } = await import('../../services/rules/combat/damageUtils.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { applyHealingToTarget } = await import('../../services/rules/combat/applyHealing.js');

    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({ creatures: [{ name: 'Zombie 1' }] });

    // newRolls 12 + modifier 0 − rawDamage 12 = 0 (reroll swapped equal dice).
    const punctureData = {
      rawDamage: 12,
      targetName: 'Zombie 1',
      damageTypes: ['Piercing'],
      originalRolls: [6, 6],
      newRolls: [6, 6],
      rerolledIndex: 0,
      originalValue: 6,
      newValue: 6,
    };

    await handlePuncture({ playerStats: mockPlayerStats, campaignName: mockCampaignName, characters: [], popupHtml: { modifier: 0, damageType: 'Piercing' }, setPopupHtml: vi.fn(), punctureData });

    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(applyHealingToTarget).not.toHaveBeenCalled();
  });

  // #1933 handoff: the upstream payload builder emits
  // `damageTypes: damageType ? [damageType] : []` (DiceRollResult.handlers.js:103),
  // so the consumer's `damageTypes || [popupHtml?.damageType || 'Piercing']`
  // (CharSheet.handlers.js:268) sees either a non-empty array (pinned above),
  // an ABSENT value (fallback must fire and read popupHtml.damageType —
  // contradicted fixture 'Cold' vs the baked 'Piercing' default), or [] which
  // is TRUTHY: no fallback, [] dispatches verbatim. A `?.length` "fix" mutates
  // arm 2 and must fail here, not in silent resistance math.
  it.each([
    { label: 'omitted damageTypes fall back to popupHtml.damageType', damageTypes: undefined, expected: ['Cold'] },
    { label: 'empty damageTypes array dispatches verbatim (truthy, no fallback)', damageTypes: [], expected: [] },
  ])('settleRerollDelta damageTypes leg: $label', async ({ damageTypes, expected }) => {
    const { getRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    const { getCombatContext } = await import('../../services/rules/combat/damageUtils.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');

    getRuntimeValue.mockReturnValue(null);
    const cs = { creatures: [{ name: 'Zombie 1' }] };
    getCombatContext.mockResolvedValue(cs);
    applyDamageToTarget.mockReturnValue({});

    // newRolls 13 + modifier 0 − rawDamage 10 = +3 (positive delta reaches
    // the damage dispatch where the types argument is chosen).
    await handlePuncture({ playerStats: mockPlayerStats, campaignName: mockCampaignName, characters: [], popupHtml: { modifier: 0, damageType: 'Cold' }, setPopupHtml: vi.fn(), punctureData: {
      rawDamage: 10,
      targetName: 'Zombie 1',
      damageTypes,
      originalRolls: [4, 6],
      newRolls: [7, 6],
      rerolledIndex: 0,
      originalValue: 4,
      newValue: 7,
    } });

    expect(applyDamageToTarget).toHaveBeenCalledWith(cs, 'Zombie 1', 3, expected, punctureOptions([]));
  });

  it('gates a second same-turn puncture after the flag is written', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
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

    await handlePuncture({ playerStats: mockPlayerStats, campaignName: mockCampaignName, characters: [], popupHtml: { modifier: -1 }, setPopupHtml: vi.fn(), punctureData });

    getRuntimeValue.mockReturnValue(true);
    applyDamageToTarget.mockClear();
    addEntry.mockClear();

    const second = await handlePuncture({ playerStats: mockPlayerStats, campaignName: mockCampaignName, characters: [], popupHtml: { modifier: -1 }, setPopupHtml: vi.fn(), punctureData });
    expect(second).toBeNull();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    // Flag write stays at exactly one (the first use) — the gated call re-stamps nothing.
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
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

  it('reroll click stamps used flag, logs byte-exact, and defers damage to the player choice', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { addEntry } = await import('../../services/ui/logService.js');

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

    expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
      type: 'ability_use',
      characterName: 'Test Character',
      abilityName: 'Savage Attacker',
      description: 'Test Character used Savage Attacker against Orc: rolled 4, 6 (10) then rerolled 6, 6 (12). Awaiting choice of which total to keep.',
      timestamp: expect.any(Number),
    });

    // bare toDefined cut (#245 sharpen): full-shape result pins the real
    // outcome — a dropped or miscounted field throws here.
    expect(result).toEqual({
      original: '4, 6',
      rerolled: '6, 6',
      originalTotal: 10,
      newTotal: 12,
      better: true,
      awaitingChoice: true,
    });
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
    // equal totals: newTotal > originalTotal is false → better AND awaitingChoice false.
    expect(result).toEqual({
      original: '4, 6',
      rerolled: '4, 6',
      originalTotal: 10,
      newTotal: 10,
      better: false,
      awaitingChoice: false,
    });
    expect(addEntry.mock.calls[0][1].description).toBe(
      'Test Character used Savage Attacker against Orc: rolled 4, 6 (10) then rerolled 4, 6 (10) — kept original total 10.'
    );
  });

  it('gates a second same-turn savage attacker after the flag is written', async () => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
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
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('keep-reroll choice applies only a positive damage difference', async () => {
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { getCombatContext } = await import('../../services/rules/combat/damageUtils.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    const cs = { creatures: [] };
    getCombatContext.mockResolvedValue(cs);
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
        rawDamage: 10,
        modifier: 0,
        targetName: 'Orc',
        damageTypes: ['Slashing'],
      }
    });

    // cs by reference identity (#1890): the getCombatContext result flows uncloned.
    expect(applyDamageToTarget).toHaveBeenCalledWith(cs, 'Orc', 2, ['Slashing'], punctureOptions([]));
    expect(setPopupHtml).toHaveBeenCalledWith({
      modifier: 0,
      damageType: 'Slashing',
      finalDamage: 12,
      targetCurrentHp: 20,
      total: 12,
      adjustedTotal: 12,
      rolls: [6, 6],
    });
    expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
      type: 'ability_use',
      characterName: 'Test Character',
      abilityName: 'Savage Attacker',
      description: 'Test Character kept Savage Attacker reroll total 12 over original 10 (+2 damage to Orc).',
      timestamp: expect.any(Number),
    });
    expect(result).toEqual({ kept: 'reroll', damageDifference: 2 });
  });

  // #1933 handoff (re-aimed): the once-per-turn CLICK handler destructures
  // only targetName/originalRolls/newRolls (CharSheet.handlers.js:329) and
  // ignores damageTypes entirely — a fixture variant on the click tests would
  // pin nothing. The damageTypes branch lives in the CHOICE dispatch
  // (CharSheet.handlers.js:389), mirrored here from the puncture it.each:
  // absent → read popupHtml.damageType (contradicted vs the baked 'Slashing'
  // default); [] (the upstream `damageType ? [damageType] : []` leg) → truthy,
  // dispatched verbatim with no fallback.
  it.each([
    { label: 'omitted damageTypes fall back to popupHtml.damageType', damageTypes: undefined, expected: ['Piercing'] },
    { label: 'empty damageTypes array dispatches verbatim (truthy, no fallback)', damageTypes: [], expected: [] },
  ])('keep-reroll damageTypes leg: $label', async ({ damageTypes, expected }) => {
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { getCombatContext } = await import('../../services/rules/combat/damageUtils.js');

    const cs = { creatures: [{ name: 'Orc' }] };
    getCombatContext.mockResolvedValue(cs);
    applyDamageToTarget.mockReturnValue({});

    await handleSavageAttackerChoice({
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      characters: [],
      popupHtml: { modifier: 0, damageType: 'Piercing', finalDamage: 10, targetCurrentHp: 22 },
      setPopupHtml: vi.fn(),
      choiceData: {
        keep: 'reroll',
        originalRolls: [4, 6],
        newRolls: [6, 6],
        rawDamage: 10,
        modifier: 0,
        targetName: 'Orc',
        damageTypes,
      }
    });

    expect(applyDamageToTarget).toHaveBeenCalledWith(cs, 'Orc', 2, expected, punctureOptions([]));
  });

  // FT-069: rawDamage carries the rider-inflated adjustedTotal (d10 2 +
  // flat mod 2 + Heavy Weapon Mastery 6 = 10, already applied as -10).
  // Keeping reroll 8 must pay the dice-vs-dice delta of +6 — a mutation to
  // `newTotal + modifier - rawDamage` (= 0 here) fails every pin below.
  it('keep-reroll pays dice-vs-dice delta when rawDamage includes mastery riders', async () => {
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { getCombatContext } = await import('../../services/rules/combat/damageUtils.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    const cs = { creatures: [] };
    getCombatContext.mockResolvedValue(cs);
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
        rawDamage: 10,
        modifier: 2,
        targetName: 'Bandit 1',
        damageTypes: ['Slashing'],
      }
    });

    expect(applyDamageToTarget).toHaveBeenCalledWith(cs, 'Bandit 1', 6, ['Slashing'], punctureOptions([]));
    expect(setPopupHtml).toHaveBeenCalledWith({
      modifier: 2,
      damageType: 'Slashing',
      finalDamage: 16,
      targetCurrentHp: 9,
      total: 16,
      adjustedTotal: 16,
      rolls: [8],
    });
    expect(addEntry.mock.calls[0][1].description).toBe(
      'Test Character kept Savage Attacker reroll total 8 over original 2 (+6 damage to Bandit 1).'
    );
    expect(result).toEqual({ kept: 'reroll', damageDifference: 6 });
  });

  it('keep-original choice never touches target hp, damage, combat context, or the popup', async () => {
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const { getCombatContext } = await import('../../services/rules/combat/damageUtils.js');
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
        rawDamage: 10,
        modifier: 0,
        targetName: 'Orc',
        damageTypes: ['Slashing'],
      }
    });

    // Zero-silence: the refusing branch short-circuits before even loading
    // the combat summary.
    expect(getCombatContext).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
      type: 'ability_use',
      characterName: 'Test Character',
      abilityName: 'Savage Attacker',
      description: 'Test Character kept original Savage Attacker total 10 (reroll was 3). No damage change.',
      timestamp: expect.any(Number),
    });
    expect(result).toEqual({ kept: 'original', damageDifference: 0 });
  });

  it('a lower-reroll keep-reroll request can never heal (negative diff refused)', async () => {
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
        keep: 'reroll',
        originalRolls: [6],
        newRolls: [2],
        rawDamage: 6,
        modifier: 0,
        targetName: 'Orc',
        damageTypes: ['Slashing'],
      }
    });

    // keep === 'reroll' but newTotal !> originalTotal → whole reroll branch
    // skipped: no damage, no popup rewrite, original-kept result + copy.
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(result).toEqual({ kept: 'original', damageDifference: 0 });
    expect(addEntry.mock.calls[0][1].description).toBe(
      'Test Character kept original Savage Attacker total 6 (reroll was 2). No damage change.'
    );
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
    expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
      type: 'ability_use',
      characterName: 'Test Character',
      abilityName: 'Tactical Mind',
      description: 'Test Character used Tactical Mind: +7 to Athletics Check (d20 15 + 3 = 18 → 25). Check succeeded — Second Wind use expended.',
      d10Roll: 7,
      timestamp: expect.any(Number),
    });
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
    expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
      type: 'ability_use',
      characterName: 'Test Character',
      abilityName: 'Tactical Mind',
      description: 'Test Character used Tactical Mind: +4 to Athletics Check (d20 5 + 3 = 8 → 12). Check still failed — Second Wind use not expended.',
      d10Roll: 4,
      timestamp: expect.any(Number),
    });
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
    expect(setPopupHtml).toHaveBeenCalledWith({
      type: 'automation_info',
      name: 'Tactical Mind',
      description: '<b>Tactical Mind</b><br/>No Second Wind uses remaining.',
    });
    expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
      type: 'ability_use',
      characterName: 'Test Character',
      abilityName: 'Tactical Mind',
      description: 'Test Character attempted Tactical Mind on Athletics Check — refused: No Second Wind uses remaining.',
      timestamp: expect.any(Number),
    });
  });

  // The fail-gate (CharSheet.handlers.js:450) has TWO legs: an explicit
  // success flag OR a natural 20. Uses stay available (3) in both arms so a
  // refusal here proves the gate fires BEFORE the uses check.
  it.each([
    { label: 'the popup records success', popupHtml: { name: 'Athletics Check', rolls: [19], bonus: 3, success: true, tacticalMindDie: 7, tacticalSuccess: true } },
    { label: 'the d20 came up a natural 20', popupHtml: { name: 'Athletics Check', rolls: [20], bonus: 3, tacticalMindDie: 7 } },
  ])('CLA-352: refuses when $label', async ({ popupHtml }) => {
    const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(3);
    const setPopupHtml = vi.fn();

    await handleTacticalMind(mockPlayerStats, mockCampaignName, popupHtml, setPopupHtml);

    const { addEntry } = await import('../../services/ui/logService.js');
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalledWith({
      type: 'automation_info',
      name: 'Tactical Mind',
      description: '<b>Tactical Mind</b><br/>Tactical Mind can only be used when the ability check fails.',
    });
    expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
      type: 'ability_use',
      characterName: 'Test Character',
      abilityName: 'Tactical Mind',
      description: 'Test Character attempted Tactical Mind on Athletics Check — refused: Tactical Mind can only be used when the ability check fails.',
      timestamp: expect.any(Number),
    });
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

    // Guard fires before the dice check: not-found returns before any
    // resource lookup, write, popup, or log.
    expect(getSuperiorityDice).not.toHaveBeenCalled();
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

    // Die size 8 comes from the mocked evaluateAutoExpression (the maneuver
    // fixture carries no dieExpression → the 'superiority_die' default is
    // requested). dieValue 8 + (d20 15 + bonus 3) = 18 → 26.
    expect(setPopupHtml).toHaveBeenCalledWith({
      type: 'automation_info',
      name: 'Pushing Attack',
      description: '<b>Pushing Attack</b><br/>Rolled d8 for 8.<br/>Athletics Check: 18 → <b>26</b> (+8)',
    });
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
  const ineligiblePopupDescription = '<b>Psi-Bolstered Knack</b><br/>Psi-Bolstered Knack only applies when you fail a proficient skill or tool check.';

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
    // #1348: energy>0 success keeps the 'expended' wording intact.
    expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
      type: 'ability_use',
      characterName: 'Test Character',
      abilityName: 'Psi-Bolstered Knack',
      description: '<b>Psi-Bolstered Knack</b><br/>Rolled d8 for 5.<br/>Athletics: 8 → <b>13</b> (+5) — Succeeded, energy expended',
      timestamp: expect.any(Number),
    });
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
    expect(addEntry.mock.calls[0][1].description).toBe(
      '<b>Psi-Bolstered Knack</b><br/>Rolled d8 for 5.<br/>Athletics: 8 → <b>13</b> (+5) — Still failed, energy not expended'
    );
  });

  it('does not decrement at zero energy and logs honest zero-energy wording (fix#537: never claims expenditure that did not happen)', async () => {
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
    const desc = addEntry.mock.calls[0][1].description;
    expect(desc).toBe(
      '<b>Psi-Bolstered Knack</b><br/>Rolled d8 for 5.<br/>Athletics: 8 → <b>13</b> (+5) — Succeeded, no Psionic Energy remaining to expend'
    );
    expect(desc).not.toContain('expended');
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
    expect(addEntry.mock.calls[0][1].description).toBe(
      "<b>Psi-Bolstered Knack</b><br/>Rolled d10 for 6.<br/>Thieves' Tools: 7 → <b>13</b> (+6) — Succeeded, energy expended"
    );
  });

  it.each([
    { label: 'a non-proficient skill check', popupName: 'Arcana', popupHtml: { name: 'Arcana', rollType: 'skill', rolls: [3], bonus: 0 } },
    { label: 'a raw ability check', popupName: 'Intelligence', popupHtml: { name: 'Intelligence', rollType: 'check', rolls: [8], bonus: -1 } },
  ])('refuses $label without spending energy', async ({ popupName, popupHtml }) => {
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
    expect(setPopupHtml).toHaveBeenCalledWith({
      type: 'automation_info',
      name: 'Psi-Bolstered Knack',
      description: ineligiblePopupDescription,
    });
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
      type: 'ability_use',
      characterName: 'Test Character',
      abilityName: 'Psi-Bolstered Knack',
      description: `Test Character attempted Psi-Bolstered Knack on ${popupName} — refused: Psi-Bolstered Knack only applies when you fail a proficient skill or tool check.`,
      timestamp: expect.any(Number),
    });
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

    // Proficient skill + success:true → the success leg of the eligibility
    // gate (handlers.js:604), distinct from the proficiency leg above.
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalledWith({
      type: 'automation_info',
      name: 'Psi-Bolstered Knack',
      description: ineligiblePopupDescription,
    });
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry.mock.calls[0][1].description).toBe(
      'Test Character attempted Psi-Bolstered Knack on Athletics — refused: Psi-Bolstered Knack only applies when you fail a proficient skill or tool check.'
    );
  });
});
