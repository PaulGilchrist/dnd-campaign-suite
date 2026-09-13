// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(),
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../ui/utils.js', () => ({
  default: {
    guid: vi.fn(),
    getName: vi.fn((n) => n),
  },
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn().mockReturnValue([]),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn().mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve({ success: false, roll: 12, total: 15 }),
  }),
  buildSaveDc: vi.fn().mockReturnValue(14),
}));

import { handle } from './avengingAngelHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rollD20 } from '../../../dice/diceRoller.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import utils from '../../../ui/utils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { createSaveListener } from '../../../automation/common/savePrompt.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestPaladin',
    level: 7,
    proficiency: 3,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Avenging Angel',
    automation: { type: 'avenging_angel', flySpeed: 60, hover: false, ...automation },
  };
}

describe('avengingAngelHandler.handle - frightfulAura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllyList.mockReturnValue([]);
    isWithinRange.mockResolvedValue(true);
  });

  describe('creature filtering', () => {
    it('should skip allies, player name, and out-of-range creatures', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getAllyList.mockReturnValue(['FriendlyNPC']);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'FriendlyNPC', type: 'npc', saveBonuses: { wis: 0 }, conditions: [] },
          { name: 'TestPaladin', type: 'npc', saveBonuses: { wis: 0 }, conditions: [] },
          { name: 'CloseEnemy', type: 'npc', saveBonuses: { wis: 0 }, conditions: [] },
          { name: 'FarEnemy', type: 'npc', saveBonuses: { wis: 0 }, conditions: [] },
        ],
      });
      isWithinRange.mockImplementation(async (source, target) => target === 'CloseEnemy');
      rollD20.mockReturnValue(1);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendSaveResult).not.toHaveBeenCalledWith(campaignName, 'FriendlyNPC', expect.anything());
      expect(sendSaveResult).not.toHaveBeenCalledWith(campaignName, 'TestPaladin', expect.anything());
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'CloseEnemy', expect.anything());
      expect(sendSaveResult).not.toHaveBeenCalledWith(campaignName, 'FarEnemy', expect.anything());
    });

    it('should skip all creatures when all are out of range', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', saveBonuses: { wis: 0 }, conditions: [] },
        ],
      });
      isWithinRange.mockResolvedValue(false);
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendSaveResult).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestPaladin',
        'avengingAngelAuraTargets',
        [],
        campaignName,
      );
    });
  });

  describe('NPC save resolution', () => {
    it('should apply frightened and addExpiration when NPC fails save', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', saveBonuses: { wis: 0 }, conditions: [] },
        ],
      });
      rollD20.mockReturnValue(5);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // saveDc = 8 + 3 + 3 = 14, roll 5 + 0 = 5 < 14 = fail
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        success: false,
        roll: 5,
        saveBonus: 0,
        rawRolls: [5, 5],
      }));
      expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestPaladin', targetName: 'Goblin', effects: expect.any(Array), campaignName });
    });

    it('should send save result but not apply frightened when NPC succeeds', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', saveBonuses: { wis: 20 }, conditions: [] },
        ],
      });
      rollD20.mockReturnValue(1);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // saveDc = 8 + 3 + 3 = 14, roll 1 + 20 = 21 >= 14 = success
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        success: true,
      }));
      expect(addExpiration).not.toHaveBeenCalled();
    });

    it('should handle missing saveBonuses and fallback to wisdom key', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });

      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'NoBonusGoblin', type: 'npc', conditions: [] },
          { name: 'WisdomGoblin', type: 'npc', saveBonuses: { wisdom: 5 }, conditions: [] },
        ],
      });
      rollD20.mockReturnValue(1);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // NoBonusGoblin: saveBonus defaults to 0, roll 1 + 0 = 1 < 14 = fail
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'NoBonusGoblin', expect.objectContaining({
        success: false,
        saveBonus: 0,
      }));
      // WisdomGoblin: saveBonus from wisdom key = 5, roll 1 + 5 = 6 < 14 = fail
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'WisdomGoblin', expect.objectContaining({
        success: false,
        saveBonus: 5,
      }));
    });
  });

  describe('storage', () => {
    it('should store only failed NPCs when mixing allies, successful, and failed NPCs', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getAllyList.mockReturnValue(['Ally1', 'Ally2']);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally1', type: 'npc', conditions: [] },
          { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 0 }, conditions: [] },
          { name: 'Ally2', type: 'npc', conditions: [] },
          { name: 'Goblin2', type: 'npc', saveBonuses: { wis: 20 }, conditions: [] },
          { name: 'Goblin3', type: 'npc', saveBonuses: { wis: 1 }, conditions: [] },
        ],
      });
      rollD20.mockReturnValue(1);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Ally1, Ally2 skipped; Goblin1 fails (1<14); Goblin2 succeeds (21>=14); Goblin3 fails (2<14)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestPaladin',
        'avengingAngelAuraTargets',
        ['Goblin1', 'Goblin3'],
        campaignName,
      );
    });
  });

  describe('player creature handling', () => {
    it('should apply condition and log save_result when player fails save', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'EnemyPlayer', type: 'player' },
        ],
      });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      vi.mocked(createSaveListener).mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false, roll: 5, total: 8 }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestPaladin', targetName: 'EnemyPlayer', effects: expect.any(Array), campaignName });
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'EnemyPlayer',
        success: false,
      }));
    });

    it('should log save_result entry when player succeeds on WIS save', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'EnemyPlayer', type: 'player' },
        ],
      });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      vi.mocked(createSaveListener).mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: true, roll: 15, total: 18 }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        targetName: 'EnemyPlayer',
        saveType: 'WIS',
        saveDc: 14,
        dcSuccess: false,
      }));
      expect(sendSaveResult).not.toHaveBeenCalled();
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'EnemyPlayer',
        success: true,
        saveType: 'WIS',
        saveDc: 14,
      }));
      expect(addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle createSaveListener promise rejection without throwing', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'EnemyPlayer', type: 'player' },
        ],
      });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      vi.mocked(createSaveListener).mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.reject(new Error('save listener error')),
      });

      await expect(
        handle(makeAction(), makePlayerStats(), campaignName, null)
      ).resolves.toBeDefined();

      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });
});
