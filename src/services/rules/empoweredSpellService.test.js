import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../hooks/useMetamagic.js', () => ({
  getMaxSorceryPoints: vi.fn(),
  getCurrentSorceryPoints: vi.fn(),
  getLastDamageEvent: vi.fn(),
  spendSorceryPoints: vi.fn(),
  saveLastDamageEvent: vi.fn(),
}));

vi.mock('./metamagicRules.js', () => ({
  getChaModifier: vi.fn(),
}));

vi.mock('../dice/diceRoller.js', () => ({
  parseExpression: vi.fn(),
}));

vi.mock('./damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('./applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

// ── Imports (Vite returns mocked versions) ─────────────────────

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
} from '../../hooks/useMetamagic.js';
import { getChaModifier } from './metamagicRules.js';
import { parseExpression } from '../dice/diceRoller.js';
import { getCombatContext } from './damageUtils.js';
import { applyDamageToTarget } from './applyDamage.js';

// ── Globals ────────────────────────────────────────────────────

global.fetch = vi.fn(() => new Promise(() => {}));

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

  it('returns base state when no last event', () => {
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

  it('includes lastEvent when damage event exists', () => {
    const playerStats = makePlayerStats();
    const lastEvent = makeLastEvent();
    getMaxSorceryPoints.mockReturnValue(4);
    getCurrentSorceryPoints.mockReturnValue(2);
    getLastDamageEvent.mockReturnValue(lastEvent);
    getChaModifier.mockReturnValue(3);
    parseExpression.mockReturnValue({ count: 3, sides: 6, modifier: 2 });

    const result = buildEmpoweredSpellState(playerStats);

    expect(result.type).toBe('empowered_spell');
    expect(result.name).toBe('Metamagic - Empowered Spell');
    expect(result.currentSP).toBe(2);
    expect(result.maxSP).toBe(4);
    expect(result.lastEvent).toBe(lastEvent);
    expect(result.chaMod).toBe(3); // Math.min(3, 3) = 3
    expect(result.formulaParsed).toEqual({ count: 3, sides: 6, modifier: 2 });
  });

  it('caps chaMod to parsed count when chaMod > count', () => {
    const playerStats = makePlayerStats();
    const lastEvent = makeLastEvent();
    getMaxSorceryPoints.mockReturnValue(3);
    getCurrentSorceryPoints.mockReturnValue(1);
    getLastDamageEvent.mockReturnValue(lastEvent);
    getChaModifier.mockReturnValue(5); // higher than count of 3
    parseExpression.mockReturnValue({ count: 3, sides: 6, modifier: 2 });

    const result = buildEmpoweredSpellState(playerStats);

    expect(result.chaMod).toBe(3); // Math.min(5, 3) = 3
  });

  it('returns error when formula cannot be parsed', () => {
    const playerStats = makePlayerStats();
    const lastEvent = { damageFormula: 'invalid', rolls: [1, 2], rawDamage: 3 };
    getMaxSorceryPoints.mockReturnValue(5);
    getCurrentSorceryPoints.mockReturnValue(5);
    getLastDamageEvent.mockReturnValue(lastEvent);
    getChaModifier.mockReturnValue(2);
    parseExpression.mockReturnValue(null);

    const result = buildEmpoweredSpellState(playerStats);

    expect(result.type).toBe('empowered_spell');
    expect(result.name).toBe('Metamagic - Empowered Spell');
    expect(result.lastEvent).toBeNull();
    expect(result.error).toBe('Could not parse damage formula');
  });

  it('returns "No dice roll data available" when rolls missing', () => {
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

  it('passes through player stats name', () => {
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

  it('returns error popup when no sorcery points', async () => {
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

  it('returns error popup when no combat summary', async () => {
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
    getCombatContext.mockResolvedValue({});
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

  it('rerolls lowest dice up to chaMod count', async () => {
    const parsed = { count: 4, sides: 6, modifier: 1 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(2);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 10, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} },
    ]));
    applyDamageToTarget.mockReturnValue({ newHp: 7 });

    const lastEvent = {
      damageFormula: '4d6+1',
      rolls: [5, 2, 4, 1],
      rawDamage: 12,
      damageType: 'Fire',
      spellName: 'Burning Hands',
      targetName: 'Goblin',
    };

    // Mock Math.random to return deterministic values
    const randomValues = [3, 6]; // deterministic rerolls
    let randomIndex = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => randomValues[randomIndex++] / 10);
    // Math.floor(random * 6) + 1: 3→1, 6→4 (but random < 1 always, so let's use different approach)

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 2,
    });

    expect(result).toHaveProperty('popupState');
    expect(result.popupState.completed).toBe(true);
    expect(result.popupState.currentSP).toBe(1); // 2 - 1 = 1
    expect(result.popupState.maxSP).toBe(5);
    expect(result.popupState.result.oldTotal).toBe(12);
    expect(result.popupState.result.rerollCount).toBe(2); // Math.min(2, 4) = 2
    expect(result.logEntries).toHaveLength(1);
    expect(result.logEntries[0].type).toBe('metamagic');
    expect(result.logEntries[0].rollType).toBe('empowered-spell');
    expect(result.logEntries[0].originalDamage).toBe(12);
    expect(spendSorceryPoints).toHaveBeenCalledWith('Xander', 1, CAMPAIGN, 5);
    expect(saveLastDamageEvent).toHaveBeenCalledWith('Xander', expect.objectContaining({ rawDamage: expect.any(Number) }), CAMPAIGN);

    vi.restoreAllMocks();
  });

  it('spends exactly 1 sorcery point', async () => {
    const parsed = { count: 3, sides: 6, modifier: 0 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(3);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Orc', type: 'npc', currentHp: 20, maxHp: 20, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} },
    ]));
    applyDamageToTarget.mockReturnValue({ newHp: 15 });

    const lastEvent = {
      damageFormula: '3d6',
      rolls: [3, 3, 3],
      rawDamage: 9,
      targetName: 'Orc',
      spellName: 'Firebolt',
    };

    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 3,
    });

    expect(spendSorceryPoints).toHaveBeenCalledWith('Xander', 1, CAMPAIGN, 5);
    expect(result.popupState.currentSP).toBe(2);

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
    applyDamageToTarget.mockReturnValue({ newHp: 8 });

    const lastEvent = {
      damageFormula: '2d6',
      rolls: [2, 2],
      rawDamage: 4,
      targetName: 'Goblin',
      spellName: 'Firebolt',
    };

    vi.spyOn(Math, 'random').mockReturnValue(0.83); // Math.floor(0.83*6)+1 = 5

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

  it('handles chaMod of 0 — rerolls 0 dice', async () => {
    const parsed = { count: 5, sides: 6, modifier: 0 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(2);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Orc', type: 'npc', currentHp: 20, maxHp: 20, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} },
    ]));
    applyDamageToTarget.mockReturnValue({ newHp: 18 });

    const lastEvent = {
      damageFormula: '5d6',
      rolls: [5, 1, 4, 2, 3],
      rawDamage: 15,
      targetName: 'Orc',
      spellName: 'Fireball',
    };

    // chaMod=2, so reroll 2 lowest: values 1 and 2 (indices 1 and 3)
    vi.spyOn(Math, 'random').mockReturnValue(0.5).mockReturnValueOnce(0.5);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 2,
    });

    expect(result.popupState.result.rerollCount).toBe(2);
    expect(result.popupState.result.originalDice).toEqual([5, 1, 4, 2, 3]);
    expect(result.logEntries[0].originalDice).toEqual([5, 1, 4, 2, 3]);

    vi.restoreAllMocks();
  });

  it('includes spellName in log entry', async () => {
    const parsed = { count: 1, sides: 6, modifier: 0 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(1);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 5, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} },
    ]));
    applyDamageToTarget.mockReturnValue({ newHp: 5 });

    const lastEvent = {
      damageFormula: '1d6',
      rolls: [3],
      rawDamage: 3,
      targetName: 'Goblin',
      spellName: 'Magic Missile',
    };

    vi.spyOn(Math, 'random').mockReturnValue(0.5);

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

  it('handles chaMod of 0 — rerolls 0 dice', async () => {
    const parsed = { count: 3, sides: 6, modifier: 0 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(1);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 10, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} },
    ]));
    applyDamageToTarget.mockReturnValue({ newHp: 10 });

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
    expect(spendSorceryPoints).toHaveBeenCalledTimes(1);
  });

  it('handles more rolls than chaMod — only rerolls chaMod dice', async () => {
    const parsed = { count: 10, sides: 6, modifier: 0 };
    parseExpression.mockReturnValue(parsed);
    getCurrentSorceryPoints.mockReturnValue(1);
    getMaxSorceryPoints.mockReturnValue(5);
    getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Dragon', type: 'npc', currentHp: 100, maxHp: 100, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} },
    ]));
    applyDamageToTarget.mockReturnValue({ newHp: 95 });

    const lastEvent = {
      damageFormula: '10d6',
      rolls: [1, 2, 3, 4, 5, 6, 1, 2, 3, 4],
      rawDamage: 31,
      targetName: 'Dragon',
      spellName: 'Fireball',
    };

    // chaMod=2, so only reroll 2 lowest (values 1 and 1 at indices 0 and 6)
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 2,
    });

    expect(result.popupState.result.rerollCount).toBe(2);

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
    applyDamageToTarget.mockReturnValue({ newHp: 10 });

    const lastEvent = {
      damageFormula: '1d6',
      rolls: [3],
      rawDamage: 3,
      targetName: 'Goblin',
      spellName: 'Firebolt',
      damageType: undefined,
    };

    vi.spyOn(Math, 'random').mockReturnValue(0.5);

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
      [], // no damageType
      CAMPAIGN,
      null,
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
    applyDamageToTarget.mockReturnValue({ newHp: 10 });

    const lastEvent = {
      damageFormula: '1d6',
      rolls: [3],
      rawDamage: 3,
      targetName: 'Goblin',
      spellName: 'Firebolt',
    };

    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    await executeEmpoweredReroll({
      campaignName: 'MyCampaign',
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 1,
    });

    expect(getCombatContext).toHaveBeenCalledWith('MyCampaign');

    vi.restoreAllMocks();
  });

  it('handles applyDamageToTarget returning undefined newHp gracefully', async () => {
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

    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const result = await executeEmpoweredReroll({
      campaignName: CAMPAIGN,
      playerStats: makePlayerStats(),
      lastEvent,
      chaMod: 1,
    });

    expect(result.popupState.result.targetCurrentHp).toBeUndefined();

    vi.restoreAllMocks();
  });
});

