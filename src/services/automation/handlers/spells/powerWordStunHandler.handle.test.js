// @improved-by-ai
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

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

import { handle } from './powerWordStunHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Power Word Stun',
    automation: { type: 'power_word_stun', saveDc: 15, ...automation },
  };
}

const lowHpCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: casterName, gridX: 5, gridY: 10 },
  ],
  players: [{ name: casterName, gridX: 5, gridY: 10 }],
  placedItems: [],
};

const highHpCombatContext = {
  creatures: [
    { name: 'Dragon', type: 'monster', currentHp: 300, maxHp: 500 },
    { name: casterName, gridX: 5, gridY: 10 },
  ],
  players: [{ name: casterName, gridX: 5, gridY: 10 }],
  placedItems: [],
};

function setupMocks(targetName, hp, existingConditions = [], existingEffects = []) {
  const combatContext = hp !== null && hp <= 150 ? lowHpCombatContext : highHpCombatContext;
  getCombatContext.mockResolvedValue(combatContext);
  buildSaveDc.mockReturnValue(15);
  resolveTarget.mockResolvedValue({ target: { name: targetName } });
  getRuntimeValue.mockImplementation((_entity, key, _camp) => {
    if (key === '_powerWordStun_' + targetName.replace(/\s+/g, '_')) return null;
    if (key === 'activeConditions') return existingConditions;
    if (key === 'targetEffects') return existingEffects;
    return null;
  });
}

describe('powerWordStunHandler.handle - early returns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return popup when combat context is invalid or has no creatures', async () => {
    const scenarios = [
      { context: null },
      { context: {} },
      { context: { creatures: [] } },
    ];

    for (const { context } of scenarios) {
      getCombatContext.mockResolvedValue(context);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    }
  });

  it('should return popup when resolveTarget returns no valid target', async () => {
    const scenarios = [
      { result: null },
      { result: {} },
      { result: { target: {} } },
    ];

    for (const { result } of scenarios) {
      getCombatContext.mockResolvedValue(lowHpCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue(result);

      const handlerResult = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(handlerResult.type).toBe('popup');
      expect(handlerResult.payload.description).toContain('No target selected');
    }
  });
});

describe('powerWordStunHandler.handle - target with 150 HP or fewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply Stunned condition and update description', async () => {
    setupMocks('Goblin', 5);
    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      expect.arrayContaining(['stunned']),
      campaignName,
    );
    expect(result.payload.description).toContain('Stunned');
    expect(result.payload.description).toContain('5 HP');
    expect(result.payload.description).toContain('150 or fewer');
  });

  it('should call addEntry with save_result', async () => {
    setupMocks('Goblin', 5);
    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'save_result',
        rollType: 'save-power-word-stun',
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'CON',
        success: false,
      }),
    );
  });

  it('should filter existing stunned condition before reapplying to avoid duplicates', async () => {
    setupMocks('Goblin', 5, ['stunned', 'Frightened']);
    await handle(makeAction(), makePlayerStats(), campaignName, null);

    const condCall = setRuntimeValue.mock.calls.find(
      call => call[0] === 'Goblin' && call[1] === 'activeConditions'
    );
    expect(condCall[2]).toContain('stunned');
    expect(condCall[2]).toContain('Frightened');
    expect(condCall[2].length).toBe(2);
  });

  it('should handle non-array activeConditions gracefully', async () => {
    getCombatContext.mockResolvedValue(lowHpCombatContext);
    buildSaveDc.mockReturnValue(15);
    resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    getRuntimeValue.mockImplementation((_entity, key, _camp) => {
      if (key === '_powerWordStun_Goblin') return null;
      if (key === 'activeConditions') return null;
      if (key === 'targetEffects') return [];
      return null;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    const condCall = setRuntimeValue.mock.calls.find(
      call => call[0] === 'Goblin' && call[1] === 'activeConditions'
    );
    expect(condCall[2]).toEqual(['stunned']);
  });

  it('should update existing target effect instead of duplicating', async () => {
    getCombatContext.mockResolvedValue(lowHpCombatContext);
    buildSaveDc.mockReturnValue(15);
    resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    getRuntimeValue.mockImplementation((_entity, key, _camp) => {
      if (key === '_powerWordStun_Goblin') return null;
      if (key === 'activeConditions') return [];
      if (key === 'targetEffects') {
        return [
          {
            target: 'Goblin',
            effect: 'power_word_stun_repeat_save',
            source: 'OldCaster',
            dc: 12,
            saveType: 'CON',
          },
        ];
      }
      return null;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    const effectsCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'targetEffects');
    expect(effectsCalls.length).toBe(1);
    const effects = effectsCalls[0][2];
    expect(effects.length).toBe(1);
    expect(effects[0].source).toBe(casterName);
    expect(effects[0].dc).toBe(15);
  });

  it('should store the DC from buildSaveDc in the target effect', async () => {
    getCombatContext.mockResolvedValue(lowHpCombatContext);
    buildSaveDc.mockReturnValue(18);
    resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    getRuntimeValue.mockImplementation((_entity, key, _camp) => {
      if (key === '_powerWordStun_Goblin') return null;
      if (key === 'activeConditions') return [];
      if (key === 'targetEffects') return [];
      return null;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    const effectsCall = setRuntimeValue.mock.calls.find(call => call[1] === 'targetEffects');
    const effect = effectsCall[2][0];
    expect(effect.dc).toBe(18);
  });
});

describe('powerWordStunHandler.handle - target with more than 150 HP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply speed_zero instead of Stunned and update description', async () => {
    setupMocks('Dragon', 300);
    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Dragon',
      'activeConditions',
      expect.arrayContaining(['speed_zero']),
      campaignName,
    );
    expect(result.payload.description).toContain('Speed is 0');
    expect(result.payload.description).toContain('more than 150');
    expect(result.payload.description).toContain('300 HP');
  });

  it('should call addExpiration for speed_zero', async () => {
    setupMocks('Dragon', 300);
    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(addExpiration).toHaveBeenCalledWith(
      casterName,
      'Dragon',
      expect.arrayContaining([
        expect.objectContaining({ type: 'speed_zero', condition: 'speed_zero' }),
      ]),
      campaignName,
      undefined,
      casterName,
    );
  });

  it('should log the Speed 0 condition application', async () => {
    setupMocks('Dragon', 300);
    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'condition',
        action: 'applied',
        characterName: 'Dragon',
        condition: 'Speed 0',
      }),
    );
  });

  it('should append speed_zero to existing conditions', async () => {
    getCombatContext.mockResolvedValue(highHpCombatContext);
    buildSaveDc.mockReturnValue(15);
    resolveTarget.mockResolvedValue({ target: { name: 'Dragon' } });
    getRuntimeValue.mockImplementation((_entity, key, _camp) => {
      if (key === '_powerWordStun_Dragon') return null;
      if (key === 'activeConditions') return ['frightened'];
      if (key === 'targetEffects') return [];
      return null;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    const condCall = setRuntimeValue.mock.calls.find(
      call => call[0] === 'Dragon' && call[1] === 'activeConditions'
    );
    expect(condCall[2]).toContain('speed_zero');
    expect(condCall[2]).toContain('frightened');
  });
});

