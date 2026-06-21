// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────

vi.mock('../../hooks/combat/useMetamagic.js', () => ({
  getMaxSorceryPoints: vi.fn(),
  getCurrentSorceryPoints: vi.fn(),
  getLastDamageEvent: vi.fn(),
  spendSorceryPoints: vi.fn(),
  saveLastDamageEvent: vi.fn(),
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
  getLastDamageEvent,
  spendSorceryPoints,
  saveLastDamageEvent,
} from '../../hooks/combat/useMetamagic.js';
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

function makeLastEvent(extra = {}) {
  return {
    damageFormula: '3d6+2',
    rolls: [4, 6, 3],
    rawDamage: 15,
    damageType: 'Fire',
    spellName: 'Burning Hands',
    targetName: 'Goblin',
    ...extra,
  };
}

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

// ── buildEmpoweredSpellState ────────────────────────────────────

describe('buildEmpoweredSpellState', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns base state with error when no last event', () => {
    const playerStats = makePlayerStats();
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(3);
    getLastDamageEvent.mockReturnValue(null);
    getChaModifier.mockReturnValue(3);

    const result = buildEmpoweredSpellState(playerStats);

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

  it('includes lastEvent and formulaParsed when damage event exists', () => {
    const playerStats = makePlayerStats();
    const lastEvent = makeLastEvent();
    const parsed = { count: 3, sides: 6, modifier: 2 };
    getMaxSorceryPoints.mockReturnValue(4);
    getCurrentSorceryPoints.mockReturnValue(2);
    getLastDamageEvent.mockReturnValue(lastEvent);
    getChaModifier.mockReturnValue(3);
    parseExpression.mockReturnValue(parsed);

    const result = buildEmpoweredSpellState(playerStats);

    expect(result.type).toBe('empowered_spell');
    expect(result.lastEvent).toBe(lastEvent);
    expect(result.formulaParsed).toEqual(parsed);
    expect(result.currentSP).toBe(2);
    expect(result.maxSP).toBe(4);
    expect(result.chaMod).toBe(3);
  });

  it('caps chaMod to parsed dice count when chaMod exceeds it', () => {
    const playerStats = makePlayerStats();
    const lastEvent = makeLastEvent();
    const parsed = { count: 3, sides: 6, modifier: 2 };
    getMaxSorceryPoints.mockReturnValue(3);
    getCurrentSorceryPoints.mockReturnValue(1);
    getLastDamageEvent.mockReturnValue(lastEvent);
    getChaModifier.mockReturnValue(5);
    parseExpression.mockReturnValue(parsed);

    const result = buildEmpoweredSpellState(playerStats);

    expect(result.chaMod).toBe(3);
  });

  it('returns error when damage formula cannot be parsed', () => {
    const playerStats = makePlayerStats();
    const lastEvent = { damageFormula: 'invalid', rolls: [1, 2], rawDamage: 3 };
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(5);
    getLastDamageEvent.mockReturnValue(lastEvent);
    getChaModifier.mockReturnValue(2);
    parseExpression.mockReturnValue(null);

    const result = buildEmpoweredSpellState(playerStats);

    expect(result.type).toBe('empowered_spell');
    expect(result.lastEvent).toBeNull();
    expect(result.error).toBe('Could not parse damage formula');
  });

  it('returns error when lastEvent exists but rolls are missing', () => {
    const playerStats = makePlayerStats();
    const lastEvent = { damageFormula: '3d6', rawDamage: 10 };
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(5);
    getLastDamageEvent.mockReturnValue(lastEvent);
    getChaModifier.mockReturnValue(2);
    parseExpression.mockReturnValue({ count: 3, sides: 6, modifier: 0 });

    const result = buildEmpoweredSpellState(playerStats);

    expect(result.lastEvent).toBeNull();
    expect(result.error).toBe('No dice roll data available');
  });

  it('returns error when lastEvent exists but damageFormula is missing', () => {
    const playerStats = makePlayerStats();
    const lastEvent = { rolls: [3, 4, 5], rawDamage: 12 };
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(5);
    getLastDamageEvent.mockReturnValue(lastEvent);
    getChaModifier.mockReturnValue(2);

    const result = buildEmpoweredSpellState(playerStats);

    expect(result.lastEvent).toBeNull();
    expect(result.error).toBe('No dice roll data available');
  });

  it('passes through player stats name into SP values', () => {
    const playerStats = { name: 'Lyra', abilities: [{ name: 'Charisma', bonus: 4 }] };
    getMaxSorceryPoints.mockReturnValue(6);
    getCurrentSorceryPoints.mockReturnValue(6);
    getLastDamageEvent.mockReturnValue(null);
    getChaModifier.mockReturnValue(4);

    const result = buildEmpoweredSpellState(playerStats);

    expect(result.currentSP).toBe(6);
    expect(result.maxSP).toBe(6);
    expect(result.chaMod).toBe(4);
  });

  it('uses playerStats name for getCurrentSorceryPoints and getLastDamageEvent calls', () => {
    const playerStats = { name: 'Zara', abilities: [{ name: 'Charisma', bonus: 2 }] };
    getMaxSorceryPoints.mockReturnValue(4);
    getCurrentSorceryPoints.mockReturnValue(2);
    getLastDamageEvent.mockReturnValue(null);
    getChaModifier.mockReturnValue(2);

    buildEmpoweredSpellState(playerStats);

    expect(getCurrentSorceryPoints).toHaveBeenCalledWith('Zara', 4);
    expect(getLastDamageEvent).toHaveBeenCalledWith('Zara');
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
      lastEvent: makeLastEvent(),
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
      lastEvent: makeLastEvent(),
      chaMod: 3,
    });

    expect(result).toHaveProperty('popupState');
    expect(result.popupState.error).toBe('No combat summary found. Cannot reapply damage.');
    expect(spendSorceryPoints).not.toHaveBeenCalled();
  });

  it('returns error popup when no target name in lastEvent', async () => {
    const parsed = { count: 3, sides: 6, modifier: 2 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(3);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([]));
    const lastEvent = makeLastEvent();
    delete lastEvent.targetName;

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
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

  it('returns result with damageDifference when reroll changes total', async () => {
    const parsed = { count: 3, sides: 6, modifier: 0 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(2);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 10, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} },
    ]));
    applyDamageToTarget.mockReturnValue({ newHp: 8, finalDamage: 4 });

    const lastEvent = {
      damageFormula: '2d6',
      rolls: [2, 2],
      rawDamage: 4,
      targetName: 'Goblin',
      spellName: 'Firebolt',
    };

    // chaMod=2, reroll both dice: 2→5 (from 0.83), 2→5 (from 0.83)
    const randomValues = [0.83, 0.83];
    let randomIndex = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => randomValues[randomIndex++]);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 2,
    });

    expect(result.popupState.result.damageDifference).not.toBe(0);
    expect(result.popupState.result.oldTotal).toBe(4);
    expect(result.popupState.result.targetCurrentHp).toBe(8);

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
    expect(saveLastDamageEvent).toHaveBeenCalledWith('Xander', expect.objectContaining({ rawDamage: 12 }), CAMPAIGN);
  });

  it('handles more rolls than chaMod — only rerolls chaMod dice', async () => {
    const parsed = { count: 10, sides: 6, modifier: 0 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(1);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Dragon', type: 'npc', currentHp: 100, maxHp: 100, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} },
    ]));
    applyDamageToTarget.mockReturnValue({ newHp: 95, finalDamage: 0 });

    const lastEvent = {
      damageFormula: '10d6',
      rolls: [1, 2, 3, 4, 5, 6, 1, 2, 3, 4],
      rawDamage: 31,
      targetName: 'Dragon',
      spellName: 'Fireball',
    };

    // chaMod=2, so only reroll 2 lowest (values 1 and 1 at indices 0 and 6)
    const randomValues = [0.5, 0.5];
    let randomIndex = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => randomValues[randomIndex++]);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 2,
    });

    expect(result.popupState.result.rerollCount).toBe(2);
    expect(result.popupState.result.originalDice).toEqual([1, 2, 3, 4, 5, 6, 1, 2, 3, 4]);
    expect(result.popupState.result.newDice).toEqual([4, 2, 3, 4, 5, 6, 4, 2, 3, 4]);

    vi.restoreAllMocks();
  });

  it('handles damageType as undefined in lastEvent', async () => {
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
      damageType: undefined,
    };

    const randomValues = [0.5];
    let randomIndex = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => randomValues[randomIndex++]);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 1,
    });

    expect(result.popupState.completed).toBe(true);
    expect(applyDamageToTarget).toHaveBeenCalledWith(
      expect.any(Object),
      'Goblin',
      expect.any(Number),
      [],
      CAMPAIGN,
      undefined,
      false,
      'Xander',
    );

    vi.restoreAllMocks();
  });

  it('passes campaignName to getCombatContext', async () => {
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
      campaignName: 'MyCampaign',
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 1,
    });

    expect(getCombatContext).toHaveBeenCalledWith('MyCampaign');

    vi.restoreAllMocks();
  });

  it('handles applyDamageToTarget returning object without newHp', async () => {
    const parsed = { count: 1, sides: 6, modifier: 0 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(1);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 10, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} },
    ]));
    applyDamageToTarget.mockReturnValue({});

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

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 1,
    });

    expect(result.popupState.result.targetCurrentHp).toBeUndefined();

    vi.restoreAllMocks();
  });

  it('includes spellName and targetName in log entry', async () => {
    const parsed = { count: 1, sides: 6, modifier: 0 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(1);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 5, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} },
    ]));
    applyDamageToTarget.mockReturnValue({ newHp: 5, finalDamage: 0 });

    const lastEvent = {
      damageFormula: '1d6',
      rolls: [3],
      rawDamage: 3,
      targetName: 'Goblin',
      spellName: 'Magic Missile',
    };

    const randomValues = [0.5];
    let randomIndex = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => randomValues[randomIndex++]);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 1,
    });

    expect(result.logEntries[0].spellName).toBe('Magic Missile');
    expect(result.logEntries[0].characterName).toBe('Xander');
    expect(result.logEntries[0].targetName).toBe('Goblin');
    expect(result.logEntries[0].rerolledDiceCount).toBe(1);

    vi.restoreAllMocks();
  });

  it('calls saveLastDamageEvent with updated event after reroll', async () => {
    const parsed = { count: 2, sides: 6, modifier: 0 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(1);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 10, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} },
    ]));
    applyDamageToTarget.mockReturnValue({ newHp: 10, finalDamage: 0 });

    const lastEvent = {
      damageFormula: '2d6',
      rolls: [1, 2],
      rawDamage: 3,
      targetName: 'Goblin',
      spellName: 'Firebolt',
    };

    const randomValues = [0.5, 0.5];
    let randomIndex = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => randomValues[randomIndex++]);

    await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 2,
    });

    expect(saveLastDamageEvent).toHaveBeenCalledWith(
      'Xander',
      expect.objectContaining({
        rawDamage: expect.any(Number),
        rolls: expect.any(Array),
        timestamp: expect.any(Number),
      }),
      CAMPAIGN,
    );

    vi.restoreAllMocks();
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

  it('passes characters argument to applyDamageToTarget', async () => {
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

    const characters = [makePlayerStats()];
    const randomValues = [0.5];
    let randomIndex = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => randomValues[randomIndex++]);

    await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 1,
      characters,
    });

    expect(applyDamageToTarget).toHaveBeenCalledWith(
      expect.any(Object),
      'Goblin',
      expect.any(Number),
      [],
      CAMPAIGN,
      characters,
      false,
      'Xander',
    );

    vi.restoreAllMocks();
  });
});

// ── getEmpoweredSpellDescription ────────────────────────────────

describe('getEmpoweredSpellDescription', () => {
  const DEFAULT_DESC =
    'When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum of one). You must use the new rolls.';

  it.each([
    [{}, DEFAULT_DESC],
    [{ details: null }, DEFAULT_DESC],
    [{ details: '' }, DEFAULT_DESC],
    [{ details: undefined }, DEFAULT_DESC],
  ])('returns default description for action=%j', (action, expected) => {
    expect(getEmpoweredSpellDescription(action)).toBe(expected);
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

  it.each([
    '<li><b>Quickened Spell</b> Cast as bonus action.</li>',
    '<p><b>Empowered Spell</b> Not in li tag.</p>',
    '<li><b>Twinned Spell</b> Target two creatures.</li>',
  ])('returns default when details has non-Empowered metamagic: %s', (details) => {
    expect(getEmpoweredSpellDescription({ details })).toBe(DEFAULT_DESC);
  });

  it('throws TypeError when action is undefined', () => {
    expect(() => getEmpoweredSpellDescription(undefined)).toThrow(TypeError);
  });
});
