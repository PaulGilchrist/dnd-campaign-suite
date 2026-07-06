// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyRemoveCurse } from './removeCurseHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';

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

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Remove Curse',
    automation: { type: 'remove_curse', ...automation },
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

describe('removeCurseHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('should return automation_info popup when combat context is absent', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Remove Curse');
      expect(result.payload.description).toContain('No combat context found');
    });
  });

  describe('target listing', () => {
    it('should include all creatures except caster in targets', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext());
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [];
        if (prop === 'attunement') return [];
        return [];
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.targets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Goblin' }),
          expect.objectContaining({ name: 'Orc' }),
        ]),
      );
    });

    it('should include self as a target with isSelf flag', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext());
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [];
        if (prop === 'attunement') return [];
        return [];
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const selfTarget = result.payload.targets.find(t => t.isSelf);
      expect(selfTarget).toBeDefined();
      expect(selfTarget.name).toBe('TestCaster');
    });

    it('should exclude caster from non-self creature targets', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext());
      getRuntimeValue.mockImplementation(() => []);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const casterTargets = result.payload.targets.filter(t => t.name === 'TestCaster' && !t.isSelf);
      expect(casterTargets).toHaveLength(0);
    });

    it('should report hasCurse for creatures with cursed buffs', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext());
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs' && name === 'Goblin') return [{ type: 'cursed', name: 'Cursed Amulet' }];
        if (prop === 'activeBuffs') return [];
        if (prop === 'attunement') return [];
        return [];
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const goblinTarget = result.payload.targets.find(t => t.name === 'Goblin');
      expect(goblinTarget.hasCurse).toBe(true);
      expect(goblinTarget.cursedBuffs).toHaveLength(1);
    });

    it('should report hasCurse for creatures with cursed flag on buff', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext());
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs' && name === 'Goblin') return [{ cursed: true, name: 'Hex' }];
        if (prop === 'activeBuffs') return [];
        if (prop === 'attunement') return [];
        return [];
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const goblinTarget = result.payload.targets.find(t => t.name === 'Goblin');
      expect(goblinTarget.hasCurse).toBe(true);
    });

    it('should report hasCurse for creatures with attuned cursed items', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext());
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'attunement' && name === 'Orc') return [{ name: 'Cursed Ring' }];
        if (prop === 'activeBuffs') return [];
        return [];
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const orcTarget = result.payload.targets.find(t => t.name === 'Orc');
      expect(orcTarget.hasCurse).toBe(true);
      expect(orcTarget.attunement).toHaveLength(1);
    });

    it('should report hasCurse when caster has cursed buffs', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext());
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs' && name === 'TestCaster') return [{ type: 'cursed', name: 'Cursed Shield' }];
        if (prop === 'activeBuffs') return [];
        if (prop === 'attunement') return [];
        return [];
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const selfTarget = result.payload.targets.find(t => t.isSelf);
      expect(selfTarget.hasCurse).toBe(true);
    });

    it('should pass range from automation config', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext());
      getRuntimeValue.mockImplementation(() => []);

      const result = await handle(makeAction({ range: '30 ft' }), makePlayerStats(), campaignName, null);

      expect(result.payload.range).toBe('30 ft');
    });

    it('should default range to Touch when not specified', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext());
      getRuntimeValue.mockImplementation(() => []);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.range).toBe('Touch');
    });

    it('should pass automation object in payload', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext());
      getRuntimeValue.mockImplementation(() => []);

      const result = await handle(makeAction({ custom: true }), makePlayerStats(), campaignName, null);

      expect(result.payload.automation.custom).toBe(true);
    });

    it('should use empty automation object when action has no automation property', async () => {
      getCombatContext.mockResolvedValue(makeCombatContext());
      getRuntimeValue.mockImplementation(() => []);

      const result = await handle({ name: 'Remove Curse' }, makePlayerStats(), campaignName, null);

      expect(result.payload.automation).toEqual({});
    });

    it('should return only self target when no other creatures exist', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      });
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs' && name === 'TestCaster') return [];
        if (prop === 'attunement' && name === 'TestCaster') return [];
        return [];
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.targets).toHaveLength(1);
      expect(result.payload.targets[0].isSelf).toBe(true);
      expect(result.payload.targets[0].name).toBe('TestCaster');
    });
  });
});

