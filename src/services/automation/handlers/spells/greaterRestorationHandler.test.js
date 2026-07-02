// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyGreaterRestoration } from './greaterRestorationHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import storage from '../../../ui/storage.js';

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Greater Restoration',
    automation: { type: 'greater_restoration', ...automation },
  };
}

function makeCombatContext(creatures) {
  return {
    creatures: creatures || [
      { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
      { name: 'TestCaster', gridX: 5, gridY: 10 },
    ],
    players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
    placedItems: [],
  };
}

describe('greaterRestorationHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('should return automation_info popup when no combat context exists', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Greater Restoration');
      expect(result.payload.description).toContain('No combat context found');
    });

    it('should return automation_info popup when combat context is undefined', async () => {
      getCombatContext.mockResolvedValue(undefined);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });
  });

  describe('creature targets', () => {
    it('should exclude the caster from creature targets', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext());
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('greater_restoration_selection');
      expect(result.payload.creatureTargets).toEqual(['Goblin', 'Orc']);
    });

    it('should return empty creature targets when only the caster exists', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext([{ name: 'TestCaster', gridX: 5, gridY: 10 }]));
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('should return empty creature targets when creatures array is empty', async () => {
      getCombatContext.mockResolvedValue({ creatures: [], players: [], placedItems: [] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('should include range from automation config', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext());
      const result = await handle(makeAction({ range: '30 ft' }), makePlayerStats(), campaignName, null);

      expect(result.payload.range).toBe('30 ft');
    });

    it('should default range to Touch when not specified', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext());
      const result = await handle(makeAction({}), makePlayerStats(), campaignName, null);

      expect(result.payload.range).toBe('Touch');
    });

    it('should pass automation object in payload', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext());
      const auto = { range: '60 ft', custom: true };
      const result = await handle(makeAction(auto), makePlayerStats(), campaignName, null);

      expect(result.payload.automation.range).toBe('60 ft');
      expect(result.payload.automation.custom).toBe(true);
    });

    it('should use empty object when action has no automation property', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext());
      const result = await handle({ name: 'Greater Restoration' }, makePlayerStats(), campaignName, null);

      expect(result.payload.range).toBe('Touch');
      expect(result.payload.automation).toEqual({});
    });
  });
});

