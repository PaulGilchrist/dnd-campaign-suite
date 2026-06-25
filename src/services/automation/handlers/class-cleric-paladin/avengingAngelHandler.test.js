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

import {
  handle,
  isAuraTarget,
  isActive,
  removeFrightenedOnDamage,
  handleSaveResult,
} from './avengingAngelHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rollD20 } from '../../../dice/diceRoller.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import utils from '../../../ui/utils.js';
import storage from '../../../ui/storage.js';

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

  describe('deactivation (toggle off)', () => {
    it('should return popup indicating deactivation when already active', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return true;
        if (key === 'activeBuffs') return [{ name: 'Avenging Angel', effect: 'avenging_angel_flight' }];
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Avenging Angel ended.');
      expect(result.payload.automationType).toBe('avenging_angel');
    });

    it('should set avengingAngelActive to false', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return true;
        if (key === 'activeBuffs') return [];
        return null;
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelActive', false, campaignName);
    });

    it('should remove fly speed buff when toggling off', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return true;
        if (key === 'activeBuffs') return [
          { name: 'Other Buff', effect: 'other' },
          { name: 'Avenging Angel', effect: 'avenging_angel_flight' },
        ];
        return null;
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestPaladin',
        'activeBuffs',
        [{ name: 'Other Buff', effect: 'other' }],
        campaignName,
      );
    });

    it('should filter out avenging_angel_flight effect keeping other buffs', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return true;
        if (key === 'activeBuffs') return [
          { name: 'Avenging Angel', effect: 'avenging_angel_flight' },
          { name: 'Divine Shield', effect: 'divine_shield' },
        ];
        return null;
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestPaladin',
        'activeBuffs',
        [{ name: 'Divine Shield', effect: 'divine_shield' }],
        campaignName,
      );
    });

    it('should clear aura targets on deactivation', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return true;
        if (key === 'activeBuffs') return [];
        if (key === 'avengingAngelAuraTargets') return ['Target1'];
        return null;
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
    });

    it('should call addEntry on deactivation', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return true;
        if (key === 'activeBuffs') return [];
        return null;
      });

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestPaladin',
        abilityName: 'Avenging Angel',
        description: 'Avenging Angel ended.',
        timestamp: now,
      }));
    });
  });

  describe('activation', () => {
    it('should set avengingAngelActive to true', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({ creatures: [] });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelActive', true, campaignName);
    });

    it('should add flight buff with default flySpeed 60 and hover false', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
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
          expect.objectContaining({ flySpeed: 60, hover: false, duration: '10_minutes' }),
        ]),
        campaignName,
      );
    });

    it('should add flight buff with custom flySpeed from automation', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({ creatures: [] });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      const customAction = makeAction({ flySpeed: 50 });
      await handle(customAction, makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestPaladin',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ flySpeed: 50 }),
        ]),
        campaignName,
      );
    });

    it('should use hover true from automation when set', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({ creatures: [] });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      const customAction = makeAction({ hover: true });
      await handle(customAction, makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestPaladin',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ hover: true }),
        ]),
        campaignName,
      );
    });

    it('should clear aura targets on activation', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        if (key === 'avengingAngelAuraTargets') return ['Target1'];
        return null;
      });
      getCombatContext.mockResolvedValue({ creatures: [] });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
    });

    it('should call addEntry on activation with description', async () => {
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

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestPaladin',
        abilityName: 'Avenging Angel',
        timestamp: now,
      }));
    });

    it('should return popup with activation description mentioning flight and hover', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({ creatures: [] });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('activated');
      expect(result.payload.description).toContain('Fly Speed 60 feet');
      expect(result.payload.description).toContain('hover');
      expect(result.payload.description).toContain('Frightful Aura');
      expect(result.payload.automationType).toBe('avenging_angel');
      expect(result.payload.automation).toEqual(makeAction().automation);
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

  describe('Frightful Aura - NPC handling', () => {
    it('should send save result for NPCs that fail the save', async () => {
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

      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        success: false,
        roll: 5,
        saveBonus: 2,
      }));
    });

    it('should send save result for NPCs that succeed on the save', async () => {
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
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // saveDc = 8 + 3 + 3 = 14, roll 20 + 2 = 22 >= 14 = success
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        success: true,
        roll: 20,
        total: 22,
      }));
    });

    it('should apply frightened condition and addExpiration when NPC fails save', async () => {
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
      rollD20.mockReturnValue(1);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // saveDc = 8 + 3 + 3 = 14, roll 1 + 0 = 1 < 14 = fail
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        success: false,
      }));
      expect(addExpiration).toHaveBeenCalledWith(
        'TestPaladin',
        'Goblin',
        [{ type: 'frightened', condition: 'frightened' }, { type: 'avenging_angel_aura' }],
        campaignName,
        10,
      );
    });

    it('should NOT apply frightened or addExpiration when NPC succeeds', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockImplementation(() => Promise.resolve({
        creatures: [
          { name: 'Goblin', type: 'npc', saveBonuses: { wis: 20 }, conditions: [] },
        ],
      }));
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

    it('should apply addExpiration even when creature already has frightened (source does not check)', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockImplementation(() => Promise.resolve({
        creatures: [
          { name: 'Goblin', type: 'npc', saveBonuses: { wis: 0 }, conditions: [{ key: 'frightened' }] },
        ],
      }));
      rollD20.mockReturnValue(1);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // saveDc = 8 + 3 + 3 = 14, roll 1 + 0 = 1 < 14 = fail
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        success: false,
      }));
      // Source calls addExpiration unconditionally on fail, even if creature already frightened
      expect(addExpiration).toHaveBeenCalled();
    });

    it('should handle creature with wis fallback in saveBonuses', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', saveBonuses: { wisdom: 5 }, conditions: [] },
        ],
      });
      rollD20.mockReturnValue(10);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // saveDc = 8 + 3 + 3 = 14, roll 10 + 5 = 15 >= 14 = success
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        success: true,
        saveBonus: 5,
      }));
    });

    it('should default saveBonus to 0 when saveBonuses is missing', async () => {
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

      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        saveBonus: 0,
      }));
    });
  });

  describe('Frightful Aura - player creature handling', () => {
    it('should send save prompt for player-type creatures', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally', type: 'player' },
        ],
      });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Ally', expect.objectContaining({
        success: false,
        roll: 0,
      }));
    });

    it('should skip self creature in Frightful Aura', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestPaladin', type: 'player' },
        ],
      });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendSaveResult).not.toHaveBeenCalled();
    });

    it('should treat creatures without type as npc', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'UnknownCreature', conditions: [] },
        ],
      });
      rollD20.mockReturnValue(1);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Should be treated as NPC (no type → isNpc = true)
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'UnknownCreature', expect.objectContaining({
        success: false,
      }));
    });
  });

  describe('Frightful Aura - storage', () => {
    it('should store affected NPC targets that failed in runtime', async () => {
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
      rollD20.mockReturnValue(1);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', ['Goblin'], campaignName);
    });

    it('should store player creature names in runtime', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally', type: 'player' },
        ],
      });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', ['Ally'], campaignName);
    });

    it('should store only failed NPCs and player creatures, not successful NPCs', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 0 }, conditions: [] },
          { name: 'Goblin2', type: 'npc', saveBonuses: { wis: 20 }, conditions: [] },
          { name: 'Ally', type: 'player' },
        ],
      });
      rollD20.mockReturnValue(1);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Goblin1 fails (1+0 < 14), Goblin2 succeeds (1+20 >= 14), Ally is player (always stored)
      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', ['Goblin1', 'Ally'], campaignName);
    });
  });

  describe('Frightful Aura - edge cases', () => {
    it('should handle no combat context gracefully', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendSaveResult).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
    });

    it('should handle combat context with no creatures', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({ creatures: [] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendSaveResult).not.toHaveBeenCalled();
      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
    });

    it('should handle combat context with no creatures property', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({});

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendSaveResult).not.toHaveBeenCalled();
    });

    it('should build save DC from chaBonus + proficiency + 8', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'npc', saveBonuses: { wis: 2 }, conditions: [] }],
      });
      rollD20.mockReturnValue(20);
      getAbilityModifier.mockReturnValue(4);
      utils.guid.mockReturnValue('test-guid');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // saveDc = 8 + 4 + 3 = 15, roll 20 + 2 = 22 >= 15 = success
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        success: true,
      }));
    });

    it('should default proficiency to 0 when missing from playerStats', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return false;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'npc', saveBonuses: { wis: 0 }, conditions: [] }],
      });
      rollD20.mockReturnValue(1);
      getAbilityModifier.mockReturnValue(3);
      utils.guid.mockReturnValue('test-guid');

      const noProfStats = makePlayerStats({ proficiency: undefined });
      await handle(makeAction(), noProfStats, campaignName, null);

      // saveDc = 8 + 3 + 0 = 11, roll 1 + 0 = 1 < 11 = fail
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        success: false,
      }));
    });
  });
});

