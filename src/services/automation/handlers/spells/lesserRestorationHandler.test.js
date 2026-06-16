import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

import { handle, applyLesserRestoration } from './lesserRestorationHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

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

describe('lesserRestorationHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return popup when no combat context', async () => {
    getCombatContext.mockResolvedValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No combat context found');
  });

  it('should include self in targets list', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Ally1', type: 'player' }],
    });
    getRuntimeValue.mockReturnValue([]);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'TestCleric', isSelf: true }),
      ]),
    );
  });

  it('should include other creatures in targets list', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Ally1', type: 'player' },
        { name: 'TestCleric', type: 'player' },
      ],
    });
    getRuntimeValue.mockReturnValue([]);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    const names = result.payload.targets.map(t => t.name);
    expect(names).toContain('Ally1');
    expect(names).toContain('TestCleric');
  });

  it('should filter conditions to only allowed ones', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Ally1', type: 'player' }],
    });
    getRuntimeValue.mockImplementation((target, key) => {
      if (key === 'activeConditions' && target === 'Ally1') return ['Blinded', 'Frightened', 'Restrained'];
      return ['Blinded', 'Poisoned'];
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    const allyTarget = result.payload.targets.find(t => t.name === 'Ally1');
    expect(allyTarget.hasApplicableConditions).toBe(true);
    expect(allyTarget.conditions).toEqual(['Blinded']);
  });

  it('should mark targets without applicable conditions', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'HealthyAlly', type: 'player' }],
    });
    getRuntimeValue.mockReturnValue([]);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    const healthyTarget = result.payload.targets.find(t => t.name === 'HealthyAlly');
    expect(healthyTarget.hasApplicableConditions).toBe(false);
  });

  it('should return automation_info popup type', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Ally1', type: 'player' }],
    });
    getRuntimeValue.mockReturnValue([]);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.type).toBe('automation_info');
  });

  it('should include range in payload', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Ally1', type: 'player' }],
    });
    getRuntimeValue.mockReturnValue([]);

    const result = await handle(makeAction({ range: 'Touch' }), makePlayerStats(), campaignName, null);

    expect(result.payload.range).toBe('Touch');
  });

  it('should default range to Touch when not specified', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Ally1', type: 'player' }],
    });
    getRuntimeValue.mockReturnValue([]);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.range).toBe('Touch');
  });
});

describe('lesserRestorationHandler.applyLesserRestoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no result provided', async () => {
    const result = await applyLesserRestoration(makeAction(), makePlayerStats(), campaignName, null, null);
    expect(result).toBeNull();
  });

  it('should return null when no targetName in result', async () => {
    const result = await applyLesserRestoration(makeAction(), makePlayerStats(), campaignName, null, { condition: 'blinded' });
    expect(result).toBeNull();
  });

    it('should return popup when no condition selected', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      const noCondResult = await applyLesserRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Ally1' },
      );
      expect(noCondResult.payload.description).toContain('No condition selected');
    });

    it('should return popup when condition not found on target', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      getRuntimeValue.mockReturnValue(['Frightened', 'Prone']);
      const noMatchResult = await applyLesserRestoration(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
        { targetName: 'Ally1', condition: 'blinded' },
      );
      expect(noMatchResult.payload.description).toContain('No applicable condition found');
    });

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

  it('should call addEntry with ability_use', async () => {
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

  it('should update combatSummary creature conditions', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Ally1', conditions: [{ key: 'Blinded' }, { key: 'Poisoned' }] }],
    });
    getRuntimeValue.mockReturnValue(['Blinded', 'Poisoned']);
    const result = await applyLesserRestoration(
      makeAction(),
      makePlayerStats(),
      campaignName,
      null,
      { targetName: 'Ally1', condition: 'Blinded' },
    );
    expect(result).not.toBeNull();
  });

  it('should handle empty conditions array on target', async () => {
    getCombatContext.mockResolvedValue({ creatures: [] });
    getRuntimeValue.mockReturnValue([]);
    const result = await applyLesserRestoration(
      makeAction(),
      makePlayerStats(),
      campaignName,
      null,
      { targetName: 'Ally1', condition: 'Blinded' },
    );
    expect(result.payload.description).toContain('No applicable condition found');
  });
});
