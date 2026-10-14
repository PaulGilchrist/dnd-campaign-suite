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

import { triggerDominatePerson } from './dominatePersonService.js';
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
    name: 'Dominate Person',
    level: 5,
    ...overrides,
  };
}

describe('dominatePersonService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info', name: 'Dominate Person', description: 'test' } });
    getCombatContext.mockResolvedValue({ creatures: [] });
  });

  describe('spell matching', () => {
    it('returns null for non-dominate-person spells', async () => {
      const result = await triggerDominatePerson(makeSpell({ name: 'Fireball' }), {}, makePlayerStats(), campaignName, null);
      expect(result).toBeNull();
    });

    it('matches case-insensitively', async () => {
      const result = await triggerDominatePerson(makeSpell({ name: 'dominate person' }), {}, makePlayerStats(), campaignName, null);
      expect(result).not.toBeNull();
    });
  });

  describe('target resolution', () => {
    it('returns popup when no target and no creatures in combat', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await triggerDominatePerson(makeSpell(), {}, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('logs error when no target selected', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestCaster' },
          { name: 'Villager' },
        ],
      });
      getTargetFromAttacker.mockReturnValue(null);
      const consoleSpy = vi.spyOn(console, 'error');

      const result = await triggerDominatePerson(makeSpell(), {}, makePlayerStats(), campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[dominatePersonService] No target selected for Dominate Person'),
      );
      expect(result).toEqual({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Dominate Person', description: 'No target selected for Dominate Person.' },
      });
      consoleSpy.mockRestore();
    });
  });

  describe('target type check', () => {
    it('blocks non-humanoid targets', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Wolf', type: 'npc' }],
      });
      getMonsterData.mockResolvedValue({ type: 'Beast' });

      const result = await triggerDominatePerson(makeSpell(), { targetName: 'Wolf' }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('not a Humanoid');
      expect(executeHandler).not.toHaveBeenCalled();
    });

    it('allows humanoid targets', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Villager', type: 'npc' }],
      });
      getMonsterData.mockResolvedValue({ type: 'Humanoid' });

      await triggerDominatePerson(makeSpell(), { targetName: 'Villager' }, makePlayerStats(), campaignName, null);

      expect(executeHandler).toHaveBeenCalled();
    });

    it('allows player characters (always humanoid)', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestCaster', type: 'player' },
          { name: 'Ally', type: 'player' },
        ],
      });

      await triggerDominatePerson(makeSpell(), { targetName: 'Ally' }, makePlayerStats(), campaignName, null);

      expect(executeHandler).toHaveBeenCalled();
    });

    it('refunds spell slot when target is not a Humanoid', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Wolf', type: 'npc' }],
      });
      getMonsterData.mockResolvedValue({ type: 'Beast' });
      getRuntimeValue.mockReturnValue(2);

      const result = await triggerDominatePerson(makeSpell(), { targetName: 'Wolf' }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('not a Humanoid');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', 'spell_slots_level_5', 3, campaignName);
    });

    it('defaults to humanoid if monster data unavailable', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Unknown', type: 'npc' }],
      });
      getMonsterData.mockRejectedValue(new Error('not found'));

      await triggerDominatePerson(makeSpell(), { targetName: 'Unknown' }, makePlayerStats(), campaignName, null);

      expect(executeHandler).toHaveBeenCalled();
    });
  });

  describe('combat advantage', () => {
    it('never grants advantage from the old full-health proxy (RAW requires "you or allies fighting it" — no such signal exists)', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestCaster' },
          { name: 'Villager', type: 'npc', currentHp: 5, maxHp: 10 },
        ],
      });
      getMonsterData.mockResolvedValue({ type: 'Humanoid' });

      await triggerDominatePerson(makeSpell(), { targetName: 'Villager' }, makePlayerStats(), campaignName, null);

      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          automation: expect.objectContaining({ advantage: false }),
        }),
        makePlayerStats(),
        campaignName,
        null,
      );
    });

    it('passes advantage=false when target is at full health', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Villager', type: 'npc', currentHp: 10, maxHp: 10 }],
      });
      getMonsterData.mockResolvedValue({ type: 'Humanoid' });

      // Target is at full health — no advantage
      await triggerDominatePerson(makeSpell(), { targetName: 'Villager' }, makePlayerStats(), campaignName, null);

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
        creatures: [{ name: 'Villager', type: 'npc' }],
      });
      getMonsterData.mockResolvedValue({ type: 'Humanoid' });

      await triggerDominatePerson(makeSpell(), { targetName: 'Villager' }, makePlayerStats(), campaignName, null);

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
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Villager', type: 'npc' }] });
      getMonsterData.mockResolvedValue({ type: 'Humanoid' });

      await triggerDominatePerson(makeSpell(), { targetName: 'Villager', spellSaveDc: 16 }, makePlayerStats(), campaignName, null);

      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Dominate Person',
          automation: expect.objectContaining({
            type: 'dominate_person',
            saveDc: 16,
            targetName: 'Villager',
          }),
          spell: expect.any(Object),
          spellSlotLevel: 5,
        }),
        makePlayerStats(),
        campaignName,
        null,
      );
    });
  });

  describe('error handling', () => {
    it('returns error popup when handler throws', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Villager', type: 'npc' }] });
      getMonsterData.mockResolvedValue({ type: 'Humanoid' });
      executeHandler.mockRejectedValue(new Error('handler failed'));

      const result = await triggerDominatePerson(makeSpell(), { targetName: 'Villager' }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Failed to execute');
    });
  });
});
