// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ─────────────────────────────────────────

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('./tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { handle, confirmPowerWordFortify } from './powerWordFortifyHandler.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as tempHpService from './tempHpService.js';
import * as logService from '../../../ui/logService.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as allySelection from '../../../../hooks/useAllySelection.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as diceRoller from '../../../dice/diceRoller.js';

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const playerName = 'Cleric';

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
    level: 7,
    proficiency: 3,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Power Word Fortify',
    automation: { type: 'power_word_fortify', ...automation },
  };
}

function makeCombatContext(creatureNames) {
  return {
    creatures: creatureNames.map((name) => ({ name, type: 'creature', currentHp: 10, maxHp: 20 })),
    players: [{ name: playerName }],
    placedItems: [],
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('powerWordFortifyHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rangeCheck.isWithinRange.mockResolvedValue(true);
    rangeValidation.rangeToFeet.mockReturnValue(60);
    diceRoller.rollExpression.mockReturnValue({ total: 30, rolls: [15, 15], modifier: 0 });
    allySelection.getAllyList.mockReturnValue([playerName, 'Ally1', 'Ally2']);
    damageUtils.getCombatContext.mockResolvedValue(
      makeCombatContext([playerName, 'Ally1', 'Ally2']),
    );
  });

  // ── handle: temp HP expression resolution ────────────────────

  describe('temp HP expression resolution', () => {
    it('defaults to 120 when no tempHpExpression provided', async () => {
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(result.payload.totalTempHp).toBe(120);
      expect(result.payload.tempHpExpression).toBe('120');
    });

    it('rolls dice for dice expressions and returns the total in payload', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 45, rolls: [20, 20, 5], modifier: 0 });

      const result = await handle(makeAction({ tempHpExpression: '3d6+9' }), makePlayerStats(), campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('3d6+9');
      expect(result.payload.totalTempHp).toBe(45);
    });

    it('substitutes spellSlotLevel with auto.slotLevel when provided', async () => {
      const result = await handle(
        makeAction({ tempHpExpression: 'spellSlotLevel * 10', slotLevel: 8 }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.totalTempHp).toBe(8);
    });

    it('substitutes spellSlotLevel with playerStats.level when no auto.slotLevel', async () => {
      const result = await handle(
        makeAction({ tempHpExpression: 'spellSlotLevel * 10' }),
        makePlayerStats({ level: 7 }),
        campaignName,
        null,
      );

      expect(result.payload.totalTempHp).toBe(7);
    });

    it('substitutes spellSlotLevel with default level 7 when no slotLevel or player level', async () => {
      const result = await handle(
        makeAction({ tempHpExpression: 'spellSlotLevel * 10' }),
        makePlayerStats({ level: undefined }),
        campaignName,
        null,
      );

      expect(result.payload.totalTempHp).toBe(7);
    });

    it('handles plain numeric expressions without rolling dice', async () => {
      const result = await handle(
        makeAction({ tempHpExpression: '50' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(result.payload.totalTempHp).toBe(50);
    });

    it('handles dice expressions with positive modifiers', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 25, rolls: [12, 8, 5], modifier: 0 });

      const result = await handle(makeAction({ tempHpExpression: '3d8+1' }), makePlayerStats(), campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('3d8+1');
      expect(result.payload.totalTempHp).toBe(25);
    });

    it('handles dice expressions with negative modifiers', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 18, rolls: [6, 6, 6], modifier: 0 });

      const result = await handle(makeAction({ tempHpExpression: '3d6-3' }), makePlayerStats(), campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('3d6-3');
      expect(result.payload.totalTempHp).toBe(18);
    });
  });

  // ── handle: roll failure ─────────────────────────────────────

  describe('roll failure', () => {
    it('returns popup when rollExpression returns null for dice expression', async () => {
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(makeAction({ tempHpExpression: '2d8' }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Power Word Fortify');
      expect(result.payload.description).toBe('Power Word Fortify failed to roll temporary HP.');
    });

    it('returns popup when parseInt fails for non-numeric expression', async () => {
      const result = await handle(
        makeAction({ tempHpExpression: 'not_a_number' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Power Word Fortify failed to roll temporary HP.');
    });
  });

  // ── handle: combat context ───────────────────────────────────

  describe('combat context validation', () => {
    it('returns null when combat context is unavailable', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toBeNull();
    });

    it('returns popup when combat context exists but creatures array is null', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: null, players: [], placedItems: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Power Word Fortify: No allies within range.');
    });
  });

  // ── handle: ally resolution ──────────────────────────────────

  describe('ally resolution', () => {
    it('uses stored ally list when available and non-empty', async () => {
      allySelection.getAllyList.mockReturnValue(['Ally1', 'Ally2']);

      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([playerName, 'Ally1', 'Ally2']),
      );

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(allySelection.getAllyList).toHaveBeenCalledWith(playerName);
      expect(result.type).toBe('modal');
    });

    it('falls back to all combat creatures when ally list is empty', async () => {
      allySelection.getAllyList.mockReturnValue([]);

      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([playerName, 'Ally1', 'Ally2', 'Enemy1']),
      );

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
    });

    it('returns popup when no allies exist at all', async () => {
      allySelection.getAllyList.mockReturnValue([]);

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No allies within range');
    });

    it('excludes the player from creatureTargets', async () => {
      allySelection.getAllyList.mockReturnValue(['Ally1', 'Ally2']);

      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([playerName, 'Ally1', 'Ally2']),
      );

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const targetNames = result.payload.creatureTargets.map((t) => t.name);
      expect(targetNames).not.toContain(playerName);
    });

    it('skips allies not found in combat context', async () => {
      allySelection.getAllyList.mockReturnValue(['Ally1', 'Ghost']);

      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([playerName, 'Ally1']),
      );

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.creatureTargets).toHaveLength(1);
      expect(result.payload.creatureTargets[0].name).toBe('Ally1');
    });
  });

  // ── handle: range checking ───────────────────────────────────

  describe('range checking', () => {
    it('filters out allies outside range', async () => {
      allySelection.getAllyList.mockReturnValue(['Ally1', 'Ally2']);

      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([playerName, 'Ally1', 'Ally2']),
      );

      rangeCheck.isWithinRange.mockResolvedValueOnce(true);   // Ally1 in range
      rangeCheck.isWithinRange.mockResolvedValueOnce(false);  // Ally2 out of range

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith(playerName, 'Ally1', 60);
      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith(playerName, 'Ally2', 60);
      expect(result.payload.creatureTargets).toHaveLength(1);
      expect(result.payload.creatureTargets[0].name).toBe('Ally1');
    });

    it('returns popup when no allies are within range', async () => {
      allySelection.getAllyList.mockReturnValue(['Ally1', 'Ally2']);

      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([playerName, 'Ally1', 'Ally2']),
      );

      rangeCheck.isWithinRange.mockResolvedValue(false);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Power Word Fortify: No allies within range.');
    });
  });

  // ── handle: range configuration ──────────────────────────────

  describe('range configuration', () => {
    it('uses default 60ft range when no range in automation', async () => {
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(rangeValidation.rangeToFeet).not.toHaveBeenCalled();
      expect(result.type).toBe('modal');
    });

    it('converts range string to feet when provided', async () => {
      rangeValidation.rangeToFeet.mockReturnValue(30);

      const result = await handle(makeAction({ range: '30 ft' }), makePlayerStats(), campaignName, null);

      expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('30 ft');
      expect(result.type).toBe('modal');
    });
  });

  // ── handle: modal return structure ───────────────────────────

  describe('modal return structure', () => {
    it('returns modal with correct payload structure', async () => {
      allySelection.getAllyList.mockReturnValue(['Ally1', 'Ally2']);

      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([playerName, 'Ally1', 'Ally2']),
      );

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('powerWordFortifyTarget');
      expect(result.payload.action).toBeDefined();
      expect(result.payload.playerStats).toBeDefined();
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.maxTargets).toBe(6);
      expect(result.payload.totalTempHp).toBe(120);
      expect(result.payload.tempHpExpression).toBe('120');
    });

    it('includes creatureTargets with name, type, currentHp, maxHp', async () => {
      allySelection.getAllyList.mockReturnValue(['Ally1', 'Ally2']);

      const combatCtx = {
        creatures: [
          { name: playerName, type: 'player', currentHp: 20, maxHp: 20 },
          { name: 'Ally1', type: 'warrior', currentHp: 15, maxHp: 18 },
          { name: 'Ally2', type: 'ranger', currentHp: 8, maxHp: 12 },
        ],
        players: [{ name: playerName }],
        placedItems: [],
      };
      damageUtils.getCombatContext.mockResolvedValue(combatCtx);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.creatureTargets).toEqual([
        { name: 'Ally1', type: 'warrior', currentHp: 15, maxHp: 18 },
        { name: 'Ally2', type: 'ranger', currentHp: 8, maxHp: 12 },
      ]);
    });

    it('uses custom maxTargets from automation', async () => {
      allySelection.getAllyList.mockReturnValue(['Ally1']);

      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([playerName, 'Ally1']),
      );

      const result = await handle(makeAction({ maxTargets: 4 }), makePlayerStats(), campaignName, null);

      expect(result.payload.maxTargets).toBe(4);
    });

    it('passes the dice expression through in payload', async () => {
      allySelection.getAllyList.mockReturnValue(['Ally1']);

      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([playerName, 'Ally1']),
      );

      diceRoller.rollExpression.mockReturnValue({ total: 25, rolls: [25], modifier: 0 });

      const result = await handle(makeAction({ tempHpExpression: '2d10+5' }), makePlayerStats(), campaignName, null);

      expect(result.payload.tempHpExpression).toBe('2d10+5');
      expect(result.payload.totalTempHp).toBe(25);
    });
  });
});

