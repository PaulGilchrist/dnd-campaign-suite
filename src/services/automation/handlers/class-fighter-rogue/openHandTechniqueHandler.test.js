// @improved-by-ai
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
      saveType: 'STR',
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
          { name: 'Knock Prone', effect: 'prone' },
          { name: 'Push Away', effect: 'push_15ft' },
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
          saveType: 'STR',
        },
      });
    });

    it('defaults saveType to STR when automation.saveType is absent', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveType: undefined, options: [{ name: 'Knock Prone', effect: 'prone' }] });

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
      buildSaveDc.mockReturnValue(15);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.saveType).toBe('STR');
    });

    it('uses automation.saveType when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveType: 'CON', options: [{ name: 'Knock Prone', effect: 'prone' }] });

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
      buildSaveDc.mockReturnValue(15);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.saveType).toBe('CON');
    });

    it('sets targetName to null when combat context is unavailable', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });

      getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetName).toBeNull();
    });

    it('sets targetName to null when target lookup returns null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetName).toBeNull();
    });

    it('logs an ability_use entry referencing the target when one exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });

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

    it('logs an ability_use entry without a target reference when no target', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });

      getCombatContext.mockResolvedValue(null);

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestMonk',
        abilityName: 'Open Hand Technique',
        description: 'Open Hand Technique used',
      });
    });

    it('does not throw when addEntry rejects', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(13);
      addEntry.mockReturnValue(Promise.reject(new Error('log failure')));

      await expect(handle(action, ps, campaignName, null)).resolves.not.toThrow();

      addEntry.mockRestore();
    });
  });

  describe('popup flow (no options)', () => {
    it('returns an automation_info popup when automation has no options', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(13);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Open Hand Technique');
      expect(result.payload.automationType).toBe('open_hand');
      expect(result.payload.description).toContain('STR saving throw');
      expect(result.payload.description).toContain('DC 13');
      expect(result.payload.automation).toBe(action.automation);
    });

    it('shows the correct save type and DC in the popup description', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveType: 'CON' });

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
      buildSaveDc.mockReturnValue(16);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('CON saving throw');
      expect(result.payload.description).toContain('DC 16');
    });
  });
});

// ── Tests: applyOpenHandTechnique() ────────────────────────────

describe('openHandTechniqueHandler.applyOpenHandTechnique', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with target', () => {
    it('clears pendingRiderChoice and returns a popup with save listener result', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });

      const result = await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Knock Prone', 13, 'STR',
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'pendingRiderChoice', null, campaignName);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'STR',
        saveDc: 13,
      });
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('applies the effect and logs failure when save fails', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Knock Prone', 13, 'STR',
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
        saveType: 'STR',
        saveResult: 'failure',
        total: 8,
        rolls: [5],
        bonus: 3,
        formula: '1d20+3',
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
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });
      const savePromise = Promise.resolve({ success: true, total: 15, roll: 10, saveBonus: 5 });
      createSaveListener.mockReturnValue({ promise: savePromise });

      await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Knock Prone', 13, 'STR',
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
        formula: '1d20+5',
      });

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        campaignName, 'targetEffects', expect.any(Array), campaignName,
      );
    });

    it('appends new effect to existing targetEffects array', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      const existingEffect = {
        target: 'Goblin', source: 'Other Ability', option: 'Other',
        effect: 'other', value: null, duration: 'until_start_of_next_turn',
      };
      getRuntimeValue.mockReturnValue([existingEffect]);

      await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Knock Prone', 13, 'STR',
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
        action, ps, campaignName, 'Goblin', 'Push Far', 13, 'STR',
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

    it('returns a result message indicating success when save passes', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });
      const savePromise = Promise.resolve({ success: true, total: 15, roll: 10, saveBonus: 5 });
      createSaveListener.mockReturnValue({ promise: savePromise });

      const result = await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Knock Prone', 13, 'STR',
      );

      expect(result.payload.description).toContain('Success');
      expect(result.payload.description).toContain('No effect applied');
    });

    it('returns a result message indicating failure and effect description when save fails', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Push Away', effect: 'push_15ft' }] });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      const result = await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Push Away', 13, 'STR',
      );

      expect(result.payload.description).toContain('Failure');
      expect(result.payload.description).toContain('target pushed 15 ft away');
    });

    it('builds an effect description for unknown effect types using the option name', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Unique Effect', effect: 'custom_effect' }] });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      const result = await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Unique Effect', 13, 'STR',
      );

      expect(result.payload.description).toContain('Unique Effect');
    });

    it('omits the bonus from the formula when saveBonus is zero', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });
      const savePromise = Promise.resolve({ success: false, total: 5, roll: 5, saveBonus: 0 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Knock Prone', 13, 'STR',
      );

      const logEntry = addEntry.mock.calls.find(
        (c) => c[1]?.formula === '1d20',
      );
      expect(logEntry).toBeDefined();
    });

    it('handles null/undefined roll values with null-coalesced defaults in log entry', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });
      const savePromise = Promise.resolve({ success: false, total: null, roll: undefined, saveBonus: null });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Knock Prone', 13, 'STR',
      );

      const logEntry = addEntry.mock.calls.find(
        (c) => c[1]?.saveResult === 'failure',
      );
      expect(logEntry).toBeDefined();
      expect(logEntry[1].total).toBe(0);
      expect(logEntry[1].rolls).toEqual([0]);
      expect(logEntry[1].bonus).toBe(0);
      expect(logEntry[1].formula).toBe('1d20+null');
    });
  });

  describe('without target', () => {
    it('returns a popup noting no target when targetName is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });

      const result = await applyOpenHandTechnique(
        action, ps, campaignName, null, 'Knock Prone', 13, 'STR',
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
      expect(result.payload.description).toContain('effect noted for manual application');
    });

    it('returns a popup noting no target when targetName is undefined', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });

      const result = await applyOpenHandTechnique(
        action, ps, campaignName, undefined, 'Knock Prone', 13, 'STR',
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('does not invoke createSaveListener when there is no target', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });

      await applyOpenHandTechnique(
        action, ps, campaignName, null, 'Knock Prone', 13, 'STR',
      );

      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('still clears pendingRiderChoice when there is no target', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });

      await applyOpenHandTechnique(
        action, ps, campaignName, null, 'Knock Prone', 13, 'STR',
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'pendingRiderChoice', null, campaignName);
    });
  });

  describe('missing or mismatched option', () => {
    it('returns null when selected option name does not match any automation option', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone' }] });

      const result = await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Nonexistent Option', 13, 'STR',
      );

      expect(result).toBeNull();
    });

    it('returns null when automation has no options array', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: null });

      const result = await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Any', 13, 'STR',
      );

      expect(result).toBeNull();
    });

    it('returns null when automation options is an empty array', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [] });

      const result = await applyOpenHandTechnique(
        action, ps, campaignName, 'Goblin', 'Any', 13, 'STR',
      );

      expect(result).toBeNull();
    });
  });
});