describe('avengingAngelHandler.isAuraTarget', () => {
  it('should return true when target is in aura targets', () => {
    getRuntimeValue.mockReturnValue(['Goblin1', 'Goblin2']);

    expect(isAuraTarget('TestPaladin', 'Goblin1', campaignName)).toBe(true);
  });

  it('should return false when target is not in aura targets', () => {
    getRuntimeValue.mockReturnValue(['Goblin1', 'Goblin2']);

    expect(isAuraTarget('TestPaladin', 'Goblin3', campaignName)).toBe(false);
  });

  it('should return false when aura targets is empty', () => {
    getRuntimeValue.mockReturnValue([]);

    expect(isAuraTarget('TestPaladin', 'Goblin1', campaignName)).toBe(false);
  });

  it('should return false when aura targets is null', () => {
    getRuntimeValue.mockReturnValue(null);

    expect(isAuraTarget('TestPaladin', 'Goblin1', campaignName)).toBe(false);
  });
});

describe('avengingAngelHandler.isActive', () => {
  it('should return true when active', () => {
    getRuntimeValue.mockReturnValue(true);

    expect(isActive('TestPaladin', campaignName)).toBe(true);
  });

  it('should return false when not active', () => {
    getRuntimeValue.mockReturnValue(false);

    expect(isActive('TestPaladin', campaignName)).toBe(false);
  });

  it('should return false when null', () => {
    getRuntimeValue.mockReturnValue(null);

    expect(isActive('TestPaladin', campaignName)).toBe(false);
  });

  it('should return false for any non-true value', () => {
    getRuntimeValue.mockReturnValue('yes');

    expect(isActive('TestPaladin', campaignName)).toBe(false);
  });
});

