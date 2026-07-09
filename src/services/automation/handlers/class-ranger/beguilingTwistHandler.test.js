// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './beguilingTwistHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(),
}));

const campaignName = 'TestCampaign';
const playerName = 'TestRanger';

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Beguiling Twist',
    automation: { type: 'reaction_save', ...automation },
  };
}

function defaultCreatures() {
  return [
    { name: 'Ally1', type: 'player' },
    { name: playerName, type: 'player' },
    { name: 'Goblin', type: 'monster' },
  ];
}

describe('beguilingTwistHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatContext.mockResolvedValue({
      creatures: defaultCreatures(),
      lastAttack: null,
    });
  });

  describe('no triggering save or condition', () => {
    it('should return popup when no lastAttack exists', async () => {
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: null,
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No recent save against Charmed or Frightened found');
    });

    it('should return popup when lastAttack is an attack roll', async () => {
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: {
          rollType: 'attack',
          attackerName: 'Goblin',
          targetName: playerName,
          hit: true,
        },
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent save against Charmed or Frightened found');
    });

    it('should return popup when lastAttack is a failed save', async () => {
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: {
          rollType: 'save',
          targetName: playerName,
          saveResult: 'failure',
          saveConditions: ['charmed'],
        },
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent save against Charmed or Frightened found');
    });

    it('should return popup when lastAttack save has no charmed/frightened condition', async () => {
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: {
          rollType: 'save',
          targetName: playerName,
          saveResult: 'success',
          saveConditions: ['prone'],
        },
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent save against Charmed or Frightened found');
    });
  });

  describe('condition event trigger (GM manual add)', () => {
    it('should return modal when lastAttack has condition charmed', async () => {
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: {
          rollType: 'condition',
          conditionKey: 'charmed',
          targetName: playerName,
          timestamp: Date.now(),
        },
      });
      getAbilityModifier.mockReturnValue(3);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('beguilingTwist');
      expect(result.payload.conditionKey).toBe('charmed');
      expect(result.payload.saveDc).toBe(15);
      expect(result.payload.targets).toEqual(defaultCreatures());
    });

    it('should return modal when lastAttack has condition frightened', async () => {
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: {
          rollType: 'condition',
          conditionKey: 'frightened',
          targetName: 'Ally1',
          timestamp: Date.now(),
        },
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('beguilingTwist');
      expect(result.payload.conditionKey).toBe('frightened');
    });
  });

  describe('save event trigger', () => {
    it('should return modal when lastAttack is a successful save with charmed condition', async () => {
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: {
          rollType: 'save',
          targetName: playerName,
          saveType: 'WIS',
          saveDc: 12,
          saveResult: 'success',
          saveConditions: ['charmed'],
          actionName: 'Charm Person',
        },
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('beguilingTwist');
      expect(result.payload.conditionKey).toBe('charmed');
    });

    it('should return modal when lastAttack is a successful save with frightened condition', async () => {
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: {
          rollType: 'save',
          targetName: 'Ally1',
          saveType: 'WIS',
          saveDc: 13,
          saveResult: 'success',
          saveConditions: ['frightened'],
          actionName: 'Frightful Presence',
        },
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('beguilingTwist');
      expect(result.payload.conditionKey).toBe('frightened');
    });

    it('should return popup when lastAttack save is a failure', async () => {
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: {
          rollType: 'save',
          targetName: playerName,
          saveResult: 'failure',
          saveConditions: ['charmed'],
        },
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent save against Charmed or Frightened found');
    });

    it('should handle saveConditions as empty array', async () => {
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: {
          rollType: 'save',
          targetName: playerName,
          saveResult: 'success',
          saveConditions: [],
        },
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
    });

    it('should return modal when lastAttack saveType is charmed', async () => {
      getAbilityModifier.mockReturnValue(3);
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: {
          rollType: 'save',
          targetName: playerName,
          saveResult: 'success',
          saveType: 'charmed',
          saveConditions: [],
          saveDc: 13,
        },
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('beguilingTwist');
      expect(result.payload.conditionKey).toBe('charmed');
      expect(result.payload.saveDc).toBe(15);
    });

    it('should return modal when lastAttack saveType is frightened', async () => {
      getAbilityModifier.mockReturnValue(3);
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: {
          rollType: 'save',
          targetName: playerName,
          saveResult: 'success',
          saveType: 'frightened',
          saveConditions: [],
          saveDc: 13,
        },
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('beguilingTwist');
      expect(result.payload.conditionKey).toBe('frightened');
      expect(result.payload.saveDc).toBe(15);
    });
  });

  describe('no creatures available', () => {
    it('should return popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [],
        lastAttack: {
          rollType: 'condition',
          conditionKey: 'charmed',
          targetName: playerName,
          timestamp: Date.now(),
        },
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures available to target');
    });

    it('should return popup when combat context is null', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Cannot determine targets');
    });
  });

  describe('save DC calculation', () => {
    it('should calculate DC as 8 + CHA bonus + proficiency', async () => {
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: {
          rollType: 'condition',
          conditionKey: 'charmed',
          targetName: playerName,
          timestamp: Date.now(),
        },
      });
      getAbilityModifier.mockReturnValue(3);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.saveDc).toBe(15);
    });

    it('should use custom proficiency and CHA modifier from stats', async () => {
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: {
          rollType: 'condition',
          conditionKey: 'charmed',
          targetName: playerName,
          timestamp: Date.now(),
        },
      });
      getAbilityModifier.mockReturnValue(5);

      const result = await handle(
        makeAction(),
        { ...makePlayerStats(), proficiency: 6 },
        campaignName,
      );

      expect(result.payload.saveDc).toBe(19);
    });

    it('should default proficiency to 0 if missing', async () => {
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: {
          rollType: 'condition',
          conditionKey: 'charmed',
          targetName: playerName,
          timestamp: Date.now(),
        },
      });
      getAbilityModifier.mockReturnValue(3);

      const result = await handle(
        makeAction(),
        { ...makePlayerStats(), proficiency: undefined },
        campaignName,
      );

      expect(result.payload.saveDc).toBe(11);
    });
  });

  describe('feature name', () => {
    it('should use custom feature name from action', async () => {
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: {
          rollType: 'condition',
          conditionKey: 'charmed',
          targetName: playerName,
          timestamp: Date.now(),
        },
      });

      const customResult = await handle(
        { name: 'My Feature', automation: { type: 'reaction_save' } },
        makePlayerStats(),
        campaignName,
      );
      expect(customResult.payload.featureName).toBe('My Feature');

      vi.clearAllMocks();
      getCombatContext.mockResolvedValue({
        creatures: defaultCreatures(),
        lastAttack: {
          rollType: 'condition',
          conditionKey: 'frightened',
          targetName: playerName,
          timestamp: Date.now(),
        },
      });

      const defaultResult = await handle(
        { automation: { type: 'reaction_save' } },
        makePlayerStats(),
        campaignName,
      );

      expect(defaultResult.payload.featureName).toBe('Beguiling Twist');
    });
  });


});