describe('removeCurseHandler.applyRemoveCurse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('early return paths', () => {
    it('should return null when result is null or undefined', async () => {
      expect(await applyRemoveCurse(makeAction(), makePlayerStats(), campaignName, null, null)).toBeNull();
      expect(await applyRemoveCurse(makeAction(), makePlayerStats(), campaignName, null, undefined)).toBeNull();
    });

    it('should return null when result has no targetName or empty targetName', async () => {
      expect(await applyRemoveCurse(makeAction(), makePlayerStats(), campaignName, null, { selections: [] })).toBeNull();
      expect(await applyRemoveCurse(makeAction(), makePlayerStats(), campaignName, null, { targetName: '', selections: [] })).toBeNull();
    });
  });

  describe('cursed buff removal', () => {
    it('should remove cursed buffs and preserve non-cursed buffs', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Sword' }, { type: 'buff', name: 'Shield' }];
        return [];
      });

      const result = await applyRemoveCurse(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin' },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeBuffs', [{ type: 'buff', name: 'Shield' }], campaignName);
      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ type: 'buff', action: 'removed', buffName: 'Cursed Sword' }),
      );
      expect(result.payload.description).toContain('Curse');
    });

    it('should remove multiple cursed buffs', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [
          { type: 'cursed', name: 'Cursed Sword' },
          { cursed: true, name: 'Hex' },
          { type: 'buff', name: 'Shield' },
        ];
        return [];
      });

      const result = await applyRemoveCurse(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin' },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeBuffs', [{ type: 'buff', name: 'Shield' }], campaignName);
      expect(postLogEntry).toHaveBeenCalledTimes(3);
      expect(result.payload.description).toContain('2 cursed effect');
    });

    it('should remove buffs with cursed flag set to true', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [{ cursed: true, name: 'Hex' }];
        return [];
      });

      const result = await applyRemoveCurse(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin' },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeBuffs', [], campaignName);
      expect(result.payload.description).toContain('Curse');
    });

    it('should not call setRuntimeValue when no cursed buffs exist', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [{ type: 'buff', name: 'Shield' }];
        return [];
      });

      await applyRemoveCurse(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin' },
      );

      expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'activeBuffs', expect.anything(), campaignName);
    });
  });

  describe('attunement removal', () => {
    it('should break all attunement and log the count', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [];
        if (prop === 'attunement') return [{ name: 'Cursed Ring' }];
        return [];
      });

      const result = await applyRemoveCurse(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin' },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'attunement', [], campaignName);
      expect(result.payload.description).toContain('Attunement broken');
    });

    it('should break multiple attunements', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [];
        if (prop === 'attunement') return [{ name: 'Cursed Ring' }, { name: 'Cursed Amulet' }];
        return [];
      });

      const result = await applyRemoveCurse(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin' },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'attunement', [], campaignName);
      expect(result.payload.description).toContain('2 attuned item');
    });

    it('should not call setRuntimeValue for attunement when none exist', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [];
        if (prop === 'attunement') return [];
        return [];
      });

      await applyRemoveCurse(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin' },
      );

      expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'attunement', expect.anything(), campaignName);
    });
  });

  describe('combined curse and attunement removal', () => {
    it('should remove both cursed buffs and break attunement', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Sword' }];
        if (prop === 'attunement') return [{ name: 'Cursed Ring' }];
        return [];
      });

      const result = await applyRemoveCurse(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin' },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeBuffs', [], campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'attunement', [], campaignName);
      expect(result.payload.description).toContain('Curse');
      expect(result.payload.description).toContain('Attunement broken');
    });
  });

  describe('no curses found', () => {
    it('should return info popup when no curses or attunement exist', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [];
        if (prop === 'attunement') return [];
        return [];
      });

      const result = await applyRemoveCurse(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin' },
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No curses or attunement found');
      expect(addEntry).not.toHaveBeenCalled();
      expect(postLogEntry).not.toHaveBeenCalled();
    });

    it('should return info popup when only non-cursed buffs exist', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [{ type: 'buff', name: 'Shield' }];
        if (prop === 'attunement') return [];
        return [];
      });

      const result = await applyRemoveCurse(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin' },
      );

      expect(result.payload.description).toContain('No curses or attunement found');
    });
  });

  describe('logging', () => {
    it('should log ability_use entry when cursed buffs are removed', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Amulet' }];
        return [];
      });

      await applyRemoveCurse(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin' },
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: 'Remove Curse',
          targetName: 'Goblin',
        }),
      );
    });

    it('should log spell_effect entry when effects are removed', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Amulet' }];
        return [];
      });

      await applyRemoveCurse(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin' },
      );

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'spell_effect',
          spellName: 'Remove Curse',
          targetName: 'Goblin',
        }),
      );
    });

    it('should log spell_effect with removed items in effects array', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Amulet' }];
        if (prop === 'attunement') return [{ name: 'Cursed Ring' }];
        return [];
      });

      await applyRemoveCurse(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin' },
      );

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          effects: expect.arrayContaining([
            expect.stringContaining('Curse'),
            expect.stringContaining('Attunement'),
          ]),
        }),
      );
    });

    it('should not log when no curses or attunement are found', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [];
        if (prop === 'attunement') return [];
        return [];
      });

      await applyRemoveCurse(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Goblin' },
      );

      expect(addEntry).not.toHaveBeenCalled();
      expect(postLogEntry).not.toHaveBeenCalled();
    });
  });
});