describe('greaterRestorationHandler.applyGreaterRestoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('early return paths', () => {
    it('should return null when result is null', async () => {
      const result = await applyGreaterRestoration(makeAction(), makePlayerStats(), campaignName, null, null);
      expect(result).toBeNull();
    });

    it('should return null when result is undefined', async () => {
      const result = await applyGreaterRestoration(makeAction(), makePlayerStats(), campaignName, null, undefined);
      expect(result).toBeNull();
    });

    it('should return null when result has no targetName', async () => {
      const result = await applyGreaterRestoration(makeAction(), makePlayerStats(), campaignName, null, { selections: [] });
      expect(result).toBeNull();
    });

    it('should return null when result targetName is empty string', async () => {
      const result = await applyGreaterRestoration(makeAction(), makePlayerStats(), campaignName, null, { targetName: '', selections: [] });
      expect(result).toBeNull();
    });
  });

  describe('exhaustion removal', () => {
    it('should reduce exhaustion level by 1', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'exhaustionLevel') return 2;
        return null;
      });
      setRuntimeValue.mockResolvedValue(undefined);

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'exhaustion' }] },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'exhaustionLevel', 1, campaignName);
      expect(result.payload.description).toContain('Exhaustion level');
    });

    it('should not modify when exhaustion level is 0', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'exhaustionLevel') return 0;
        return null;
      });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'exhaustion' }] },
      );

      expect(result.payload.description).toContain('No removable effects found');
    });

    it('should not call setRuntimeValue when exhaustion level is falsy', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'exhaustionLevel') return undefined;
        return null;
      });

      await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'exhaustion' }] },
      );

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('condition removal', () => {
    it('should remove a matching condition from activeConditions', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['Paralyzed', 'Frightened'];
        return null;
      });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin', conditions: [{ key: 'Paralyzed' }] }] });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'condition', condition: 'Paralyzed' }] },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['Frightened'], campaignName);
      expect(result.payload.description).toContain('Paralyzed condition');
    });

    it('should not modify conditions when condition is not present', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['Frightened'];
        return null;
      });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'condition', condition: 'Paralyzed' }] },
      );

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No removable effects found');
    });

    it('should update creature conditions via setRuntimeValue and not persist via storage', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['Paralyzed'];
        return null;
      });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin', conditions: [{ key: 'Paralyzed' }, { key: 'Frightened' }] }] });

      await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'condition', condition: 'Paralyzed' }] },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', [], campaignName);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('should handle missing creature in combat summary gracefully', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['Paralyzed'];
        return null;
      });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Orc', conditions: [] }] });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'condition', condition: 'Paralyzed' }] },
      );

      expect(result.payload.description).toContain('Paralyzed condition');
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('should handle missing combat summary gracefully', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['Paralyzed'];
        return null;
      });
      getCombatContext.mockResolvedValue(null);

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'condition', condition: 'Paralyzed' }] },
      );

      expect(result.payload.description).toContain('Paralyzed condition');
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive condition matching', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['paralyzed'];
        return null;
      });

      await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'condition', condition: 'Paralyzed' }] },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', [], campaignName);
    });
  });

  describe('curse removal', () => {
    it('should remove cursed buffs and log each removal', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Sword' }, { type: 'buff', name: 'Shield' }];
        return null;
      });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'curse' }] },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeBuffs', [{ type: 'buff', name: 'Shield' }], campaignName);
      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ type: 'buff', action: 'removed', buffName: 'Cursed Sword', reason: 'Greater Restoration' }),
      );
      expect(result.payload.description).toContain('Curse');
    });

    it('should remove buffs with cursed flag set to true', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeBuffs') return [{ cursed: true, name: 'Hex' }];
        return null;
      });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'curse' }] },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeBuffs', [], campaignName);
      expect(result.payload.description).toContain('Curse');
    });

    it('should skip when no cursed buffs exist', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeBuffs') return [{ type: 'buff', name: 'Shield' }];
        return null;
      });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'curse' }] },
      );

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No removable effects found');
    });

    it('should skip when activeBuffs is empty array', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeBuffs') return [];
        return null;
      });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'curse' }] },
      );

      expect(result.payload.description).toContain('No removable effects found');
    });
  });

  describe('ability reduction restoration', () => {
    it('should restore all reduced ability scores', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'abilityReductions') return { strength: { original: 18, current: 10 } };
        if (prop === 'strength') return 10;
        return null;
      });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'ability_reduction' }] },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'strength_original', 18, campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'strength', 18, campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'abilityReductions', {}, campaignName);
      expect(result.payload.description).toContain('Ability score reduction');
    });

    it('should restore multiple ability reductions', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'abilityReductions') return { strength: { original: 18, current: 10 }, dexterity: { original: 16, current: 8 } };
        if (prop === 'strength') return 10;
        if (prop === 'dexterity') return 8;
        return null;
      });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'ability_reduction' }] },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'strength_original', 18, campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'dexterity_original', 16, campaignName);
      expect(result.payload.description).toContain('strength, dexterity');
    });

    it('should skip restoring an ability that already equals original', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'abilityReductions') return { strength: { original: 18, current: 10 } };
        if (prop === 'strength') return 18;
        return null;
      });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'ability_reduction' }] },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'strength_original', 18, campaignName);
      expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'strength', 18, campaignName);
      expect(result.payload.description).toContain('Ability score reduction');
    });

    it('should skip when no ability reductions exist', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'abilityReductions') return {};
        return null;
      });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'ability_reduction' }] },
      );

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No removable effects found');
    });
  });

  describe('hp max reduction restoration', () => {
    it('should restore hp max and adjust current hp', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'hpMaxReduction') return 5;
        if (prop === 'hitPoints') return 20;
        if (prop === 'currentHitPoints') return 15;
        return null;
      });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'hp_max_reduction' }] },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'hitPoints', 25, campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'currentHitPoints', 20, campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'hpMaxReduction', 0, campaignName);
      expect(result.payload.description).toContain('Hit Point maximum reduction');
    });

    it('should clamp current hp to new hp max when it would exceed', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'hpMaxReduction') return 5;
        if (prop === 'hitPoints') return 20;
        if (prop === 'currentHitPoints') return 19;
        return null;
      });

      await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'hp_max_reduction' }] },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'hitPoints', 25, campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'currentHitPoints', 24, campaignName);
    });

    it('should default current hp to base hp when missing', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'hpMaxReduction') return 5;
        if (prop === 'hitPoints') return 20;
        return null;
      });

      await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'hp_max_reduction' }] },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'hitPoints', 25, campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'currentHitPoints', 25, campaignName);
    });

    it('should skip when hpMaxReduction is 0', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'hpMaxReduction') return 0;
        return null;
      });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'hp_max_reduction' }] },
      );

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No removable effects found');
    });
  });

  describe('logging', () => {
    it('should log ability_use and spell_effect entries when effects are removed', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['Paralyzed'];
        return null;
      });

      await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'condition', condition: 'Paralyzed' }] },
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: 'Greater Restoration',
          targetName: 'Goblin',
        }),
      );

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'spell_effect',
          spellName: 'Greater Restoration',
          targetName: 'Goblin',
        }),
      );
    });

    it('should not log when no effects were removed', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return [];
        if (prop === 'exhaustionLevel') return 0;
        if (prop === 'activeBuffs') return [];
        if (prop === 'abilityReductions') return {};
        if (prop === 'hpMaxReduction') return 0;
        return null;
      });

      await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'condition', condition: 'Paralyzed' }] },
      );

      expect(addEntry).not.toHaveBeenCalled();
      expect(postLogEntry).not.toHaveBeenCalled();
    });
  });

  describe('no removable effects', () => {
    it('should return info popup with no removable effects message when all properties are empty', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return [];
        if (prop === 'exhaustionLevel') return 0;
        if (prop === 'activeBuffs') return [];
        if (prop === 'abilityReductions') return {};
        if (prop === 'hpMaxReduction') return 0;
        return null;
      });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin', selections: [{ type: 'condition', condition: 'Paralyzed' }] },
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No removable effects found');
    });
  });

  describe('multiple selections', () => {
    it('should process all selections and apply all changes', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'exhaustionLevel') return 1;
        if (prop === 'activeConditions') return ['Paralyzed'];
        return null;
      });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        {
          targetName: 'Goblin',
          selections: [
            { type: 'exhaustion' },
            { type: 'condition', condition: 'Paralyzed' },
          ],
        },
      );

      expect(result.payload.description).toContain('Exhaustion level');
      expect(result.payload.description).toContain('Paralyzed condition');
    });

    it('should process mixed selections including curse and ability reduction', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeBuffs') return [{ type: 'cursed', name: 'Hex' }];
        if (prop === 'abilityReductions') return { strength: { original: 18, current: 10 } };
        if (prop === 'strength') return 10;
        return null;
      });

      const result = await applyGreaterRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        {
          targetName: 'Goblin',
          selections: [
            { type: 'curse' },
            { type: 'ability_reduction' },
          ],
        },
      );

      expect(result.payload.description).toContain('Curse');
      expect(result.payload.description).toContain('Ability score reduction');
    });
  });
});