// ── confirmPowerWordFortify ──────────────────────────────────────

describe('confirmPowerWordFortify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logService.addEntry.mockResolvedValue(undefined);
  });

  it('grants temp HP to each selected target', async () => {
    const distribution = { Ally1: 20, Ally2: 30 };
    const action = makeAction();
    const ps = makePlayerStats();

    await confirmPowerWordFortify({
    action,
    playerStats: ps,
    campaignName,
    distribution,
    totalTempHp: 50,
    tempHpExpression: '2d8+4',
});

    expect(tempHpService.setTempHp).toHaveBeenCalledWith('Ally1', 20, campaignName);
    expect(tempHpService.setTempHp).toHaveBeenCalledWith('Ally2', 30, campaignName);
  });

  it('skips targets with zero or negative grant amount', async () => {
    const distribution = { Ally1: 20, Ally2: 0, Ally3: -5 };
    const action = makeAction();
    const ps = makePlayerStats();

    await confirmPowerWordFortify({
    action,
    playerStats: ps,
    campaignName,
    distribution,
    totalTempHp: 20,
    tempHpExpression: '2d8+4',
});

    expect(tempHpService.setTempHp).toHaveBeenCalledWith('Ally1', 20, campaignName);
    expect(tempHpService.setTempHp).not.toHaveBeenCalledWith('Ally2', 0, campaignName);
    expect(tempHpService.setTempHp).not.toHaveBeenCalledWith('Ally3', -5, campaignName);
  });

  it('logs an hp_change entry for each target receiving temp HP', async () => {
    const distribution = { Ally1: 15, Ally2: 25 };
    const action = makeAction();
    const ps = makePlayerStats();

    await confirmPowerWordFortify({
    action,
    playerStats: ps,
    campaignName,
    distribution,
    totalTempHp: 40,
    tempHpExpression: '2d6+6',
});

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'hp_change',
        targetName: 'Ally1',
        delta: 15,
        isTempHp: true,
        sourceName: playerName,
        note: 'Power Word Fortify',
        formula: '2d6+6',
      }),
    );

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'hp_change',
        targetName: 'Ally2',
        delta: 25,
        isTempHp: true,
        sourceName: playerName,
        note: 'Power Word Fortify',
        formula: '2d6+6',
      }),
    );
  });

  it('returns a popup with distribution summary', async () => {
    const distribution = { Ally1: 20, Ally2: 30 };
    const action = makeAction();
    const ps = makePlayerStats();
    const totalTempHp = 50;

    const result = await confirmPowerWordFortify({
    action,
    playerStats: ps,
    campaignName,
    distribution,
    totalTempHp,
    tempHpExpression: '2d8+4',
});

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Power Word Fortify');
    expect(result.payload.description).toContain('50 temp HP distributed');
    expect(result.payload.description).toContain('Ally1: 20');
    expect(result.payload.description).toContain('Ally2: 30');
  });

  it('includes automationType in popup payload', async () => {
    const distribution = { Ally1: 20 };
    const action = makeAction({ type: 'power_word_fortify' });
    const ps = makePlayerStats();

    const result = await confirmPowerWordFortify({
    action,
    playerStats: ps,
    campaignName,
    distribution,
    totalTempHp: 20,
    tempHpExpression: '2d8+4',
});

    expect(result.payload.automationType).toBe('power_word_fortify');
  });

  it('handles empty distribution (no targets selected)', async () => {
    const distribution = {};
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await confirmPowerWordFortify({
    action,
    playerStats: ps,
    campaignName,
    distribution,
    totalTempHp: 0,
    tempHpExpression: '2d8+4',
});

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('0 temp HP distributed');
    expect(result.payload.description).toContain('none');
    expect(tempHpService.setTempHp).not.toHaveBeenCalled();
  });

  it('dispatches combat-summary-updated event', async () => {
    const distribution = { Ally1: 20 };
    const action = makeAction();
    const ps = makePlayerStats();

    const originalDispatch = window.dispatchEvent;
    let eventFired = null;
    window.dispatchEvent = vi.fn((event) => { eventFired = event; });

    await confirmPowerWordFortify({
    action,
    playerStats: ps,
    campaignName,
    distribution,
    totalTempHp: 20,
    tempHpExpression: '2d8+4',
});

    expect(window.dispatchEvent).toHaveBeenCalled();
    expect(eventFired).toBeInstanceOf(CustomEvent);
    expect(eventFired.type).toBe('combat-summary-updated');

    window.dispatchEvent = originalDispatch;
  });

  it('handles errors from addEntry gracefully', async () => {
    const distribution = { Ally1: 20 };
    const action = makeAction();
    const ps = makePlayerStats();

    logService.addEntry.mockRejectedValue(new Error('log failed'));

    const result = await confirmPowerWordFortify({
    action,
    playerStats: ps,
    campaignName,
    distribution,
    totalTempHp: 20,
    tempHpExpression: '2d8+4',
});

    expect(result.type).toBe('popup');
    expect(tempHpService.setTempHp).toHaveBeenCalledWith('Ally1', 20, campaignName);
  });

  it('handles single target distribution', async () => {
    const distribution = { SoloAlly: 40 };
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await confirmPowerWordFortify({
    action,
    playerStats: ps,
    campaignName,
    distribution,
    totalTempHp: 40,
    tempHpExpression: '4d8+4',
});

    expect(tempHpService.setTempHp).toHaveBeenCalledWith('SoloAlly', 40, campaignName);
    expect(result.payload.description).toContain('SoloAlly: 40');
  });

  it('handles multiple targets with same amount', async () => {
    const distribution = { Ally1: 10, Ally2: 10, Ally3: 10 };
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await confirmPowerWordFortify({
    action,
    playerStats: ps,
    campaignName,
    distribution,
    totalTempHp: 30,
    tempHpExpression: '2d6+4',
});

    expect(tempHpService.setTempHp).toHaveBeenCalledWith('Ally1', 10, campaignName);
    expect(tempHpService.setTempHp).toHaveBeenCalledWith('Ally2', 10, campaignName);
    expect(tempHpService.setTempHp).toHaveBeenCalledWith('Ally3', 10, campaignName);
    expect(result.payload.description).toContain('Ally1: 10');
    expect(result.payload.description).toContain('Ally2: 10');
    expect(result.payload.description).toContain('Ally3: 10');
  });
});
