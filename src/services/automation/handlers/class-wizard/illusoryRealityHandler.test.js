// @maintained-by-ai
// Unit tests for illusoryRealityHandler (Wizard illusion feature: make one inanimate object real).
// Deterministic: runtime store, combat context, and log IO are all mocked; tests pin branch
// behaviour, runtime-key wiring, and full-string popup composition. No timers — turn-based only.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  handle,
  confirmIllusoryReality,
} from './illusoryRealityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../../services/rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockReturnValue(undefined),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 14,
    proficiency: 6,
    ...overrides,
  };
}

function makeAction(automation = {}, name = 'Illusory Reality') {
  const action = { automation: { type: 'illusory_reality', ...automation } };
  if (name !== undefined) action.name = name;
  return action;
}

function setupMocks() {
  vi.clearAllMocks();
  getRuntimeValue.mockImplementation(() => null);
  getCombatContext.mockResolvedValue({ round: 1, activeCreatureName: 'TestWizard' });
  addEntry.mockResolvedValue(undefined);
}

describe('illusoryRealityHandler.handle', () => {
  beforeEach(setupMocks);

  it('delegates the once-per-turn latch to checkOncePerTurn and returns its popup', async () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'illusoryRealityUsedRound') return { round: 1, activeCreature: 'TestWizard' };
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName);

    expect(getRuntimeValue).toHaveBeenCalledWith('TestWizard', 'illusoryRealityUsedRound');
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Illusory Reality');
    expect(result.payload.description).toBe('Illusory Reality can only be used once per turn.');
  });

  it('returns modal with action, playerStats, and campaignName once the latch has re-armed', async () => {
    getCombatContext.mockResolvedValue({ round: 2, activeCreatureName: 'TestWizard' });
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'illusoryRealityUsedRound') return { round: 1, activeCreature: 'TestWizard' };
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('illusoryReality');
    expect(result.payload.action).toEqual(makeAction());
    expect(result.payload.playerStats).toEqual(makePlayerStats());
    expect(result.payload.campaignName).toBe(campaignName);
    expect(getRuntimeValue).toHaveBeenCalledWith('TestWizard', 'illusoryRealityObject', campaignName);
  });

  it.each([
    { actionName: undefined, featureName: 'Illusory Reality' },
    { actionName: 'Custom Feature', featureName: 'Custom Feature' },
  ])('returns already-real popup with interpolated name ($actionName)', async ({ actionName, featureName }) => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'illusoryRealityObject') return 'Ladder';
      return null;
    });

    const result = await handle(makeAction({}, actionName), makePlayerStats(), campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe(featureName);
    expect(result.payload.description).toBe(
      `${featureName}: An object is already real (Ladder). It remains real until you roll initiative, finish a short rest, or finish a long rest. Use this Bonus Action again to make a different object real (the previous object disappears).`
    );
    expect(result.payload.automation).toEqual({ type: 'illusory_reality' });
  });
});

describe('illusoryRealityHandler.confirmIllusoryReality', () => {
  beforeEach(setupMocks);

  it.each([
    { objectName: '', label: 'empty string' },
    { objectName: null, label: 'null' },
    { objectName: undefined, label: 'undefined' },
    { objectName: 123, label: 'non-string' },
    { objectName: '   ', label: 'whitespace only' },
  ])('returns error popup with no writes when objectName is $label', async ({ objectName }) => {
    const result = await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, objectName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Illusory Reality');
    expect(result.payload.description).toBe('Illusory Reality: You must specify an inanimate, nonmagical object that is part of an illusion spell you cast with a spell slot.');
    expect(result.payload.automation).toEqual(makeAction().automation);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('stores trimmed object name, marks used round, and returns success popup', async () => {
    const result = await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, '  Ladder  ');

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe('<b>Illusory Reality</b><br/><br/>You use your Bonus Action to make the object <b>"Ladder"</b> real.<br/><br/>The object cannot deal damage or impose any conditions.<br/><br/><em>The object persists until you roll initiative, finish a short rest, or finish a long rest. It disappears if you use this feature again.</em>');
    expect(result.payload.automation).toEqual(makeAction().automation);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard',
      'illusoryRealityObject',
      'Ladder',
      campaignName,
      true,
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard',
      'illusoryRealityUsedRound',
      { round: 1, activeCreature: 'TestWizard' },
      campaignName,
    );
  });

  it('logs an ability_use entry with the trimmed object name', async () => {
    await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, ' Candle ');

    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestWizard',
      abilityName: 'Illusory Reality',
      description: 'TestWizard used Illusory Reality — the object "Candle" becomes real.',
      timestamp: expect.any(Number),
    }));
  });

  it('uses custom featureName from action.name in popup and log', async () => {
    const customAction = makeAction({}, 'Custom Illusory');

    const result = await confirmIllusoryReality(customAction, makePlayerStats(), campaignName, 'Ladder');

    expect(result.payload.name).toBe('Custom Illusory');
    expect(result.payload.description).toContain('<b>Custom Illusory</b>');
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      abilityName: 'Custom Illusory',
      description: 'TestWizard used Custom Illusory — the object "Ladder" becomes real.',
    }));
  });
});
