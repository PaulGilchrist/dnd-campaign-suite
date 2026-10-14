import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, handleEscape } from './mazeHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 15,
    proficiency: 6,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
    spellAbilities: { saveDc: 17 },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Maze',
    automation: { type: 'maze', saveDc: 'ability', ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', conditions: [], abilities: { INT: { bonus: 0 }, WIS: { bonus: 0 } }, proficiency: 0 },
    { name: 'Orc', type: 'monster', conditions: [], abilities: { INT: { bonus: 1 }, WIS: { bonus: 0 } }, proficiency: 0 },
    { name: 'TestCaster', type: 'player', conditions: [], abilities: { INT: { bonus: 4 }, CON: { bonus: 2 } }, proficiency: 6 },
  ],
  players: [{ name: 'TestCaster' }],
  placedItems: [],
};

describe('mazeHandler.handle - addEntry error handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('handles addEntry rejection gracefully during activation', async () => {
    let currentTargetEffects = [];
    let currentConditions = {};
    let currentConditionMeta = {};

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReturnValue(17);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    runtimeState.getRuntimeValue.mockImplementation((creatureName, key, _campaign) => {
      if (key === 'targetEffects') return currentTargetEffects;
      if (key === 'activeConditions') return currentConditions[creatureName] || [];
      if (key === 'activeConditionMeta') return currentConditionMeta[creatureName] || {};
      return null;
    });
    runtimeState.setRuntimeValue.mockImplementation((creatureName, key, value, _campaign) => {
      if (key === 'targetEffects') currentTargetEffects = value;
      if (key === 'activeConditions') currentConditions[creatureName] = value;
      if (key === 'activeConditionMeta') currentConditionMeta[creatureName] = value;
    });
    logService.addEntry.mockRejectedValue(new Error('Log service error'));

    const action = makeAction();
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('banished to a labyrinthine demiplane');
    expect(currentTargetEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20, concentration: true }),
      ]),
    );
    expect(currentConditions['Goblin']).toContain('incapacitated');
  });
});

describe('mazeHandler.handleEscape - addEntry error handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('handles addEntry rejection on successful escape (save_result log)', async () => {
    let currentTargetEffects = [
      { effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 },
    ];
    let currentConditions = { Goblin: ['incapacitated'] };
    let currentMazeData = { Goblin: { casterName: 'TestCaster', dc: 20, timestamp: Date.now() } };

    Math.random = () => 1;
    logService.addEntry.mockRejectedValue(new Error('Log service error'));

    runtimeState.getRuntimeValue.mockImplementation((creatureName, key, _campaign) => {
      if (key === 'targetEffects') return currentTargetEffects;
      if (key === 'activeConditions') return currentConditions[creatureName] || [];
      if (key === 'mazeData') return currentMazeData[creatureName] || null;
      return null;
    });
    runtimeState.setRuntimeValue.mockImplementation((creatureName, key, value, _campaign) => {
      if (key === 'targetEffects') currentTargetEffects = value;
      if (key === 'activeConditions') currentConditions[creatureName] = value;
      if (key === 'mazeData') currentMazeData[creatureName] = value;
    });

    const result = await handleEscape(
      { metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', abilities: { INT: { bonus: 5 } }, proficiency: 6 }] } },
      makePlayerStats(),
      campaignName,
      null,
    );

    Math.random = () => Math.random;

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('succeeded on INT (Investigation) check');
    expect(currentTargetEffects).toHaveLength(0);
    expect(currentConditions['Goblin']).not.toContain('incapacitated');
  });

  it('handles addEntry rejection on failed escape', async () => {
    Math.random = () => 0;
    logService.addEntry.mockRejectedValue(new Error('Log service error'));

    runtimeState.getRuntimeValue.mockImplementation((_scope, key, _campaign) => {
      if (key === 'targetEffects') return [{ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 }];
      return null;
    });

    const result = await handleEscape(
      { metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', abilities: { INT: { bonus: 0 } }, proficiency: 0 }] } },
      makePlayerStats(),
      campaignName,
      null,
    );

    Math.random = () => Math.random;

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('failed INT (Investigation) check');
    expect(result.payload.description).toContain('remains trapped in the Maze');
  });
});

