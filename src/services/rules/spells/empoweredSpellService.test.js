// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────

vi.mock('../../../hooks/combat/useMetamagic.js', () => ({
  getMaxSorceryPoints: vi.fn(),
  getCurrentSorceryPoints: vi.fn(),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../automation/common/damageRollback.js', () => ({
  findLastAttack: vi.fn().mockResolvedValue({
    attackEvent: null,
    attackerName: null,
    targetName: null,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
  }),
}));

vi.mock('./metamagicRules.js', () => ({
  getChaModifier: vi.fn(),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  parseExpression: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import {
  buildEmpoweredSpellState,
  executeEmpoweredReroll,
  getEmpoweredSpellDescription,
} from './empoweredSpellService.js';

import {
  getMaxSorceryPoints,
  getCurrentSorceryPoints,
  spendSorceryPoints,
} from '../../../hooks/combat/useMetamagic.js';
import { findLastAttack } from '../../automation/common/damageRollback.js';
import { getChaModifier } from './metamagicRules.js';
import { parseExpression } from '../../dice/diceRoller.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { applyDamageToTarget } from '../combat/applyDamage.js';
import { endInvisibilityOnHostileAction } from '../features/invisibilityService.js';

// ── Helpers ─────────────────────────────────────────────────────

const CAMPAIGN = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Xander',
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

// ── buildEmpoweredSpellState ────────────────────────────────────

describe('buildEmpoweredSpellState', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns base state with error when no last event', async () => {
    const playerStats = makePlayerStats();
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(3);
    findLastAttack.mockResolvedValue({
      attackEvent: null,
      attackerName: null,
      targetName: null,
      primaryDamage: 0,
      secondaryDamage: 0,
      totalDamage: 0,
      damageTypes: [],
    });
    getChaModifier.mockReturnValue(3);

    const result = await buildEmpoweredSpellState(playerStats);

    expect(result).toEqual({
      type: 'empowered_spell',
      name: 'Metamagic - Empowered Spell',
      currentSP: 3,
      maxSP: 5,
      chaMod: 3,
      lastEvent: null,
      error: 'No recent damage event found. Cast a spell that deals damage first.',
    });
  });

  it('includes lastEvent and formulaParsed when damage event exists', async () => {
    const playerStats = makePlayerStats();
    const lastEvent = {
      damageFormula: '3d6+2',
      rolls: [4, 6, 3],
      rawDamage: 15,
      damageType: 'Fire',
      spellName: 'Burning Hands',
      targetName: 'Goblin',
      damageTypes: ['Fire'],
    };
    const parsed = { count: 3, sides: 6, modifier: 2 };
    getMaxSorceryPoints.mockReturnValue(4);
    getCurrentSorceryPoints.mockReturnValue(2);
    findLastAttack.mockResolvedValue({
      attackEvent: lastEvent,
      attackerName: 'Xander',
      targetName: 'Goblin',
      primaryDamage: 15,
      secondaryDamage: 0,
      totalDamage: 15,
      damageTypes: ['Fire'],
    });
    getChaModifier.mockReturnValue(3);
    parseExpression.mockReturnValue(parsed);

    const result = await buildEmpoweredSpellState(playerStats);

    expect(result.type).toBe('empowered_spell');
    expect(result.lastEvent).toBe(lastEvent);
    expect(result.formulaParsed).toEqual(parsed);
    expect(result.currentSP).toBe(2);
    expect(result.maxSP).toBe(4);
    expect(result.chaMod).toBe(3);
  });

  it('caps chaMod to parsed dice count when chaMod exceeds it', async () => {
    const playerStats = makePlayerStats();
    const lastEvent = {
      damageFormula: '3d6+2',
      rolls: [4, 6, 3],
      rawDamage: 15,
      damageType: 'Fire',
      spellName: 'Burning Hands',
      targetName: 'Goblin',
      damageTypes: ['Fire'],
    };
    const parsed = { count: 3, sides: 6, modifier: 2 };
    getMaxSorceryPoints.mockReturnValue(3);
    getCurrentSorceryPoints.mockReturnValue(1);
    findLastAttack.mockResolvedValue({
      attackEvent: lastEvent,
      attackerName: 'Xander',
      targetName: 'Goblin',
      primaryDamage: 15,
      secondaryDamage: 0,
      totalDamage: 15,
      damageTypes: ['Fire'],
    });
    getChaModifier.mockReturnValue(5);
    parseExpression.mockReturnValue(parsed);

    const result = await buildEmpoweredSpellState(playerStats);

    expect(result.chaMod).toBe(3);
  });

  it('returns error when damage formula cannot be parsed', async () => {
    const playerStats = makePlayerStats();
    const lastEvent = { damageFormula: 'invalid', rolls: [1, 2], rawDamage: 3, damageTypes: ['Fire'] };
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(5);
    findLastAttack.mockResolvedValue({
      attackEvent: lastEvent,
      attackerName: 'Xander',
      targetName: 'Goblin',
      primaryDamage: 3,
      secondaryDamage: 0,
      totalDamage: 3,
      damageTypes: ['Fire'],
    });
    getChaModifier.mockReturnValue(2);
    parseExpression.mockReturnValue(null);

    const result = await buildEmpoweredSpellState(playerStats);

    expect(result.type).toBe('empowered_spell');
    expect(result.lastEvent).toBeNull();
    expect(result.error).toBe('Could not parse damage formula');
  });

  it('returns error when lastEvent exists but damageFormula is missing', async () => {
    const playerStats = makePlayerStats();
    const lastEvent = { rolls: [3, 4, 5], rawDamage: 12, damageTypes: ['Fire'] };
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(5);
    findLastAttack.mockResolvedValue({
      attackEvent: lastEvent,
      attackerName: 'Xander',
      targetName: 'Goblin',
      primaryDamage: 12,
      secondaryDamage: 0,
      totalDamage: 12,
      damageTypes: ['Fire'],
    });
    getChaModifier.mockReturnValue(2);

    const result = await buildEmpoweredSpellState(playerStats);

    expect(result.lastEvent).toBeNull();
    expect(result.error).toBe('No dice roll data available');
  });
});

