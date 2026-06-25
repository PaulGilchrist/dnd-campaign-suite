// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

import { handle, applyLesserRestoration } from './lesserRestorationHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Wisdom', bonus: 2 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Lesser Restoration',
    automation: { type: 'lesser_restoration', ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Ally1', type: 'player' },
    { name: 'TestCleric', type: 'player' },
    { name: 'Goblin', type: 'monster' },
  ],
};

describe('lesserRestorationHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Lesser Restoration');
      expect(result.payload.description).toContain('No combat context found');
    });
  });

  describe('target selection', () => {
    it('should include the caster as a self-target', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const selfTarget = result.payload.targets.find(t => t.isSelf === true);
      expect(selfTarget).toBeDefined();
      expect(selfTarget.name).toBe('TestCleric');
    });

    it('should include other creatures in targets list', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const names = result.payload.targets.map(t => t.name);
      expect(names).toContain('Ally1');
      expect(names).toContain('Goblin');
      expect(result.payload.targets.length).toBe(3);
    });

    it('should exclude the caster from non-self creature targets', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const nonSelfTargets = result.payload.targets.filter(t => t.isSelf !== true);
      const nonSelfNames = nonSelfTargets.map(t => t.name);
      expect(nonSelfNames).not.toContain('TestCleric');
    });

    it('should work with empty creature list', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.targets.length).toBe(1);
      expect(result.payload.targets[0].name).toBe('TestCleric');
      expect(result.payload.targets[0].isSelf).toBe(true);
    });

    it('should return automation_info popup type', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Lesser Restoration');
    });
  });

  describe('condition filtering', () => {
    it('should only include allowed conditions per target', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'activeConditions') {
          if (target === 'Ally1') return ['Blinded', 'Frightened', 'Restrained'];
          if (target === 'Goblin') return ['Poisoned', 'Prone'];
          return [];
        }
        return [];
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const allyTarget = result.payload.targets.find(t => t.name === 'Ally1');
      expect(allyTarget.conditions).toEqual(['Blinded']);
      expect(allyTarget.hasApplicableConditions).toBe(true);

      const goblinTarget = result.payload.targets.find(t => t.name === 'Goblin');
      expect(goblinTarget.conditions).toEqual(['Poisoned']);
      expect(goblinTarget.hasApplicableConditions).toBe(true);
    });

    it('should mark targets without applicable conditions', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'activeConditions') {
          if (target === 'Ally1') return ['Frightened', 'Prone'];
          return [];
        }
        return [];
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const allyTarget = result.payload.targets.find(t => t.name === 'Ally1');
      expect(allyTarget.hasApplicableConditions).toBe(false);
      expect(allyTarget.conditions).toEqual([]);
    });

    it('should reflect self conditions in self-target', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'activeConditions') {
          if (target === 'TestCleric') return ['Blinded', 'Poisoned'];
          return [];
        }
        return [];
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const selfTarget = result.payload.targets.find(t => t.isSelf === true);
      expect(selfTarget.name).toBe('TestCleric');
      expect(selfTarget.conditions).toEqual(['Blinded', 'Poisoned']);
      expect(selfTarget.hasApplicableConditions).toBe(true);
    });
  });

  describe('payload configuration', () => {
    it('should include range from automation config', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction({ range: '30 ft' }), makePlayerStats(), campaignName, null);

      expect(result.payload.range).toBe('30 ft');
    });

    it('should default range to Touch when not specified', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.range).toBe('Touch');
    });

    it('should include automation object in payload', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getRuntimeValue.mockReturnValue([]);

      const auto = { range: '60 ft', custom: true };
      const result = await handle(makeAction(auto), makePlayerStats(), campaignName, null);

      expect(result.payload.automation.range).toBe('60 ft');
      expect(result.payload.automation.custom).toBe(true);
    });
  });
});