describe('avengingAngelHandler.removeFrightenedOnDamage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReset();
    getCombatContext.mockReset();
    storage.set.mockReset();
    setRuntimeValue.mockReset();
  });

  it('should remove frightened from creature in combat context', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelAuraTargets') return ['Goblin'];
      return null;
    });
    getCombatContext.mockResolvedValue({
      creatures: [{
        name: 'Goblin',
        conditions: [{ key: 'frightened' }, { key: 'blinded' }],
      }],
    });

    await removeFrightenedOnDamage('TestPaladin', 'Goblin', campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
  });

  it('should not call storage.set when combat context is null', async () => {
    getRuntimeValue.mockReset().mockImplementation((name, key) => {
      if (key === 'avengingAngelAuraTargets') return ['Goblin'];
      return null;
    });
    getCombatContext.mockReset().mockImplementation(() => Promise.resolve(null));

    await removeFrightenedOnDamage('TestPaladin', 'Goblin', campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('should handle creature without conditions', async () => {
    getRuntimeValue.mockReturnValue(['Goblin']);
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', conditions: undefined }],
    });

    await removeFrightenedOnDamage('TestPaladin', 'Goblin', campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
  });

  it('should only remove frightened condition, not others', async () => {
    getRuntimeValue.mockReturnValue(['Goblin']);
    let cs = {
      creatures: [{
        name: 'Goblin',
        conditions: [{ key: 'frightened' }, { key: 'blinded' }, { key: 'poisoned' }],
      }],
    };
    getCombatContext.mockResolvedValue(cs);

    await removeFrightenedOnDamage('TestPaladin', 'Goblin', campaignName);

    expect(cs.creatures[0].conditions).toEqual([
      { key: 'blinded' },
      { key: 'poisoned' },
    ]);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
  });

  it('should not modify creature if target not in aura targets', async () => {
    getRuntimeValue.mockReset().mockImplementation((name, key) => {
      if (key === 'avengingAngelAuraTargets') return ['OtherCreature'];
      return null;
    });
    getCombatContext.mockResolvedValue({
      creatures: [{
        name: 'Goblin',
        conditions: [{ key: 'frightened' }],
      }],
    });

    await removeFrightenedOnDamage('TestPaladin', 'Goblin', campaignName);

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('should not call storage.set when creature not found in combat context', async () => {
    getRuntimeValue.mockReset().mockReturnValue(['Goblin']);
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'OtherCreature', conditions: [{ key: 'frightened' }] }],
    });

    await removeFrightenedOnDamage('TestPaladin', 'Goblin', campaignName);

    expect(storage.set).not.toHaveBeenCalled();
    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
  });

  it('should remove target from aura targets list', async () => {
    getRuntimeValue.mockReturnValue(['Goblin1', 'Goblin2', 'Goblin3']);
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin2', conditions: [{ key: 'frightened' }] }],
    });

    await removeFrightenedOnDamage('TestPaladin', 'Goblin2', campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', ['Goblin1', 'Goblin3'], campaignName);
  });
});

describe('avengingAngelHandler.handleSaveResult', () => {
  it('should do nothing when event has no detail', () => {
    const event = { detail: null };
    expect(() => handleSaveResult(event)).not.toThrow();
  });

  it('should do nothing when event has no promptId', () => {
    const event = { detail: {} };
    expect(() => handleSaveResult(event)).not.toThrow();
  });

  it('should do nothing when event has detail but no promptId', () => {
    const event = { detail: { someOtherField: 'value' } };
    expect(() => handleSaveResult(event)).not.toThrow();
  });

  it('should be a placeholder that returns early without side effects', () => {
    const event = { detail: { promptId: 'test-prompt' } };
    expect(() => handleSaveResult(event)).not.toThrow();
  });
});