// ── executeEmpoweredReroll ──────────────────────────────────────

describe('executeEmpoweredReroll', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when formula cannot be parsed', async () => {
    parseExpression.mockReturnValue(null);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent: { damageFormula: 'invalid', rolls: [], rawDamage: 0 },
      chaMod: 3,
    });

    expect(result).toBeNull();
  });

  it('returns error popup when no sorcery points available', async () => {
    const parsed = { count: 3, sides: 6, modifier: 2 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(0);
    getMaxSorceryPoints.mockReturnValue(5);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent: {
        damageFormula: '3d6+2',
        rolls: [4, 6, 3],
        rawDamage: 15,
        damageType: 'Fire',
        spellName: 'Burning Hands',
        targetName: 'Goblin',
        damageTypes: ['Fire'],
      },
      chaMod: 3,
    });

    expect(result).toHaveProperty('popupState');
    expect(result.popupState.type).toBe('empowered_spell');
    expect(result.popupState.error).toBe('Not enough sorcery points. Empowered Spell costs 1 SP.');
    expect(result.popupState.currentSP).toBe(0);
    expect(result.popupState.maxSP).toBe(5);
    expect(spendSorceryPoints).not.toHaveBeenCalled();
  });

  it('returns error popup when combat context is unavailable', async () => {
    const parsed = { count: 3, sides: 6, modifier: 2 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(3);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(null);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent: {
        damageFormula: '3d6+2',
        rolls: [4, 6, 3],
        rawDamage: 15,
        damageType: 'Fire',
        spellName: 'Burning Hands',
        targetName: 'Goblin',
        damageTypes: ['Fire'],
      },
      chaMod: 3,
    });

    expect(result).toHaveProperty('popupState');
    expect(result.popupState.error).toBe('No combat summary found. Cannot reapply damage.');
    expect(spendSorceryPoints).not.toHaveBeenCalled();
  });

  it('spends exactly 1 sorcery point and returns updated SP', async () => {
    const parsed = { count: 3, sides: 6, modifier: 0 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(3);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Orc', type: 'npc', currentHp: 20, maxHp: 20, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} },
    ]));
    applyDamageToTarget.mockReturnValue({ newHp: 15, finalDamage: 0 });

    const lastEvent = {
      damageFormula: '3d6',
      rolls: [3, 3, 3],
      rawDamage: 9,
      targetName: 'Orc',
      spellName: 'Firebolt',
    };

    const randomValues = [0.5];
    let randomIndex = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => randomValues[randomIndex++]);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 3,
    });

    expect(spendSorceryPoints).toHaveBeenCalledWith('Xander', 1, CAMPAIGN, 5);
    expect(result.popupState.currentSP).toBe(2);
    expect(result.popupState.maxSP).toBe(5);
    expect(result.popupState.completed).toBe(true);

    vi.restoreAllMocks();
  });

  it('rerolls the lowest dice up to chaMod count', async () => {
    const parsed = { count: 4, sides: 6, modifier: 1 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(2);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 10, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} },
    ]));
    applyDamageToTarget.mockReturnValue({ newHp: 7, finalDamage: 3 });

    const lastEvent = {
      damageFormula: '4d6+1',
      rolls: [5, 2, 4, 1],
      rawDamage: 12,
      damageType: 'Fire',
      spellName: 'Burning Hands',
      targetName: 'Goblin',
    };

    // chaMod=2, so reroll 2 lowest: values 1 and 2 (indices 3 and 1)
    const randomValues = [0.5, 0.5];
    let randomIndex = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => randomValues[randomIndex++]);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 2,
    });

    expect(result.popupState.completed).toBe(true);
    expect(result.popupState.currentSP).toBe(1);
    expect(result.popupState.result.oldTotal).toBe(12);
    expect(result.popupState.result.rerollCount).toBe(2);
    expect(result.popupState.result.originalDice).toEqual([5, 2, 4, 1]);
    expect(result.popupState.result.newDice).toEqual([5, 4, 4, 4]);
    expect(result.logEntries).toHaveLength(1);
    expect(result.logEntries[0].type).toBe('metamagic');
    expect(result.logEntries[0].rollType).toBe('empowered-spell');
    expect(result.logEntries[0].originalDamage).toBe(12);
    expect(result.logEntries[0].rerolledDiceCount).toBe(2);
    expect(result.logEntries[0].originalDice).toEqual([5, 2, 4, 1]);
    expect(result.logEntries[0].newDice).toEqual([5, 4, 4, 4]);

    vi.restoreAllMocks();
  });

  it('handles chaMod of 0 — rerolls 0 dice and reports no change', async () => {
    const parsed = { count: 3, sides: 6, modifier: 0 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(1);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 10, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} },
    ]));
    applyDamageToTarget.mockReturnValue({ newHp: 10, finalDamage: 0 });

    const lastEvent = {
      damageFormula: '3d6',
      rolls: [2, 4, 6],
      rawDamage: 12,
      targetName: 'Goblin',
      spellName: 'Firebolt',
    };

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 0,
    });

    expect(result.popupState.result.rerollCount).toBe(0);
    expect(result.popupState.result.damageDifference).toBe(0);
    expect(result.popupState.result.message).toBe('Reroll did not change the damage total.');
    expect(result.popupState.result.oldTotal).toBe(12);
    expect(result.popupState.result.newTotal).toBe(12);
    expect(spendSorceryPoints).toHaveBeenCalledTimes(1);
  });

  it('calls endInvisibilityOnHostileAction when finalDamage > 0', async () => {
    const parsed = { count: 1, sides: 6, modifier: 0 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(1);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 10, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} },
    ]));
    applyDamageToTarget.mockReturnValue({ newHp: 7, finalDamage: 3 });

    const lastEvent = {
      damageFormula: '1d6',
      rolls: [3],
      rawDamage: 3,
      targetName: 'Goblin',
      spellName: 'Firebolt',
    };

    const randomValues = [0.5];
    let randomIndex = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => randomValues[randomIndex++]);

    await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 1,
    });

    expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('Xander', CAMPAIGN);

    vi.restoreAllMocks();
  });

  it('does not call endInvisibilityOnHostileAction when finalDamage is 0', async () => {
    const parsed = { count: 1, sides: 6, modifier: 0 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(1);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 10, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} },
    ]));
    applyDamageToTarget.mockReturnValue({ newHp: 10, finalDamage: 0 });

    const lastEvent = {
      damageFormula: '1d6',
      rolls: [3],
      rawDamage: 3,
      targetName: 'Goblin',
      spellName: 'Firebolt',
    };

    const randomValues = [0.5];
    let randomIndex = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => randomValues[randomIndex++]);

    await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 1,
    });

    expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

});