describe('lesserRestorationHandler.applyLesserRestoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('early return paths', () => {
    it('should return null when result is missing', async () => {
      const result = await applyLesserRestoration(makeAction(), makePlayerStats(), campaignName, null, null);
      expect(result).toBeNull();
    });

    it('should return null when result has no targetName', async () => {
      const result = await applyLesserRestoration(makeAction(), makePlayerStats(), campaignName, null, { condition: 'blinded' });
      expect(result).toBeNull();
    });

    it('should return info popup when no condition selected', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await applyLesserRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Ally1' },
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No condition selected');
    });
  });

  describe('condition removal', () => {
    it('should remove the condition from activeConditions', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      getRuntimeValue.mockReturnValue(['Blinded', 'Poisoned', 'Frightened']);

      const result = await applyLesserRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Ally1', condition: 'Blinded' },
      );

      expect(result).not.toBeNull();
      expect(result.payload.description).toContain('Removed Blinded condition');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Ally1',
        'activeConditions',
        ['Poisoned', 'Frightened'],
        campaignName,
      );
    });

    it('should handle case-insensitive condition matching', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      getRuntimeValue.mockReturnValue(['blinded', 'POISONED']);

      await applyLesserRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Ally1', condition: 'BLINDED' },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Ally1',
        'activeConditions',
        ['POISONED'],
        campaignName,
      );
    });

    it('should not modify when condition is not present', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      getRuntimeValue.mockReturnValue(['Poisoned', 'Frightened']);

      const result = await applyLesserRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Ally1', condition: 'Blinded' },
      );

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No applicable condition found');
    });

    it('should handle empty conditions array', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      getRuntimeValue.mockReturnValue([]);

      const result = await applyLesserRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Ally1', condition: 'Blinded' },
      );

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No applicable condition found');
    });

    it('should handle whitespace in condition names', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      getRuntimeValue.mockReturnValue(['  blinded  ', 'POISONED']);

      await applyLesserRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Ally1', condition: 'blinded' },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Ally1',
        'activeConditions',
        ['POISONED'],
        campaignName,
      );
    });
  });

  describe('logging and storage', () => {
    it('should call addEntry with ability_use on successful removal', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      getRuntimeValue.mockReturnValue(['Blinded']);

      await applyLesserRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Ally1', condition: 'Blinded' },
      );

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestCleric',
        abilityName: 'Lesser Restoration',
        targetName: 'Ally1',
      }));
    });

    it('should not log when condition removal fails', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      getRuntimeValue.mockReturnValue(['Poisoned']);

      await applyLesserRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Ally1', condition: 'Blinded' },
      );

      expect(addEntry).not.toHaveBeenCalled();
    });

    it('should update combatSummary creature conditions via storage', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Ally1', conditions: [{ key: 'Blinded' }, { key: 'Poisoned' }] }],
      });
      getRuntimeValue.mockReturnValue(['Blinded', 'Poisoned']);

      await applyLesserRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Ally1', condition: 'Blinded' },
      );

      expect(storage.set).toHaveBeenCalledWith(
        'combatSummary',
        expect.objectContaining({
          creatures: expect.arrayContaining([
            expect.objectContaining({
              name: 'Ally1',
              conditions: expect.arrayContaining([
                expect.objectContaining({ key: 'Poisoned' }),
              ]),
            }),
          ]),
        }),
        campaignName,
      );
    });

    it('should not call storage.set when combatSummary is missing', async () => {
      getCombatContext.mockResolvedValue(null);
      getRuntimeValue.mockReturnValue(['Blinded']);

      await applyLesserRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Ally1', condition: 'Blinded' },
      );

      expect(storage.set).not.toHaveBeenCalled();
    });

    it('should not call storage.set when target creature not found in combatSummary', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'OtherGuy', conditions: [{ key: 'Blinded' }] }],
      });
      getRuntimeValue.mockReturnValue(['Blinded']);

      await applyLesserRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Ally1', condition: 'Blinded' },
      );

      expect(storage.set).not.toHaveBeenCalled();
    });

    it('should not call storage.set when creature has no conditions array', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Ally1' }],
      });
      getRuntimeValue.mockReturnValue(['Blinded']);

      await applyLesserRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Ally1', condition: 'Blinded' },
      );

      expect(storage.set).not.toHaveBeenCalled();
    });
  });
});
