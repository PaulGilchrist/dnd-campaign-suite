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
  removeFrightenedOnDamage,
} from './avengingAngelHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rollD20 } from '../../../dice/diceRoller.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import utils from '../../../ui/utils.js';

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
    it('should return popup and clear state when already active', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelActive') return true;
        if (key === 'activeBuffs') return [
          { name: 'Other Buff', effect: 'other' },
          { name: 'Avenging Angel', effect: 'avenging_angel_flight' },
        ];
        if (key === 'avengingAngelAuraTargets') return ['Target1'];
        return null;
      });

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Avenging Angel ended.');
      expect(result.payload.automationType).toBe('avenging_angel');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelActive', false, campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestPaladin',
        'activeBuffs',
        [{ name: 'Other Buff', effect: 'other' }],
        campaignName,
      );
      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
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

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('activated');
      expect(result.payload.description).toContain('Fly Speed 60 feet');
      expect(result.payload.description).toContain('hover');
      expect(result.payload.description).toContain('Frightful Aura');
      expect(result.payload.automationType).toBe('avenging_angel');
      expect(result.payload.automation).toEqual(makeAction().automation);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelActive', true, campaignName);
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

  describe('Frightful Aura - NPC handling', () => {
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
  });

  describe('Frightful Aura - storage', () => {
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

describe('avengingAngelHandler.removeFrightenedOnDamage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReset();
    getCombatContext.mockReset();
    setRuntimeValue.mockReset();
  });

  it('should remove frightened and clear from aura targets', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelAuraTargets') return ['Goblin'];
      if (key === 'activeConditions') return ['frightened', 'blinded', 'poisoned'];
      return null;
    });
    getCombatContext.mockResolvedValue({
      creatures: [{
        name: 'Goblin',
        conditions: [{ key: 'frightened' }, { key: 'blinded' }, { key: 'poisoned' }],
      }],
    });

    await removeFrightenedOnDamage('TestPaladin', 'Goblin', campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['blinded', 'poisoned'], campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
  });

  it('should remove target from aura targets list preserving others', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelAuraTargets') return ['Goblin1', 'Goblin2', 'Goblin3'];
      if (key === 'activeConditions') return ['frightened'];
      return null;
    });
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin2', conditions: [{ key: 'frightened' }] }],
    });

    await removeFrightenedOnDamage('TestPaladin', 'Goblin2', campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', ['Goblin1', 'Goblin3'], campaignName);
  });
});

