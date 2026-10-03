// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './beguilingTwistHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

const campaignName = 'TestCampaign';
const playerName = 'TestRanger';

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Wisdom', bonus: 3 }, { name: 'Charisma', bonus: -1 }],
    // CLA-034: Ranger spellcasting is WIS — the spell_save_dc seam resolves
    // 8 + WIS 3 + prof 4 = 15 here; CHA (-1) would wrongly give 11.
    spellAbilities: { saveDc: 15, modifier: 3, spellCastingAbility: 'WIS' },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Beguiling Twist',
    automation: {
      type: 'reaction_save',
      saveDc: 'spell_save_dc',
      range: '120_ft',
      duration: '1_minute',
      target: 'different_creature',
      ...automation,
    },
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
    });
    isWithinRange.mockResolvedValue(true);
    getRuntimeValue.mockImplementation((name, key, _campaign) => {
      if (name === 'campaign' && key === 'lastAttack') return null;
      return undefined;
    });
  });

  describe('no triggering save or condition', () => {
    it('should return popup when no lastAttack exists', async () => {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return null;
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No recent save against Charmed or Frightened found');
    });

    it('should return popup when lastAttack is an attack roll', async () => {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'attack',
          attackerName: 'Goblin',
          targetName: playerName,
          hit: true,
        };
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent save against Charmed or Frightened found');
    });

    it('should return popup when lastAttack is a failed save', async () => {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'save',
          targetName: playerName,
          saveResult: 'failure',
          saveConditions: ['charmed'],
        };
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent save against Charmed or Frightened found');
    });

    it('should return popup when lastAttack save has no charmed/frightened condition', async () => {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'save',
          targetName: playerName,
          saveResult: 'success',
          saveConditions: ['prone'],
        };
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent save against Charmed or Frightened found');
    });
  });

  describe('condition event trigger (GM manual add)', () => {
    it('should return modal when lastAttack has condition charmed', async () => {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'condition',
          conditionKey: 'charmed',
          targetName: playerName,
          timestamp: Date.now(),
        };
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('beguilingTwist');
      expect(result.payload.conditionKey).toBe('charmed');
      expect(result.payload.saveDc).toBe(15);
      // CLA-034: target:"different_creature" — the triggering saver (playerName)
      // must never appear in the redirect picker.
      expect(result.payload.targets.map(t => t.name)).toEqual(['Ally1', 'Goblin']);
      expect(result.payload.triggeredBy).toBe(playerName);
    });

    it('should return modal when lastAttack has condition frightened', async () => {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'condition',
          conditionKey: 'frightened',
          targetName: 'Ally1',
          timestamp: Date.now(),
        };
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('beguilingTwist');
      expect(result.payload.conditionKey).toBe('frightened');
    });
  });

  describe('save event trigger', () => {
    it('should return modal when lastAttack is a successful save with charmed condition', async () => {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'save',
          targetName: playerName,
          saveType: 'WIS',
          saveDc: 12,
          saveResult: 'success',
          saveConditions: ['charmed'],
          actionName: 'Charm Person',
        };
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('beguilingTwist');
      expect(result.payload.conditionKey).toBe('charmed');
    });

    it('should return modal when lastAttack is a successful save with frightened condition', async () => {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'save',
          targetName: 'Ally1',
          saveType: 'WIS',
          saveDc: 13,
          saveResult: 'success',
          saveConditions: ['frightened'],
          actionName: 'Frightful Presence',
        };
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('beguilingTwist');
      expect(result.payload.conditionKey).toBe('frightened');
    });

    it('should return popup when lastAttack save is a failure', async () => {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'save',
          targetName: playerName,
          saveResult: 'failure',
          saveConditions: ['charmed'],
        };
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent save against Charmed or Frightened found');
    });

    it('should handle saveConditions as empty array', async () => {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'save',
          targetName: playerName,
          saveResult: 'success',
          saveConditions: [],
        };
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
    });

    it('should return modal when lastAttack saveType is charmed', async () => {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'save',
          targetName: playerName,
          saveResult: 'success',
          saveType: 'charmed',
          saveConditions: [],
          saveDc: 13,
        };
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('beguilingTwist');
      expect(result.payload.conditionKey).toBe('charmed');
      expect(result.payload.saveDc).toBe(15);
    });

    it('should return modal when lastAttack saveType is frightened', async () => {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'save',
          targetName: playerName,
          saveResult: 'success',
          saveType: 'frightened',
          saveConditions: [],
          saveDc: 13,
        };
        return undefined;
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
      });
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'condition',
          conditionKey: 'charmed',
          targetName: playerName,
          timestamp: Date.now(),
        };
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures available to target');
    });

    it('should return popup when combat context is null', async () => {
      getCombatContext.mockResolvedValue(null);
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'condition',
          conditionKey: 'charmed',
          targetName: playerName,
          timestamp: Date.now(),
        };
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Cannot determine targets');
    });
  });

  describe('save DC calculation (CLA-034: spell_save_dc seam, never CHA)', () => {
    function charmedTrigger() {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'condition',
          conditionKey: 'charmed',
          targetName: playerName,
          timestamp: Date.now(),
        };
        return undefined;
      });
    }

    it('should resolve DC from playerStats.spellAbilities.saveDc (spell_save_dc token)', async () => {
      charmedTrigger();

      // FeyRanger discriminator: WIS +3, PB +6 → 17; CHA −1 would wrongly give 13.
      const result = await handle(
        makeAction(),
        { ...makePlayerStats(), proficiency: 6, spellAbilities: { saveDc: 17, modifier: 3, spellCastingAbility: 'WIS' } },
        campaignName,
      );

      expect(result.payload.saveDc).toBe(17);
    });

    it('should NOT bake the CHA modifier into the DC', async () => {
      charmedTrigger();

      const result = await handle(
        makeAction(),
        { ...makePlayerStats(), proficiency: 6, spellAbilities: { saveDc: 17, modifier: 3, spellCastingAbility: 'WIS' } },
        campaignName,
      );

      // 8 + CHA(-1) + 6 = 13 was the defect; must never surface.
      expect(result.payload.saveDc).not.toBe(13);
    });

    it('should fall back to 8 + spellcasting modifier + proficiency when saveDc not precomputed', async () => {
      charmedTrigger();

      const result = await handle(
        makeAction(),
        { ...makePlayerStats(), proficiency: 6, spellAbilities: { modifier: 3, spellCastingAbility: 'WIS' } },
        campaignName,
      );

      expect(result.payload.saveDc).toBe(17);
    });
  });

  describe('range gating (CLA-034: isWithinRange seam)', () => {
    it('should consult isWithinRange with the data 120 ft band', async () => {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'save',
          targetName: playerName,
          saveResult: 'success',
          saveConditions: ['frightened'],
        };
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(isWithinRange).toHaveBeenCalledWith(playerName, 'Ally1', 120);
      expect(isWithinRange).toHaveBeenCalledWith(playerName, 'Goblin', 120);
    });

    it('should drop creatures reported out of range', async () => {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'save',
          targetName: playerName,
          saveResult: 'success',
          saveConditions: ['frightened'],
        };
        return undefined;
      });
      isWithinRange.mockImplementation(async (_source, target) => target !== 'Goblin');

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.targets.map(t => t.name)).toEqual(['Ally1']);
    });

    it('should refuse with a popup when no eligible different creature remains', async () => {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'save',
          targetName: playerName,
          saveResult: 'success',
          saveConditions: ['frightened'],
        };
        return undefined;
      });
      getCombatContext.mockResolvedValue({ creatures: [{ name: playerName, type: 'player' }] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('DIFFERENT creature');
    });
  });

  describe('feature name', () => {
    it('should use custom feature name from action', async () => {
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'condition',
          conditionKey: 'charmed',
          targetName: playerName,
          timestamp: Date.now(),
        };
        return undefined;
      });

      const customResult = await handle(
        { name: 'My Feature', automation: { type: 'reaction_save' } },
        makePlayerStats(),
        campaignName,
      );
      expect(customResult.payload.featureName).toBe('My Feature');

      vi.clearAllMocks();
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (name === 'campaign' && key === 'lastAttack') return {
          rollType: 'condition',
          conditionKey: 'frightened',
          targetName: playerName,
          timestamp: Date.now(),
        };
        return undefined;
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
