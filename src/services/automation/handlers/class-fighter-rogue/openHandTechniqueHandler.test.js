// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyOpenHandTechnique } from './openHandTechniqueHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../../automation/common/savePrompt.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestMonk',
    level: 5,
    proficiencyBonus: 3,
    proficiency: 3,
    abilities: [
      { name: 'Strength', bonus: 2 },
      { name: 'Wisdom', bonus: 1 },
    ],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Open Hand Technique',
    automation: {
      type: 'open_hand',
      ...automation,
    },
  };
}

// ── Tests: handle() ───────────────────────────────────────────

describe('openHandTechniqueHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('modal flow (options present)', () => {
    it('returns a modal result with correct payload when automation has options', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Knock Prone', effect: 'prone', saveType: 'DEX' },
          { name: 'Push Away', effect: 'push_15ft', saveType: 'STR' },
        ],
      });

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(13);

      const result = await handle(action, ps, campaignName, null);

      expect(result).toEqual({
        type: 'modal',
        modalName: 'openHandTechnique',
        payload: {
          action,
          playerStats: ps,
          campaignName,
          targetName: 'Goblin',
          saveDc: 13,
        },
      });
    });

    it('does not include a global saveType in the payload since each option has its own save type', async () => {
      const ps = makePlayerStats();
      const actionWithSaveType = makeAction({ saveType: 'CON', options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });
      const actionNoSaveType = makeAction({ saveType: undefined, options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
      buildSaveDc.mockReturnValue(15);

      const resultWithSaveType = await handle(actionWithSaveType, ps, campaignName, null);
      expect(resultWithSaveType.payload.saveType).toBeUndefined();

      const resultNoSaveType = await handle(actionNoSaveType, ps, campaignName, null);
      expect(resultNoSaveType.payload.saveType).toBeUndefined();
    });

    it('sets targetName to null when no target is available', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });

      getCombatContext.mockResolvedValue(null);
      const resultNoContext = await handle(action, ps, campaignName, null);
      expect(resultNoContext.payload.targetName).toBeNull();

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue(null);
      const resultNoTarget = await handle(action, ps, campaignName, null);
      expect(resultNoTarget.payload.targetName).toBeNull();
    });

    it('logs an ability_use entry with or without a target reference', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(13);

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestMonk',
        abilityName: 'Open Hand Technique',
        description: 'Open Hand Technique used against Goblin',
      });
    });

    it('does not throw when addEntry rejects', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(13);
      addEntry.mockReturnValue(Promise.reject(new Error('log failure')));

      await expect(handle(action, ps, campaignName, null)).resolves.not.toThrow();

      addEntry.mockRestore();
    });
  });

  describe('popup flow (no options)', () => {
    it('returns an automation_info popup without a specific save type in the description', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveType: 'CON' });

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
      buildSaveDc.mockReturnValue(16);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Open Hand Technique');
      expect(result.payload.automationType).toBe('open_hand');
      expect(result.payload.description).toContain('saving throw');
      expect(result.payload.description).toContain('DC 16');
      expect(result.payload.automation).toBe(action.automation);
    });
  });
});

// ── Tests: applyOpenHandTechnique() ────────────────────────────