describe('powerWordStunHandler.handle - target with unknown HP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply speed_zero when target has no currentHp or hit_points.current', async () => {
    const unknownHpCombat = {
      creatures: [
        { name: 'Mystery', type: 'monster' },
        { name: casterName, gridX: 5, gridY: 10 },
      ],
      players: [{ name: casterName, gridX: 5, gridY: 10 }],
      placedItems: [],
    };
    getCombatContext.mockResolvedValue(unknownHpCombat);
    buildSaveDc.mockReturnValue(15);
    resolveTarget.mockResolvedValue({ target: { name: 'Mystery' } });
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.description).toContain('unknown HP');
    expect(result.payload.description).toContain('Speed is 0');
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Mystery',
      'activeConditions',
      expect.arrayContaining(['speed_zero']),
      campaignName,
    );
  });

  it('should use hit_points.current as fallback for HP', async () => {
    const hitPointsCombat = {
      creatures: [
        { name: 'Blob', type: 'monster', hit_points: { current: 100 } },
        { name: casterName, gridX: 5, gridY: 10 },
      ],
      players: [{ name: casterName, gridX: 5, gridY: 10 }],
      placedItems: [],
    };
    getCombatContext.mockResolvedValue(hitPointsCombat);
    buildSaveDc.mockReturnValue(15);
    resolveTarget.mockResolvedValue({ target: { name: 'Blob' } });
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.description).toContain('100 HP');
    expect(result.payload.description).toContain('150 or fewer');
    expect(result.payload.description).toContain('Stunned');
  });

  it('should use hit_points.current when target has more than 150 HP', async () => {
    const hitPointsCombat = {
      creatures: [
        { name: 'Titan', type: 'monster', hit_points: { current: 400 } },
        { name: casterName, gridX: 5, gridY: 10 },
      ],
      players: [{ name: casterName, gridX: 5, gridY: 10 }],
      placedItems: [],
    };
    getCombatContext.mockResolvedValue(hitPointsCombat);
    buildSaveDc.mockReturnValue(15);
    resolveTarget.mockResolvedValue({ target: { name: 'Titan' } });
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.description).toContain('400 HP');
    expect(result.payload.description).toContain('Speed is 0');
  });
});


