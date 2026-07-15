import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue({ round: 1, creatures: [] }),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn().mockResolvedValue({
    attackEvent: null,
    attackerName: null,
    targetName: null,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
  }),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../common/infoPopup.js', () => ({
  infoPopup: vi.fn().mockImplementation((name, description) => ({
    type: 'popup',
    payload: { type: 'automation_info', name, description },
  })),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
  createSaveListener: vi.fn().mockReturnValue({ promptId: 'test-prompt-id' }),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

import { handle } from './reactionDebuffHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as combatData from '../../../encounters/combatData.js';
import * as abilityLookup from '../../../shared/abilityLookup.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as expirations from '../../../rules/effects/expirations.js';

const campaignName = 'test-campaign';
const mapName = 'test-map';

let addEventListenerSpy;
let removeEventListenerSpy;

function makeBarbarianStats(overrides = {}) {
  return {
    name: 'Thulgar',
    proficiency: 3,
    level: 6,
    class: {
      name: 'Barbarian',
      class_levels: [{ level: 6, bardic_die: 6 }],
    },
    abilities: [
      { name: 'Strength', bonus: 4 },
      { name: 'Dexterity', bonus: 2 },
      { name: 'Constitution', bonus: 3 },
    ],
    ...overrides,
  };
}

function makeTeleportAction(automation = {}) {
  return {
    name: 'Branches of the Tree',
    automation: {
      type: 'reaction_debuff',
      effect: 'teleport_and_slow',
      saveType: 'STR',
      saveDcExpression: '8 + STR modifier + proficiency_bonus',
      range: '30_ft',
      ...automation,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useRuntimeState.getRuntimeValue.mockReturnValue(null);
  rangeValidation.rangeToFeet.mockReturnValue(30);
  abilityLookup.getAbilityModifier.mockReturnValue(4);
  addEventListenerSpy = vi.fn();
  removeEventListenerSpy = vi.fn();
  Object.defineProperty(window, 'addEventListener', { value: addEventListenerSpy, writable: true, configurable: true });
  Object.defineProperty(window, 'removeEventListener', { value: removeEventListenerSpy, writable: true, configurable: true });
});

describe('branchesOfTheTree (teleport_and_slow)', () => {
  it('returns popup when no active creature', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'test-campaign' && prop === 'activeCreatureName') return null;
      return null;
    });

    const action = makeTeleportAction();
    const result = await handle(action, makeBarbarianStats(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('No active creature found');
  });

  it('returns popup when out of range (map active, both on map)', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Goblin');
    useRuntimeState.getRuntimeValue.mockImplementation((key, subkey) => {
      if (key === '__map__' && subkey === 'activeMapName') return 'test-map';
      return null;
    });
    const mockCombatSummary = {
      players: [{ name: 'Thulgar', gridX: 1, gridY: 1 }],
      creatures: [{ name: 'Goblin', gridX: 10, gridY: 10 }],
    };
    combatData.loadCombatSummary.mockResolvedValue(mockCombatSummary);
    combatData.getCombatSummary.mockReturnValue(mockCombatSummary);
    rangeValidation.getDistanceFeet.mockReturnValue(50);

    const action = makeTeleportAction();
    const result = await handle(action, makeBarbarianStats(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('out of range');
  });

  it('proceeds when no map active (assumes in range)', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Goblin');

    const action = makeTeleportAction();
    const result = await handle(action, makeBarbarianStats(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('STR saving throw');
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'STR',
      saveDc: 15,
    });
  });

  it('proceeds when one creature not on map (assumes in range)', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Goblin');
    useRuntimeState.getRuntimeValue.mockImplementation((key, subkey) => {
      if (key === '__map__' && subkey === 'activeMapName') return 'test-map';
      return null;
    });
    const mockCombatSummary = {
      players: [{ name: 'Thulgar', gridX: 5, gridY: 5 }],
      creatures: [{ name: 'Goblin' }], // no grid position
    };
    combatData.loadCombatSummary.mockResolvedValue(mockCombatSummary);
    combatData.getCombatSummary.mockReturnValue(mockCombatSummary);

    const action = makeTeleportAction();
    const result = await handle(action, makeBarbarianStats(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('STR saving throw');
  });

  it('calculates correct STR save DC', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Orc');

    const action = makeTeleportAction();
    await handle(action, makeBarbarianStats(), campaignName, mapName);

    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Orc',
      saveType: 'STR',
      saveDc: 15, // 8 + 4 + 3
    });
  });

  it('logs ability_use on trigger', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Goblin');
    useRuntimeState.getRuntimeValue.mockReturnValue(null);

    const action = makeTeleportAction();
    await handle(action, makeBarbarianStats(), campaignName, mapName);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Thulgar',
        abilityName: 'Branches of the Tree',
        description: expect.stringContaining('Goblin must make STR save'),
      })
    );
  });

  it('on fail: adds speed_reduction targetEffect', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Goblin');

    const action = makeTeleportAction();
    await handle(action, makeBarbarianStats(), campaignName, mapName);

    // Simulate save failure event
    const saveHandler = addEventListenerSpy.mock.calls.find(
      call => call[0] === 'save-result'
    )?.[1];
    expect(saveHandler).toBeDefined();

    await saveHandler({
      detail: { promptId: 'test-prompt-id', success: false },
    }).catch(() => {});

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      campaignName,
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({
          effect: 'speed_reduction',
          target: 'Goblin',
          source: 'Branches of the Tree',
          value: 1000,
        }),
      ]),
      campaignName
    );
  });

  it('on fail: adds expiration to remove speed_reduction', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Orc');

    const action = makeTeleportAction();
    await handle(action, makeBarbarianStats(), campaignName, mapName);

    const saveHandler = addEventListenerSpy.mock.calls.find(
      call => call[0] === 'save-result'
    )?.[1];

    await saveHandler({
      detail: { promptId: 'test-prompt-id', success: false },
    }).catch(() => {});

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Thulgar',
      'Orc',
      [
        {
          type: 'remove_target_effect',
          effectKey: 'speed_reduction',
          source: 'Branches of the Tree',
          target: 'Orc',
        },
      ],
      campaignName,
      1
    );
  });

  it('on fail: logs save_result with failure', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Goblin');

    const action = makeTeleportAction();
    await handle(action, makeBarbarianStats(), campaignName, mapName);

    const saveHandler = addEventListenerSpy.mock.calls.find(
      call => call[0] === 'save-result'
    )?.[1];

    await saveHandler({
      detail: { promptId: 'test-prompt-id', success: false },
    }).catch(() => {});

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        saveType: 'STR',
        saveDc: 15,
        success: false,
        description: expect.stringContaining('failed STR save'),
      })
    );
  });

  it('on success: logs save_result with success, no effects', async () => {
    vi.clearAllMocks();
    combatData.getActiveCreatureName.mockReturnValue('Orc');

    const action = makeTeleportAction();
    await handle(action, makeBarbarianStats(), campaignName, mapName);

    const saveHandler = addEventListenerSpy.mock.calls.find(
      call => call[0] === 'save-result'
    )?.[1];

    await saveHandler({
      detail: { promptId: 'test-prompt-id', success: true },
    }).catch(() => {});

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'save_result',
        targetName: 'Orc',
        saveType: 'STR',
        saveDc: 15,
        success: true,
        description: expect.stringContaining('succeeded on STR save'),
      })
    );

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      campaignName,
      'targetEffects',
      expect.any(Array),
      campaignName
    );
  });

  it('removes event listener after save result', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Goblin');

    const action = makeTeleportAction();
    await handle(action, makeBarbarianStats(), campaignName, mapName);

    const saveHandler = addEventListenerSpy.mock.calls.find(
      call => call[0] === 'save-result'
    )?.[1];

    await saveHandler({
      detail: { promptId: 'test-prompt-id', success: false },
    }).catch(() => {});

    expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', saveHandler);
  });
});
