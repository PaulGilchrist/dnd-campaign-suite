// @improved-by-ai
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
}));

import {
  handle,
  isAuraTarget,
  cleanupAuraTargetOnDamage,
} from './avengingAngelHandler.js';
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

const campaignName = 'TestCampaign';

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

describe('avengingAngelHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('already active popup', () => {
    it('should return popup and NOT change state when already active', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return true;
        if (key === 'activeBuffs') return [
          { name: 'Other Buff', effect: 'other' },
          { name: 'Avenging Angel', effect: 'avenging_angel_flight' },
        ];
        if (key === 'avengingAngelAuraTargets') return ['Target1'];
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Avenging Angel is already active.');
      expect(result.payload.automationType).toBe('avenging_angel');
      expect(result.payload.automation).toEqual(makeAction().automation);
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('second use with spell slot consumption', () => {
    it('should consume a level 5 spell slot and reactivate when already used this rest period', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'avengingAngelRestUsed') return true;
        if (key === 'spell_slots_level_5') return 2;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({ creatures: [] });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Avenging Angel activated by expending a level 5 spell slot!');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'spell_slots_level_5', 1, campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelActive', true, campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestPaladin',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ effect: 'avenging_angel_flight', flySpeed: 60, hover: false }),
        ]),
        campaignName,
      );
      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestPaladin',
        abilityName: 'Avenging Angel',
        description: 'TestPaladin reactivated Avenging Angel by expending a level 5 spell slot.',
        timestamp: now,
      }));
    });

    it('should show cannot be used popup when already used and no level 5 slots available', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'avengingAngelRestUsed') return true;
        if (key === 'spell_slots_level_5') return 0;
        if (key === 'activeBuffs') return [];
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Avenging Angel cannot be used again until a long rest or level 5 spell slot becomes available.');
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('first use', () => {
    it('should set restUsed flag on first use', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({ creatures: [] });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelRestUsed', true, campaignName);
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestPaladin',
        abilityName: 'Avenging Angel',
        description: 'Avenging Angel activated — Flight 60 ft (hover), Frightful Aura active for 10 minutes.',
        timestamp: now,
      }));
    });
  });

  describe('activation', () => {
    it('should return popup and set state when not active', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({ creatures: [] });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('activated');
      expect(result.payload.description).toContain('Fly Speed 60 feet');
      expect(result.payload.description).toContain('hover');
      expect(result.payload.description).toContain('Frightful Aura');
      expect(result.payload.automationType).toBe('avenging_angel');
      expect(result.payload.automation).toEqual(makeAction().automation);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelActive', true, campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelRestUsed', true, campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestPaladin',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ flySpeed: 60, hover: false }),
        ]),
        campaignName,
      );
      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
    });

    it('should use custom flySpeed and hover from automation', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({ creatures: [] });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      const customAction = makeAction({ flySpeed: 50, hover: true });
      await handle(customAction, makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestPaladin',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ flySpeed: 50, hover: true }),
        ]),
        campaignName,
      );
    });

    it('should add existing buffs alongside the new flight buff', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [{ name: 'Divine Shield', effect: 'divine_shield' }];
        return null;
      });
      getCombatContext.mockResolvedValue({ creatures: [] });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestPaladin',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ name: 'Divine Shield', effect: 'divine_shield' }),
          expect.objectContaining({ effect: 'avenging_angel_flight' }),
        ]),
        campaignName,
      );
    });
  });

  describe('Frightful Aura - ally filtering', () => {
    it('should skip creatures in the ally list', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getAllyList.mockReturnValue(['FriendlyNPC']);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'FriendlyNPC', type: 'npc', saveBonuses: { wis: 0 }, conditions: [] },
          { name: 'EnemyNPC', type: 'npc', saveBonuses: { wis: 0 }, conditions: [] },
        ],
      });
      rollD20.mockReturnValue(1);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendSaveResult).not.toHaveBeenCalledWith(campaignName, 'FriendlyNPC', expect.anything());
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'EnemyNPC', expect.anything());
    });
  });

  describe('Frightful Aura - range filtering', () => {
    it('should skip creatures beyond 30 ft aura range', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'CloseEnemy', type: 'npc', saveBonuses: { wis: 0 }, conditions: [] },
          { name: 'FarEnemy', type: 'npc', saveBonuses: { wis: 0 }, conditions: [] },
        ],
      });
      isWithinRange.mockImplementation(async (source, target) => target === 'CloseEnemy');
      rollD20.mockReturnValue(1);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'CloseEnemy', expect.anything());
      expect(sendSaveResult).not.toHaveBeenCalledWith(campaignName, 'FarEnemy', expect.anything());
    });

    it('should skip creatures at the edge if out of range', async () => {
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
    });
  });

  describe('Frightful Aura - NPC handling', () => {
    beforeEach(() => {
      getAllyList.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
    });
    it('should apply frightened and addExpiration when NPC fails save', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', saveBonuses: { wis: 2 }, conditions: [] },
        ],
      });
      rollD20.mockReturnValue(5);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // saveDc = 8 + 3 + 3 = 14, roll 5 + 2 = 7 < 14 = fail
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        success: false,
        roll: 5,
        saveBonus: 2,
      }));
      expect(addExpiration).toHaveBeenCalledWith(
        'TestPaladin',
        'Goblin',
        expect.any(Array),
        campaignName,
      );
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

    it('should handle missing saveBonuses defaulting to 0', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });

      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', conditions: [] },
        ],
      });
      rollD20.mockReturnValue(1);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // saveDc = 8 + 3 + 3 = 14, roll 1 + 0 = 1 < 14 = fail
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        success: false,
        saveBonus: 0,
      }));
    });
  });

  describe('Frightful Aura - player creature handling', () => {
    beforeEach(() => {
      getAllyList.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
    });
    it('should use createSaveListener for player-type creatures', async () => {
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

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        targetName: 'EnemyPlayer',
        saveType: 'WIS',
        saveDc: 14,
        dcSuccess: false,
      }));
      expect(sendSaveResult).not.toHaveBeenCalled();
    });

    it('should apply condition and add to aura targets when player fails save', async () => {
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

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Wait for the async save result handler
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(addExpiration).toHaveBeenCalledWith(
        'TestPaladin',
        'EnemyPlayer',
        expect.any(Array),
        campaignName,
      );
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'EnemyPlayer',
        success: false,
      }));
    });
  });

  describe('Frightful Aura - storage', () => {
    beforeEach(() => {
      getAllyList.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
    });
    it('should store only failed NPCs, not successful NPCs or allies', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getAllyList.mockReturnValue(['Ally']);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 0 }, conditions: [] },
          { name: 'Goblin2', type: 'npc', saveBonuses: { wis: 20 }, conditions: [] },
          { name: 'Ally', type: 'npc', conditions: [] },
        ],
      });
      rollD20.mockReturnValue(1);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Goblin1 fails (1+0 < 14), Goblin2 succeeds (1+20 >= 14), Ally is in ally list (skipped)
      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', ['Goblin1'], campaignName);
    });
  });
});

