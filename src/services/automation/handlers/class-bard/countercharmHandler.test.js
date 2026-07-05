// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './countercharmHandler.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet, getDistanceFeet, getNearestPlacedItem } from '../../../rules/combat/rangeValidation.js';
import * as mapsService from '../../../maps/mapsService.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/conditions/conditionSaveService.js', () => ({
  removeCondition: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
  getNearestPlacedItem: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'tavern-map';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    proficiency: 3,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Countercharm',
    automation: {
      range: '30 ft',
      ...automation,
    },
  };
}

function makeAttackResult(overrides = {}) {
  return {
    attackEvent: null,
    attackerName: null,
    targetName: null,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
    ...overrides,
  };
}

function makeAttackEvent(overrides = {}) {
  return {
    rollType: 'attack',
    d20: 8,
    bonus: 2,
    targetAc: 13,
    hit: false,
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeSaveEvent(overrides = {}) {
  return {
    rollType: 'save',
    d20: 8,
    bonus: 2,
    saveDc: 13,
    saveResult: 'failure',
    saveType: 'Wisdom',
    actionName: 'Charm Person',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeCheckEvent(overrides = {}) {
  return {
    rollType: 'check',
    d20: 8,
    bonus: 2,
    checkName: 'Persuasion',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeMapData(overrides = {}) {
  return {
    players: [
      { name: 'TestHero', gridX: 1, gridY: 1 },
      { name: 'Ally1', gridX: 4, gridY: 1 },
    ],
    placedItems: [
      { name: 'Goblin', gridX: 6, gridY: 1 },
    ],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('countercharmHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findLastAttack.mockResolvedValue(makeAttackResult());
    rangeToFeet.mockReturnValue(30);
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestHero', type: 'player' },
        { name: 'Ally1', type: 'player' },
        { name: 'Goblin', type: 'npc' },
      ],
    });
    mapsService.loadMapData.mockResolvedValue(null);
    getDistanceFeet.mockReturnValue(0);
    getNearestPlacedItem.mockReturnValue(null);
  });

  describe('no recent roll', () => {
    it('should return popup when no lastAttack exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent D20 test found');
    });

    it('should return popup when target is out of range on map', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent(),
        targetName: 'TestHero',
      }));
      mapsService.loadMapData.mockResolvedValue(makeMapData());
      getDistanceFeet.mockReturnValue(50);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent D20 test found');
    });

    it('should skip range check when no active map', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent(),
        targetName: 'TestHero',
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Target: TestHero');
      expect(mapsService.loadMapData).not.toHaveBeenCalled();
    });

    it('should skip range check when map data is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent(),
        targetName: 'TestHero',
      }));
      mapsService.loadMapData.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.description).toContain('Target: TestHero');
    });

    it('should skip range check when source not found on map', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent(),
        targetName: 'TestHero',
      }));
      mapsService.loadMapData.mockResolvedValue(makeMapData({
        players: [{ name: 'OtherPlayer', gridX: 1, gridY: 1 }],
      }));

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.description).toContain('Target: TestHero');
    });

    it('should skip range check when target not found on map', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent(),
        targetName: 'UnknownCreature',
      }));
      mapsService.loadMapData.mockResolvedValue(makeMapData());
      getNearestPlacedItem.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.description).toContain('Target: UnknownCreature');
    });
  });

  describe('save roll type', () => {
    it('should find player who failed their own save', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ d20: 8, saveDc: 13, saveResult: 'failure' }),
        targetName: 'TestHero',
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Target: TestHero');
      expect(result.payload.description).toContain('Original Wisdom save');
      expect(result.payload.description).toContain('Reroll with Advantage');
    });

    it('should find ally who failed their save', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ d20: 5, saveDc: 14, saveResult: 'failure' }),
        targetName: 'Ally1',
      }));
      mapsService.loadMapData.mockResolvedValue(makeMapData());
      getDistanceFeet.mockReturnValue(15);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.description).toContain('Target: Ally1');
      expect(result.payload.description).toContain('Original Wisdom save');
    });

    it('should find NPC who failed their save', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ d20: 5, saveDc: 14, saveResult: 'failure' }),
        targetName: 'Goblin',
      }));
      mapsService.loadMapData.mockResolvedValue(makeMapData());
      getNearestPlacedItem.mockReturnValue({ gridX: 6, gridY: 1 });
      getDistanceFeet.mockReturnValue(25);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.description).toContain('Target: Goblin');
    });

    it('should display turned failure into success', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ d20: 8, saveDc: 13, saveResult: 'failure' }),
        targetName: 'TestHero',
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Failed');
      expect(result.payload.description).toContain('Reroll with Advantage');
    });

    it('should display no effect when save already succeeded', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ d20: 15, saveDc: 13, saveResult: 'success' }),
        targetName: 'TestHero',
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Succeeded');
      expect(result.payload.description).toContain('already succeeded');
    });
  });

  describe('attack roll type', () => {
    it('should find attacker who made the roll', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeAttackEvent({ d20: 8, targetAc: 13, hit: false }),
        attackerName: 'TestHero',
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Target: TestHero');
      expect(result.payload.description).toContain('Original roll');
      expect(result.payload.description).toContain('Reroll with Advantage');
    });

    it('should display turned miss into hit', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeAttackEvent({ d20: 8, targetAc: 13, hit: false }),
        attackerName: 'TestHero',
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('MISS');
      expect(result.payload.description).toContain('Reroll with Advantage');
    });

    it('should display no effect when attack already hit', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeAttackEvent({ d20: 15, targetAc: 13, hit: true }),
        attackerName: 'TestHero',
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('already succeeded');
    });
  });

  describe('ability check roll type', () => {
    it('should find character who made the check', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeCheckEvent({ d20: 8 }),
        attackerName: 'TestHero',
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Target: TestHero');
      expect(result.payload.description).toContain('Persuasion');
      expect(result.payload.description).toContain('Reroll with Advantage');
    });
  });

  describe('custom feature name', () => {
    it('should use custom name in popup and description', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Bardic Countercharm',
        automation: { range: '30 ft' },
      };
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ saveResult: 'failure' }),
        targetName: 'TestHero',
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('Bardic Countercharm');
      expect(result.payload.description).toContain('<b>Bardic Countercharm</b>');
    });
  });

  describe('logging', () => {
    it('should log ability use with correct data for self target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ saveResult: 'failure' }),
        targetName: 'TestHero',
      }));

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Countercharm',
        description: expect.stringContaining('TestHero used Countercharm on TestHero'),
        targetName: 'TestHero',
        timestamp: expect.any(Number),
      });
    });

    it('should log ability use with ally target name', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ saveResult: 'failure' }),
        targetName: 'Ally1',
      }));
      mapsService.loadMapData.mockResolvedValue(makeMapData());
      getDistanceFeet.mockReturnValue(15);

      await handle(action, ps, campaignName, mapName);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Countercharm',
        description: expect.stringContaining('TestHero used Countercharm on Ally1'),
        targetName: 'Ally1',
        timestamp: expect.any(Number),
      });
    });

    it('should log outcome and effect details', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      findLastAttack.mockResolvedValue(makeAttackResult({
        attackEvent: makeSaveEvent({ saveResult: 'failure' }),
        targetName: 'TestHero',
      }));
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestHero', type: 'player' },
        ],
      });

      await handle(action, ps, campaignName, null);

      const logCall = addEntry.mock.calls[0][1];
      expect(logCall.description).toContain('save');
      expect(logCall.description).toContain('Outcome:');
    });
  });
});