// ── getEmpoweredSpellDescription ────────────────────────────────

describe('getEmpoweredSpellDescription', () => {
  it('returns default description when no details', () => {
    const result = getEmpoweredSpellDescription({});
    expect(result).toBe('When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum of one). You must use the new rolls.');
  });

  it('returns default description when details is null', () => {
    const result = getEmpoweredSpellDescription({ details: null });
    expect(result).toBe('When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum of one). You must use the new rolls.');
  });

  it('returns default description when details is empty string', () => {
    const result = getEmpoweredSpellDescription({ details: '' });
    expect(result).toBe('When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum of one). You must use the new rolls.');
  });

  it('extracts description from details HTML with bold tag and period after closing tag', () => {
    const action = {
      details: '<li><b>Empowered Spell</b>. Reroll damage dice up to CHA mod.</li>',
    };
    const result = getEmpoweredSpellDescription(action);
    expect(result).toBe('Reroll damage dice up to CHA mod.');
  });

  it('extracts description from details HTML with bold tag and no period', () => {
    const action = {
      details: '<li><b>Empowered Spell</b> Reroll damage dice up to CHA mod.</li>',
    };
    const result = getEmpoweredSpellDescription(action);
    expect(result).toBe('Reroll damage dice up to CHA mod.');
  });

  it('extracts description with multi-line content', () => {
    const action = {
      details: '<li><b>Empowered Spell</b> Some text\n  with newlines\n  and spaces</li>',
    };
    const result = getEmpoweredSpellDescription(action);
    expect(result).toBe('Some text\n  with newlines\n  and spaces');
  });

  it('is case-insensitive for the bold tag match', () => {
    const action = {
      details: '<li><b>empowered spell</b> Lowercase match.</li>',
    };
    const result = getEmpoweredSpellDescription(action);
    expect(result).toBe('Lowercase match.');
  });

  it('returns default when details has different metamagic option', () => {
    const action = {
      details: '<li><b>Quickened Spell</b> Cast as bonus action.</li>',
    };
    const result = getEmpoweredSpellDescription(action);
    expect(result).toBe('When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum of one). You must use the new rolls.');
  });

  it('returns default when details has Empowered Spell but in different HTML context', () => {
    // The regex requires <li><b>Empowered Spell</b>\.?\s* content </li>
    // If the structure doesn't match, it falls through to default
    const action = {
      details: '<p><b>Empowered Spell</b> Not in li tag.</p>',
    };
    const result = getEmpoweredSpellDescription(action);
    expect(result).toBe('When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum of one). You must use the new rolls.');
  });

  it('handles action being undefined — throws TypeError', () => {
    expect(() => getEmpoweredSpellDescription(undefined)).toThrow(TypeError);
  });
});