describe('avengingAngelHandler.isAuraTarget', () => {
  it('should return true when target is in aura targets, false otherwise', () => {
    getRuntimeValue.mockReturnValue(['Goblin1', 'Goblin2']);
    expect(isAuraTarget('TestPaladin', 'Goblin1', campaignName)).toBe(true);
    expect(isAuraTarget('TestPaladin', 'Goblin3', campaignName)).toBe(false);

    getRuntimeValue.mockReturnValue([]);
    expect(isAuraTarget('TestPaladin', 'Goblin1', campaignName)).toBe(false);
  });
});

describe('avengingAngelHandler.cleanupAuraTargetOnDamage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReset();
    getCombatContext.mockReset();
    setRuntimeValue.mockReset();
  });

  it('should clean up aura targets list when target is present', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelAuraTargets') return ['Goblin'];
      return null;
    });

    await cleanupAuraTargetOnDamage('TestPaladin', 'Goblin', campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'condition',
      action: 'removed',
      characterName: 'Goblin',
      condition: 'Frightened',
      reason: 'took damage (Frightful Aura)',
    }));
  });

  it('should remove target from aura targets list preserving others', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelAuraTargets') return ['Goblin1', 'Goblin2', 'Goblin3'];
      return null;
    });

    await cleanupAuraTargetOnDamage('TestPaladin', 'Goblin2', campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', ['Goblin1', 'Goblin3'], campaignName);
  });

  it('should be a no-op when target is not in aura targets', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelAuraTargets') return ['Goblin1', 'Goblin3'];
      return null;
    });

    await cleanupAuraTargetOnDamage('TestPaladin', 'Goblin2', campaignName);

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
