import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

import { handle, applyRemoveCurse } from './removeCurseHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return { name: 'TestCaster', level: 10, proficiency: 4, abilities: [], ...overrides };
}

function makeAction(automation = {}) {
  return { name: 'Remove Curse', automation: { type: 'remove_curse', ...automation } };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

describe('removeCurseHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No combat context found');
    });
  });

  describe('target listing', () => {
    it('should include all creatures except caster in creature targets', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.targets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Goblin' }),
          expect.objectContaining({ name: 'Orc' }),
        ]),
      );
    });

    it('should include self as a target', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const selfTarget = result.payload.targets.find(t => t.isSelf);
      expect(selfTarget).toBeDefined();
      expect(selfTarget.name).toBe('TestCaster');
    });

    it('should report hasCurse based on cursed buffs', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs' && name === 'Goblin') return [{ type: 'cursed', name: 'Cursed Amulet' }];
        if (prop === 'activeBuffs') return [];
        if (prop === 'attunement') return [];
        return [];
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const goblinTarget = result.payload.targets.find(t => t.name === 'Goblin');
      expect(goblinTarget.hasCurse).toBe(true);
    });

    it('should report hasCurse based on attunement', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'attunement' && name === 'Orc') return [{ name: 'Cursed Ring' }];
        if (prop === 'activeBuffs') return [];
        return [];
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const orcTarget = result.payload.targets.find(t => t.name === 'Orc');
      expect(orcTarget.hasCurse).toBe(true);
    });

    it('should pass range from automation config', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction({ range: '30 ft' }), makePlayerStats(), campaignName, null);

      expect(result.payload.range).toBe('30 ft');
    });

    it('should default range to Touch', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction({}), makePlayerStats(), campaignName, null);

      expect(result.payload.range).toBe('Touch');
    });

    it('should pass automation in payload', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction({ custom: true }), makePlayerStats(), campaignName, null);

      expect(result.payload.automation.custom).toBe(true);
    });
  });
});

describe('removeCurseHandler.applyRemoveCurse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when result is missing', async () => {
    const result = await applyRemoveCurse(makeAction(), makePlayerStats(), campaignName, null, null);
    expect(result).toBeNull();
  });

  it('should return null when result has no targetName', async () => {
    const result = await applyRemoveCurse(makeAction(), makePlayerStats(), campaignName, null, { selections: [] });
    expect(result).toBeNull();
  });

  it('should remove cursed buffs', async () => {
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

  it('should break attunement', async () => {
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

  it('should log ability_use entry when effects are removed', async () => {
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

  it('should handle no curses or attunement', async () => {
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

    expect(result.payload.description).toContain('No curses or attunement found');
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('should remove both cursed buffs and attunement', async () => {
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