// ── getEmpoweredSpellDescription ────────────────────────────────

describe('getEmpoweredSpellDescription', () => {
  const DEFAULT_DESC =
    'When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum of one). You must use the new rolls.';

  it.each([
    {},
    { details: null },
    { details: '' },
    { details: undefined },
    '<li><b>Quickened Spell</b> Cast as bonus action.</li>',
    '<p><b>Empowered Spell</b> Not in li tag.</p>',
    '<li><b>Twinned Spell</b> Target two creatures.</li>',
  ])('returns default description for action=%j', (action) => {
    expect(getEmpoweredSpellDescription(action)).toBe(DEFAULT_DESC);
  });

  it.each([
    [
      '<li><b>Empowered Spell</b>. Reroll damage dice up to CHA mod.</li>',
      'Reroll damage dice up to CHA mod.',
    ],
    [
      '<li><b>Empowered Spell</b> Reroll damage dice up to CHA mod.</li>',
      'Reroll damage dice up to CHA mod.',
    ],
    [
      '<li><b>Empowered Spell</b> Some text\n  with newlines\n  and spaces</li>',
      'Some text\n  with newlines\n  and spaces',
    ],
    [
      '<li><b>empowered spell</b> Lowercase match.</li>',
      'Lowercase match.',
    ],
  ])('extracts description from: %s', (details, expected) => {
    const result = getEmpoweredSpellDescription({ details });
    expect(result).toBe(expected);
  });

});