describe('openHandTechniqueHandler.applyOpenHandTechnique', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with target', () => {
    it('clears pendingRiderChoice, creates a save listener, and returns a popup', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });

      const result = await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Knock Prone', 13,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'pendingRiderChoice', null, campaignName);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'DEX',
        saveDc: 13,
      });
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('applies the effect and logs failure when save fails', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Knock Prone', 13,
      );

      const logEntry = addEntry.mock.calls.find(
        (c) => c[1]?.saveResult === 'failure',
      );
      expect(logEntry).toBeDefined();
      expect(logEntry[1]).toMatchObject({
        type: 'roll',
        name: 'Open Hand Technique',
        characterName: 'TestMonk',
        rollType: 'save-damage',
        targetName: 'Goblin',
        saveDc: 13,
        saveType: 'DEX',
        saveResult: 'failure',
        total: 8,
        rolls: [5],
        bonus: 3,
      });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'Goblin',
            source: 'Open Hand Technique',
            option: 'Knock Prone',
            effect: 'prone',
          }),
        ]),
        campaignName,
      );
    });

    it('logs success and skips effect application when save succeeds', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });
      const savePromise = Promise.resolve({ success: true, total: 15, roll: 10, saveBonus: 5 });
      createSaveListener.mockReturnValue({ promise: savePromise });

      await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Knock Prone', 13,
      );

      const logEntry = addEntry.mock.calls.find(
        (c) => c[1]?.saveResult === 'success',
      );
      expect(logEntry).toBeDefined();
      expect(logEntry[1]).toMatchObject({
        type: 'roll',
        saveResult: 'success',
        total: 15,
        rolls: [10],
        bonus: 5,
      });

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        campaignName, 'targetEffects', expect.any(Array), campaignName,
      );
    });

    it('appends new effect to existing targetEffects array', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      const existingEffect = {
        target: 'Goblin', source: 'Other Ability', option: 'Other',
        effect: 'other', value: null, duration: 'until_start_of_next_turn',
      };
      getRuntimeValue.mockReturnValue([existingEffect]);

      await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Knock Prone', 13,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([existingEffect]),
        campaignName,
      );
    });

    it('preserves the option value field in the effect entry', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Push Far', effect: 'push_15ft', value: 30 }] });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Push Far', 13,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({ effect: 'push_15ft', value: 30 }),
        ]),
        campaignName,
      );
    });

    it('returns a result message indicating success or failure with effect description', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });
      const successSave = Promise.resolve({ success: true, total: 15, roll: 10, saveBonus: 5 });
      createSaveListener.mockReturnValue({ promise: successSave });

      const successResult = await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Knock Prone', 13,
      );
      expect(successResult.payload.description).toContain('Success');
      expect(successResult.payload.description).toContain('No effect applied');

      const failAction = makeAction({ options: [{ name: 'Push Away', effect: 'push_15ft', saveType: 'STR' }] });
      const failSave = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: failSave });
      getRuntimeValue.mockReturnValue([]);

      const failResult = await applyOpenHandTechnique(
        failAction, ps, campaignName, 'Goblin', 'Push Away', 13,
      );
      expect(failResult.payload.description).toContain('Failure');
      expect(failResult.payload.description).toContain('target pushed 15 ft away');
    });

    it('builds an effect description for unknown effect types using the option name', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Unique Effect', effect: 'custom_effect' }] });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      const result = await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Unique Effect', 13,
      );

      expect(result.payload.description).toContain('Unique Effect');
    });
  });

  describe('without target', () => {
    it('returns a popup noting no target and still clears pendingRiderChoice for null or undefined', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });

      const resultNull = await applyOpenHandTechnique(
        action, ps, campaignName, null, 'Knock Prone', 13,
      );
      expect(resultNull.type).toBe('popup');
      expect(resultNull.payload.type).toBe('automation_info');
      expect(resultNull.payload.description).toContain('No target selected');
      expect(resultNull.payload.description).toContain('effect noted for manual application');

      const resultUndefined = await applyOpenHandTechnique(
        action, ps, campaignName, undefined, 'Knock Prone', 13,
      );
      expect(resultUndefined.payload.description).toContain('No target selected');

      expect(createSaveListener).not.toHaveBeenCalled();
      expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'pendingRiderChoice', null, campaignName);
    });
  });

  describe('missing or mismatched option', () => {
    it('returns null when the option does not match or options array is missing/empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });

      expect(await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Nonexistent Option', 13,
      )).toBeNull();

      expect(await applyOpenHandTechnique(
        makeAction({ options: null }), ps, campaignName, 'Goblin', 'Any', 13,
      )).toBeNull();

      expect(await applyOpenHandTechnique(
        makeAction({ options: [] }), ps, campaignName, 'Goblin', 'Any', 13,
      )).toBeNull();
    });
  });
});