describe('mazeHandler.handle - truesight/blindsight', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('allows maze when target is invisible but caster has truesight', async () => {
    let currentTargetEffects = [];
    let currentConditions = {};
    let currentConditionMeta = {};

    const combatContext = {
      creatures: [
        { name: 'Goblin', type: 'monster', conditions: ['invisible'], abilities: { INT: { bonus: 0 } }, proficiency: 0 },
        { name: 'TestCaster', type: 'player', conditions: [], abilities: { INT: { bonus: 4 }, CON: { bonus: 2 } }, senses: [{ name: 'Truesight' }], proficiency: 6 },
      ],
    };
    damageUtils.getCombatContext.mockResolvedValue(combatContext);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    savePrompt.buildSaveDc.mockReturnValue(17);
    runtimeState.getRuntimeValue.mockImplementation((creatureName, key, _campaign) => {
      if (key === 'targetEffects') return currentTargetEffects;
      if (key === 'activeConditions') return currentConditions[creatureName] || [];
      if (key === 'activeConditionMeta') return currentConditionMeta[creatureName] || {};
      return null;
    });
    runtimeState.setRuntimeValue.mockImplementation((creatureName, key, value, _campaign) => {
      if (key === 'targetEffects') currentTargetEffects = value;
      if (key === 'activeConditions') currentConditions[creatureName] = value;
      if (key === 'activeConditionMeta') currentConditionMeta[creatureName] = value;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('banished to a labyrinthine demiplane');
    expect(currentConditions['Goblin']).toContain('incapacitated');
  });

  it('allows maze when target is invisible but caster has blindsight', async () => {
    let currentTargetEffects = [];
    let currentConditions = {};

    const combatContext = {
      creatures: [
        { name: 'Goblin', type: 'monster', conditions: ['invisible'], abilities: { INT: { bonus: 0 } }, proficiency: 0 },
        { name: 'TestCaster', type: 'player', conditions: [], abilities: { INT: { bonus: 4 }, CON: { bonus: 2 } }, senses: [{ name: 'Blindsight' }], proficiency: 6 },
      ],
    };
    damageUtils.getCombatContext.mockResolvedValue(combatContext);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    savePrompt.buildSaveDc.mockReturnValue(17);
    runtimeState.getRuntimeValue.mockImplementation((creatureName, key, _campaign) => {
      if (key === 'targetEffects') return currentTargetEffects;
      if (key === 'activeConditions') return currentConditions[creatureName] || [];
      if (key === 'activeConditionMeta') return currentConditions[creatureName + '_meta'] || {};
      return null;
    });
    runtimeState.setRuntimeValue.mockImplementation((creatureName, key, value, _campaign) => {
      if (key === 'targetEffects') currentTargetEffects = value;
      if (key === 'activeConditions') currentConditions[creatureName] = value;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('banished to a labyrinthine demiplane');
  });

  it('allows maze when target invisible condition is an object with key property', async () => {
    let currentTargetEffects = [];
    let currentConditions = {};

    const combatContext = {
      creatures: [
        { name: 'Goblin', type: 'monster', conditions: [{ key: 'invisible', duration: '1 turn' }], abilities: { INT: { bonus: 0 } }, proficiency: 0 },
        { name: 'TestCaster', type: 'player', conditions: [], abilities: { INT: { bonus: 4 }, CON: { bonus: 2 } }, senses: [], proficiency: 6 },
      ],
    };
    damageUtils.getCombatContext.mockResolvedValue(combatContext);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    savePrompt.buildSaveDc.mockReturnValue(17);
    runtimeState.getRuntimeValue.mockImplementation((creatureName, key, _campaign) => {
      if (key === 'targetEffects') return currentTargetEffects;
      if (key === 'activeConditions') return currentConditions[creatureName] || [];
      return null;
    });
    runtimeState.setRuntimeValue.mockImplementation((creatureName, key, value, _campaign) => {
      if (key === 'targetEffects') currentTargetEffects = value;
      if (key === 'activeConditions') currentConditions[creatureName] = value;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('can\'t see the target');
  });

  it('returns popup when casterCreature is null (no concentration logged)', async () => {
    let currentTargetEffects = [];
    let currentConditions = {};

    const combatContext = {
      creatures: [
        { name: 'Goblin', type: 'monster', conditions: [], abilities: { INT: { bonus: 0 } }, proficiency: 0 },
      ],
      players: [{ name: 'TestCaster' }],
    };
    damageUtils.getCombatContext.mockResolvedValue(combatContext);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    savePrompt.buildSaveDc.mockReturnValue(17);
    runtimeState.getRuntimeValue.mockImplementation((creatureName, key, _campaign) => {
      if (key === 'targetEffects') return currentTargetEffects;
      if (key === 'activeConditions') return currentConditions[creatureName] || [];
      return null;
    });
    runtimeState.setRuntimeValue.mockImplementation((creatureName, key, value, _campaign) => {
      if (key === 'targetEffects') currentTargetEffects = value;
      if (key === 'activeConditions') currentConditions[creatureName] = value;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('banished to a labyrinthine demiplane');
  });
});

describe('mazeHandler.handleEscape - success path', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('removes maze effect, mazeData, and incapacitated condition on successful escape', async () => {
    let currentTargetEffects = [
      { effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 },
    ];
    let currentConditions = { Goblin: ['incapacitated'] };
    let currentMazeData = { Goblin: { casterName: 'TestCaster', dc: 20, timestamp: Date.now() } };

    Math.random = () => 1;

    runtimeState.getRuntimeValue.mockImplementation((creatureName, key, _campaign) => {
      if (key === 'targetEffects') return currentTargetEffects;
      if (key === 'activeConditions') return currentConditions[creatureName] || [];
      if (key === 'mazeData') return currentMazeData[creatureName] || null;
      return null;
    });
    runtimeState.setRuntimeValue.mockImplementation((creatureName, key, value, _campaign) => {
      if (key === 'targetEffects') currentTargetEffects = value;
      if (key === 'activeConditions') currentConditions[creatureName] = value;
      if (key === 'mazeData') currentMazeData[creatureName] = value;
    });

    const result = await handleEscape(
      { metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', abilities: { INT: { bonus: 5 } }, proficiency: 6 }] } },
      makePlayerStats(),
      campaignName,
      null,
    );

    Math.random = () => Math.random;

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('succeeded on INT (Investigation) check');
    expect(result.payload.description).toContain('escaped the Maze');
    expect(currentTargetEffects).toHaveLength(0);
    expect(currentConditions['Goblin']).not.toContain('incapacitated');
    expect(currentMazeData['Goblin']).toBeNull();
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({ type: 'condition', action: 'removed', condition: 'Incapacitated' }),
    );
  });

  it('handles empty creatures array in metaCtx', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_scope, key, _campaign) => {
      if (key === 'targetEffects') return [{ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 }];
      return null;
    });

    const result = await handleEscape(
      { metaCtx: { mazeTargetName: 'Goblin', creatures: [] } },
      makePlayerStats(),
      campaignName,
      null,
    );

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('failed INT (Investigation) check');
  });

  it('handles null creatures in metaCtx', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_scope, key, _campaign) => {
      if (key === 'targetEffects') return [{ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 }];
      return null;
    });

    const result = await handleEscape(
      { metaCtx: { mazeTargetName: 'Goblin', creatures: null } },
      makePlayerStats(),
      campaignName,
      null,
    );

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('failed INT (Investigation) check');
  });

  it('uses default INT bonus 0 when creature abilities missing', async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.5;

    runtimeState.getRuntimeValue.mockImplementation((_scope, key, _campaign) => {
      if (key === 'targetEffects') return [{ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 }];
      return null;
    });

    const result = await handleEscape(
      { metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin' }] } },
      makePlayerStats(),
      campaignName,
      null,
    );

    Math.random = originalRandom;

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('11 vs DC 20');
  });

  it('uses default proficiency 0 when creature proficiency missing', async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.5;

    runtimeState.getRuntimeValue.mockImplementation((_scope, key, _campaign) => {
      if (key === 'targetEffects') return [{ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 20 }];
      return null;
    });

    const result = await handleEscape(
      { metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', abilities: { INT: { bonus: 3 } } }] } },
      makePlayerStats(),
      campaignName,
      null,
    );

    Math.random = originalRandom;

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('14 vs DC 20');
  });

  it('uses mazeEffect.dc when provided instead of default 20', async () => {
    Math.random = () => 1;

    runtimeState.getRuntimeValue.mockImplementation((_scope, key, _campaign) => {
      if (key === 'targetEffects') return [{ effect: 'maze', target: 'Goblin', source: 'TestCaster', dc: 25 }];
      return null;
    });

    const result = await handleEscape(
      { metaCtx: { mazeTargetName: 'Goblin', creatures: [{ name: 'Goblin', abilities: { INT: { bonus: 0 } }, proficiency: 0 }] } },
      makePlayerStats(),
      campaignName,
      null,
    );

    Math.random = () => Math.random;

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('vs DC 25');
  });
});
