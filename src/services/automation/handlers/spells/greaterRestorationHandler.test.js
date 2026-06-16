import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
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

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

import { handle, applyGreaterRestoration } from './greaterRestorationHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';

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

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

describe('greaterRestorationHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Greater Restoration');
      expect(result.payload.description).toContain('No combat context found');
    });
  });

  describe('creature targets', () => {
    it('should exclude the caster from creature targets', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('greater_restoration_selection');
      expect(result.payload.creatureTargets).toEqual(['Goblin', 'Orc']);
    });

    it('should include range from automation config', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      const result = await handle(makeAction({ range: '30 ft' }), makePlayerStats(), campaignName, null);
      expect(result.payload.range).toBe('30 ft');
    });

    it('should default range to Touch when not specified', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      const result = await handle(makeAction({}), makePlayerStats(), campaignName, null);
      expect(result.payload.range).toBe('Touch');
    });

    it('should pass automation object in payload', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      const auto = { range: '60 ft', custom: true };
      const result = await handle(makeAction(auto), makePlayerStats(), campaignName, null);
      expect(result.payload.automation.range).toBe('60 ft');
      expect(result.payload.automation.custom).toBe(true);
    });
  });
});

describe('greaterRestorationHandler.applyGreaterRestoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when result is missing', async () => {
    const result = await applyGreaterRestoration(makeAction(), makePlayerStats(), campaignName, null, null);
    expect(result).toBeNull();
  });

  it('should return null when result has no targetName', async () => {
    const result = await applyGreaterRestoration(makeAction(), makePlayerStats(), campaignName, null, { selections: [] });
    expect(result).toBeNull();
  });

  it('should remove exhaustion level', async () => {
    getRuntimeValue.mockImplementation((target, prop) => {
      if (prop === 'exhaustionLevel') return 2;
      return [];
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
    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Exhaustion level');
  });

  it('should not modify when exhaustion level is 0', async () => {
    getRuntimeValue.mockImplementation((target, prop) => {
      if (prop === 'exhaustionLevel') return 0;
      return [];
    });

    const result = await applyGreaterRestoration(
      makeAction(),
      makePlayerStats(),
      campaignName,
      null,
      { targetName: 'Goblin', selections: [{ type: 'exhaustion' }] },
    );

    expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'exhaustionLevel', expect.anything(), campaignName);
    expect(result.payload.description).toContain('No removable effects found');
  });

  it('should remove a condition from activeConditions', async () => {
    getRuntimeValue.mockImplementation((target, prop) => {
      if (prop === 'activeConditions') return ['Paralyzed', 'Frightened'];
      return [];
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

  it('should remove cursed buffs', async () => {
    getRuntimeValue.mockImplementation((target, prop) => {
      if (prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Sword' }, { type: 'buff', name: 'Shield' }];
      return [];
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
      expect.objectContaining({ type: 'buff', action: 'removed', buffName: 'Cursed Sword' }),
    );
    expect(result.payload.description).toContain('Curse');
  });

  it('should restore ability reductions', async () => {
    getRuntimeValue.mockImplementation((target, prop) => {
      if (prop === 'abilityReductions') return { strength: { original: 18, current: 10 } };
      if (prop === 'strength') return 10;
      return [];
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
    expect(result.payload.description).toContain('Ability score reduction');
  });

  it('should restore hp max reduction', async () => {
    getRuntimeValue.mockImplementation((target, prop) => {
      if (prop === 'hpMaxReduction') return 5;
      if (prop === 'hitPoints') return 20;
      if (prop === 'currentHitPoints') return 15;
      return [];
    });

    const result = await applyGreaterRestoration(
      makeAction(),
      makePlayerStats(),
      campaignName,
      null,
      { targetName: 'Goblin', selections: [{ type: 'hp_max_reduction' }] },
    );

    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'hitPoints', 25, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'hpMaxReduction', 0, campaignName);
    expect(result.payload.description).toContain('Hit Point maximum reduction');
  });

  it('should log ability_use entry when effects are removed', async () => {
    getRuntimeValue.mockImplementation((target, prop) => {
      if (prop === 'activeConditions') return ['Paralyzed'];
      return [];
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
  });

  it('should log spell_effect entry when effects are removed', async () => {
    getRuntimeValue.mockImplementation((target, prop) => {
      if (prop === 'activeConditions') return ['Paralyzed'];
      return [];
    });

    await applyGreaterRestoration(
      makeAction(),
      makePlayerStats(),
      campaignName,
      null,
      { targetName: 'Goblin', selections: [{ type: 'condition', condition: 'Paralyzed' }] },
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

  it('should handle no removable effects found', async () => {
    getRuntimeValue.mockImplementation((target, prop) => {
      if (prop === 'activeConditions') return [];
      if (prop === 'exhaustionLevel') return 0;
      if (prop === 'activeBuffs') return [];
      if (prop === 'abilityReductions') return {};
      if (prop === 'hpMaxReduction') return 0;
      return [];
    });

    const result = await applyGreaterRestoration(
      makeAction(),
      makePlayerStats(),
      campaignName,
      null,
      { targetName: 'Goblin', selections: [{ type: 'condition', condition: 'Paralyzed' }] },
    );

    expect(result.payload.description).toContain('No removable effects found');
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('should handle multiple selections in one call', async () => {
    getRuntimeValue.mockImplementation((target, prop) => {
      if (prop === 'exhaustionLevel') return 1;
      if (prop === 'activeConditions') return ['Paralyzed'];
      return [];
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

    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'exhaustionLevel', 0, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', [], campaignName);
    expect(result.payload.description).toContain('Exhaustion level');
    expect(result.payload.description).toContain('Paralyzed condition');
  });
});
