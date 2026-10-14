import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import { triggerDominateMonster } from './dominateMonsterService.js';
import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from "../combat/damageUtils.js";

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 15,
    proficiency: 6,
    abilities: [{ name: 'Charisma', bonus: 4 }],
    spellAbilities: { saveDc: 17 },
    ...overrides,
  };
}

function makeSpell(overrides = {}) {
  return {
    name: 'Dominate Monster',
    level: 8,
    ...overrides,
  };
}

describe('dominateMonsterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info', name: 'Dominate Monster', description: 'test' } });
    getCombatContext.mockResolvedValue({ creatures: [] });
  });

  describe('spell matching', () => {
    it('returns null for non-dominate-monster spells', async () => {
      const result = await triggerDominateMonster(makeSpell({ name: 'Fireball' }), {}, makePlayerStats(), campaignName, null);
      expect(result).toBeNull();
    });

    it('matches case-insensitively', async () => {
      const result = await triggerDominateMonster(makeSpell({ name: 'dominate monster' }), {}, makePlayerStats(), campaignName, null);
      expect(result).not.toBeNull();
    });
  });

  describe('target resolution', () => {
    it('returns popup when no target and no creatures in combat', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await triggerDominateMonster(makeSpell(), {}, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('logs error when no target selected', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestCaster' },
          { name: 'Goblin' },
        ],
      });
      getTargetFromAttacker.mockReturnValue(null);
      const consoleSpy = vi.spyOn(console, 'error');

      const result = await triggerDominateMonster(makeSpell(), {}, makePlayerStats(), campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[dominateMonsterService] No target selected for Dominate Monster'),
      );
      expect(result).toEqual({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Dominate Monster', description: 'No target selected for Dominate Monster.' },
      });
      consoleSpy.mockRestore();
    });
  });

  describe('no target type restriction', () => {
    it('allows any creature type (no type check for Dominate Monster)', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc' },
        ],
      });

      const result = await triggerDominateMonster(makeSpell(), { targetName: 'Goblin' }, makePlayerStats(), campaignName, null);

      expect(executeHandler).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });

    it('allows player characters (no type check for Dominate Monster)', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestCaster', type: 'player' },
          { name: 'Ally', type: 'player' },
        ],
      });

      await triggerDominateMonster(makeSpell(), { targetName: 'Ally' }, makePlayerStats(), campaignName, null);

      expect(executeHandler).toHaveBeenCalled();
    });
  });

  describe('combat advantage', () => {
    it('passes advantage=true when target is not at full health', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestCaster' },
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10 },
        ],
      });

      await triggerDominateMonster(makeSpell(), { targetName: 'Goblin' }, makePlayerStats(), campaignName, null);

      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          automation: expect.objectContaining({ advantage: true }),
        }),
        makePlayerStats(),
        campaignName,
        null,
      );
    });

    it('passes advantage=false when target is at full health', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 10 }],
      });

      await triggerDominateMonster(makeSpell(), { targetName: 'Goblin' }, makePlayerStats(), campaignName, null);

      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          automation: expect.objectContaining({ advantage: false }),
        }),
        makePlayerStats(),
        campaignName,
        null,
      );
    });
  });

  describe('action building', () => {
    it('builds action with correct type and slot level', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc' }] });

      await triggerDominateMonster(makeSpell(), { targetName: 'Goblin', spellSaveDc: 18 }, makePlayerStats(), campaignName, null);

      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Dominate Monster',
          automation: expect.objectContaining({
            type: 'dominate_monster',
            saveDc: 18,
            targetName: 'Goblin',
          }),
          spell: expect.any(Object),
          spellSlotLevel: 8,
        }),
        makePlayerStats(),
        campaignName,
        null,
      );
    });
  });

  describe('error handling', () => {
    it('returns error popup when handler throws', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc' }] });
      executeHandler.mockRejectedValue(new Error('handler failed'));

      const result = await triggerDominateMonster(makeSpell(), { targetName: 'Goblin' }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Failed to execute');
    });
  });
});
