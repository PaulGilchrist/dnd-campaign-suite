import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { triggerDominateBeast } from './dominateBeastService.js';
import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from "../combat/damageUtils.js";
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

function makeSpell(overrides = {}) {
  return {
    name: 'Dominate Beast',
    level: 4,
    ...overrides,
  };
}

describe('dominateBeastService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info', name: 'Dominate Beast', description: 'test' } });
    getCombatContext.mockResolvedValue({ creatures: [] });
  });

  describe('spell matching', () => {
    it('returns null for non-dominate-beast spells', async () => {
      const result = await triggerDominateBeast(makeSpell({ name: 'Fireball' }), {}, makePlayerStats(), campaignName, null);
      expect(result).toBeNull();
    });

    it('matches case-insensitively', async () => {
      const result = await triggerDominateBeast(makeSpell({ name: 'dominate beast' }), {}, makePlayerStats(), campaignName, null);
      expect(result).not.toBeNull();
    });
  });

  describe('target resolution', () => {
    it('returns popup when no target and no creatures in combat', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await triggerDominateBeast(makeSpell(), {}, makePlayerStats(), campaignName, null);

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

      const result = await triggerDominateBeast(makeSpell(), {}, makePlayerStats(), campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[dominateBeastService] No target selected for Dominate Beast'),
      );
      expect(result).toEqual({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Dominate Beast', description: 'No target selected for Dominate Beast.' },
      });
      consoleSpy.mockRestore();
    });
  });

  describe('target type check', () => {
    it('blocks non-beast targets', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'npc' }],
      });
      getMonsterData.mockResolvedValue({ type: 'Monstrosity' });

      const result = await triggerDominateBeast(makeSpell(), { targetName: 'Goblin' }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('not a Beast');
      expect(executeHandler).not.toHaveBeenCalled();
    });

    it('allows beast targets', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Wolf', type: 'npc' }],
      });
      getMonsterData.mockResolvedValue({ type: 'Beast' });

      await triggerDominateBeast(makeSpell(), { targetName: 'Wolf' }, makePlayerStats(), campaignName, null);

      expect(executeHandler).toHaveBeenCalled();
    });

    it('blocks player characters (not beasts)', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestCaster', type: 'player' }, { name: 'Ally', type: 'player' }],
      });

      const result = await triggerDominateBeast(makeSpell(), { targetName: 'Ally' }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('not a Beast');
    });

    it('refunds spell slot when target is not a Beast', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'npc' }],
      });
      getMonsterData.mockResolvedValue({ type: 'Monstrosity' });
      getRuntimeValue.mockReturnValue(3);

      const result = await triggerDominateBeast(makeSpell(), { targetName: 'Goblin' }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('not a Beast');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', 'spell_slots_level_4', 4, campaignName);
    });

    it('defaults to beast if monster data unavailable', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Unknown', type: 'npc' }],
      });
      getMonsterData.mockRejectedValue(new Error('not found'));

      await triggerDominateBeast(makeSpell(), { targetName: 'Unknown' }, makePlayerStats(), campaignName, null);

      expect(executeHandler).toHaveBeenCalled();
    });
  });

  describe('combat advantage', () => {
    it('passes advantage=true when target is not at full health', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestCaster' },
          { name: 'Wolf', type: 'npc', currentHp: 5, maxHp: 10 },
        ],
      });
      getMonsterData.mockResolvedValue({ type: 'Beast' });

      await triggerDominateBeast(makeSpell(), { targetName: 'Wolf' }, makePlayerStats(), campaignName, null);

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
        creatures: [{ name: 'Wolf', type: 'npc', currentHp: 10, maxHp: 10 }],
      });
      getMonsterData.mockResolvedValue({ type: 'Beast' });

      // Target is at full health — no advantage
      await triggerDominateBeast(makeSpell(), { targetName: 'Wolf' }, makePlayerStats(), campaignName, null);

      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          automation: expect.objectContaining({ advantage: false }),
        }),
        makePlayerStats(),
        campaignName,
        null,
      );
    });

    it('passes advantage=false when target has no HP data', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Wolf', type: 'npc' }],
      });
      getMonsterData.mockResolvedValue({ type: 'Beast' });

      await triggerDominateBeast(makeSpell(), { targetName: 'Wolf' }, makePlayerStats(), campaignName, null);

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
    it('builds action with correct type and saveDc', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Wolf', type: 'npc' }] });
      getMonsterData.mockResolvedValue({ type: 'Beast' });

      await triggerDominateBeast(makeSpell(), { targetName: 'Wolf', spellSaveDc: 16 }, makePlayerStats(), campaignName, null);

      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Dominate Beast',
          automation: expect.objectContaining({
            type: 'dominate_beast',
            saveDc: 16,
            targetName: 'Wolf',
          }),
          spell: expect.any(Object),
          spellSlotLevel: 4,
        }),
        makePlayerStats(),
        campaignName,
        null,
      );
    });
  });

  describe('error handling', () => {
    it('returns error popup when handler throws', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Wolf', type: 'npc' }] });
      getMonsterData.mockResolvedValue({ type: 'Beast' });
      executeHandler.mockRejectedValue(new Error('handler failed'));

      const result = await triggerDominateBeast(makeSpell(), { targetName: 'Wolf' }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Failed to execute');
    });
  });
});
