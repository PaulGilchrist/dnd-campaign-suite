// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
  setRuntimeObject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
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
  getCurrentCombatRound: vi.fn(() => 1),
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
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
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
      range: '30 ft',
      teleportRange: '5 ft',
      ...automation,
    },
  };
}

// CLA-041: handler is rage-gated — default store has Rage ACTIVE (mirrors
// combatStanceHandler writing activeBuffs {name:'Rage'} on rage press).
function ragingStore(extra = {}) {
  return (key, subkey) => {
    if (subkey === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
    if (Object.prototype.hasOwnProperty.call(extra, `${key}.${subkey}`)) return extra[`${key}.${subkey}`];
    return null;
  };
}

function getSaveHandler() {
  return addEventListenerSpy.mock.calls.find(call => call[0] === 'save-result')?.[1];
}

beforeEach(() => {
  vi.clearAllMocks();
  useRuntimeState.getRuntimeValue.mockImplementation(ragingStore());
  useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
  rangeValidation.rangeToFeet.mockReturnValue(30);
  rangeCheck.isWithinRange.mockResolvedValue(true);
  abilityLookup.getAbilityModifier.mockReturnValue(4);
  combatData.getActiveCreatureName.mockReturnValue(null);
  combatData.loadCombatSummary.mockResolvedValue(undefined);
  combatData.getCombatSummary.mockReturnValue(null);
  combatData.getCurrentCombatRound.mockReturnValue(1);
  addEventListenerSpy = vi.fn();
  removeEventListenerSpy = vi.fn();
  Object.defineProperty(window, 'addEventListener', { value: addEventListenerSpy, writable: true, configurable: true });
  Object.defineProperty(window, 'removeEventListener', { value: removeEventListenerSpy, writable: true, configurable: true });
});

describe('branchesOfTheTree (teleport_and_slow)', () => {
  it('refuses when Rage is not active, logs refusal, opens no save prompt (CLA-041 defect 3)', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((key, subkey) => {
      if (subkey === 'activeBuffs') return [];
      return null;
    });

    const action = makeTeleportAction();
    const result = await handle(action, makeBarbarianStats(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toMatch(/refused — Rage is not active/);
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'automation',
        automationType: 'branches_of_the_tree_refused',
        characterName: 'Thulgar',
        reason: 'not_raging',
      })
    );
  });

  it('refusal leg spends nothing — latch stays unstamped (CLA-041)', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((key, subkey) => {
      if (subkey === 'activeBuffs') return [];
      return null;
    });

    await handle(makeTeleportAction(), makeBarbarianStats(), campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'Thulgar',
      '_Branches_of_the_Tree_usedRound',
      expect.anything(),
      campaignName
    );
  });

  it('resolves trigger target from campaign-root activeCreatureName, not the stale cs mirror (CLA-041 defect 2)', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Wild_Sage_Druid');
    useRuntimeState.getRuntimeValue.mockImplementation(ragingStore({
      'campaign.activeCreatureName': 'Bandit 1',
    }));

    await handle(makeTeleportAction(), makeBarbarianStats(), campaignName, mapName);

    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Bandit 1',
      saveType: 'STR',
      saveDc: 15,
      attackerName: 'Thulgar',
    });
  });

  it('falls back to cached cs mirror when campaign-root truth is absent', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Goblin');

    const action = makeTeleportAction();
    const result = await handle(action, makeBarbarianStats(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'STR',
      saveDc: 15,
      attackerName: 'Thulgar',
    });
  });

  it('refuses a second press in the same round via reaction latch (CLA-041 defect 5)', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Bandit 1');
    useRuntimeState.getRuntimeValue.mockImplementation(ragingStore({
      'Thulgar._Branches_of_the_Tree_usedRound': 1,
    }));

    const result = await handle(makeTeleportAction(), makeBarbarianStats(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toMatch(/already been used this round/);
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'automation',
        automationType: 'branches_of_the_tree_refused',
        reason: 'reaction_spent',
      })
    );
  });

  it('stamps the once-per-round latch when the reaction is accepted (CLA-041 defect 5)', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Bandit 1');

    await handle(makeTeleportAction(), makeBarbarianStats(), campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Thulgar',
      '_Branches_of_the_Tree_usedRound',
      1,
      campaignName
    );
  });

  it('returns popup when no active creature', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((key, subkey) => {
      if (subkey === 'activeBuffs') return [{ name: 'Rage' }];
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
      if (subkey === 'activeBuffs') return [{ name: 'Rage' }];
      if (key === '__map__' && subkey === 'activeMapName') return 'test-map';
      return null;
    });
    const mockCombatSummary = {
      round: 1,
      players: [{ name: 'Thulgar', gridX: 1, gridY: 1 }],
      creatures: [{ name: 'Goblin', gridX: 10, gridY: 10 }],
    };
    combatData.loadCombatSummary.mockResolvedValue(mockCombatSummary);
    combatData.getCombatSummary.mockReturnValue(mockCombatSummary);
    rangeValidation.getDistanceFeet.mockReturnValue(50);
    rangeCheck.isWithinRange.mockResolvedValue(false);

    const action = makeTeleportAction();
    const result = await handle(action, makeBarbarianStats(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('out of range');
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'automation',
        automationType: 'branches_of_the_tree_refused',
        reason: 'out_of_range',
      })
    );
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
      attackerName: 'Thulgar',
    });
  });

  it('proceeds when one creature not on map (assumes in range)', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Goblin');
    useRuntimeState.getRuntimeValue.mockImplementation((key, subkey) => {
      if (subkey === 'activeBuffs') return [{ name: 'Rage' }];
      if (key === '__map__' && subkey === 'activeMapName') return 'test-map';
      return null;
    });
    const mockCombatSummary = {
      round: 1,
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
      attackerName: 'Thulgar',
    });
  });

  it('logs exactly ONE ability_use per press (CLA-041 defect 6 duplicate tail)', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Goblin');

    const action = makeTeleportAction();
    await handle(action, makeBarbarianStats(), campaignName, mapName);

    const abilityUseCalls = logService.addEntry.mock.calls.filter(
      call => call[1]?.type === 'ability_use' && call[1]?.abilityName === 'Branches of the Tree'
    );
    expect(abilityUseCalls).toHaveLength(1);
    expect(abilityUseCalls[0][1].description).toContain('Goblin must make STR save');
  });

  it('on fail: adds speed_reduction targetEffect', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Goblin');

    const action = makeTeleportAction();
    await handle(action, makeBarbarianStats(), campaignName, mapName);

    // Simulate save failure event
    const saveHandler = getSaveHandler();
    expect(saveHandler).toBeDefined();

    await saveHandler({
      detail: { promptId: 'test-prompt-id', success: false },
    }).catch(() => {});

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
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

  it('on fail: teleports — stamps branches_of_the_tree_teleport marker te in the SAME merged write (CLA-384 marker model)', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Bandit 1');
    rangeValidation.rangeToFeet.mockImplementation(r => (String(r).includes('5') ? 5 : 30));

    const action = makeTeleportAction();
    await handle(action, makeBarbarianStats(), campaignName, mapName);

    await getSaveHandler()({ detail: { promptId: 'test-prompt-id', success: false } });

    const teWrite = useRuntimeState.setRuntimeValue.mock.calls.find(
      call => call[0] === 'campaign' && call[1] === 'targetEffects'
    );
    expect(teWrite).toBeDefined();
    expect(teWrite[2]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        effect: 'branches_of_the_tree_teleport',
        target: 'Bandit 1',
        source: 'Branches of the Tree',
        value: 5,
      }),
      expect.objectContaining({
        effect: 'speed_reduction',
        target: 'Bandit 1',
      }),
    ]));
    expect(teWrite[2].filter(te => te.effect === 'branches_of_the_tree_teleport')).toHaveLength(1);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'automation',
        automationType: 'branches_of_the_tree_teleported',
        targetName: 'Bandit 1',
        description: expect.stringContaining('within 5 feet of Thulgar'),
      })
    );
  });

  it('on fail: adds expiration to remove speed_reduction', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Orc');

    const action = makeTeleportAction();
    await handle(action, makeBarbarianStats(), campaignName, mapName);

    await getSaveHandler()({ detail: { promptId: 'test-prompt-id', success: false } });

    expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'Thulgar', targetName: 'Orc', effects: [
        {
          type: 'remove_target_effect',
          effectKey: 'speed_reduction',
          source: 'Branches of the Tree',
          target: 'Orc',
        },
      ], campaignName, rounds: 1 });
  });

  it('on fail: logs save_result with failure', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Goblin');

    const action = makeTeleportAction();
    await handle(action, makeBarbarianStats(), campaignName, mapName);

    await getSaveHandler()({ detail: { promptId: 'test-prompt-id', success: false } });

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'save_result',
        characterName: 'Thulgar',
        targetName: 'Goblin',
        saveType: 'STR',
        saveDc: 15,
        success: false,
        description: expect.stringContaining('failed STR save'),
      })
    );
  });

  it('on success: logs save_result with success, no effects', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Orc');

    const action = makeTeleportAction();
    await handle(action, makeBarbarianStats(), campaignName, mapName);

    await getSaveHandler()({ detail: { promptId: 'test-prompt-id', success: true } });

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
      'campaign',
      'targetEffects',
      expect.any(Array),
      campaignName
    );
  });

  it('removes event listener after save result', async () => {
    combatData.getActiveCreatureName.mockReturnValue('Goblin');

    const action = makeTeleportAction();
    await handle(action, makeBarbarianStats(), campaignName, mapName);

    await getSaveHandler()({ detail: { promptId: 'test-prompt-id', success: false } });

    expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
  });
});
