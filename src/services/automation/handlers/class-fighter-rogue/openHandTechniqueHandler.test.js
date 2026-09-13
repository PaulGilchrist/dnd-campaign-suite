// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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
  getCombatContext: vi.fn().mockImplementation(() => Promise.resolve({ creatures: [{ name: 'Goblin' }] })),
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

    it('sets targetName to null when no combat context or no target is available', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });

      buildSaveDc.mockReturnValue(13);

      getCombatContext.mockResolvedValue(null);
      let result = await handle(action, ps, campaignName, null);
      expect(result.payload.targetName).toBeNull();

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue(null);
      result = await handle(action, ps, campaignName, null);
      expect(result.payload.targetName).toBeNull();
    });

    it('logs an ability_use entry with target reference when target exists, without when it does not', async () => {
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

      vi.clearAllMocks();
      getTargetFromAttacker.mockReturnValue(null);
      buildSaveDc.mockReturnValue(13);

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestMonk',
        abilityName: 'Open Hand Technique',
        description: 'Open Hand Technique used',
      });
    });
  });

  describe('popup flow (no options)', () => {
    it('returns an automation_info popup when automation has no options', async () => {
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

    it('returns an automation_info popup when automation.options is null, undefined, or empty', async () => {
      const ps = makePlayerStats();
      buildSaveDc.mockReturnValue(14);

      let action = makeAction({ options: [] });
      let result = await handle(action, ps, campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('DC 14');

      action = makeAction({ options: null });
      result = await handle(action, ps, campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');

      action = makeAction({ options: undefined });
      result = await handle(action, ps, campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
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

      const result = await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: 'Goblin', selectedOptionName: 'Knock Prone', saveDc: 13,
        });

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

      await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: 'Goblin', selectedOptionName: 'Knock Prone', saveDc: 13,
        });

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
        'campaign',
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

      await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: 'Goblin', selectedOptionName: 'Knock Prone', saveDc: 13,
        });

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
        'campaign', 'targetEffects', expect.any(Array), campaignName,
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

      await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: 'Goblin', selectedOptionName: 'Knock Prone', saveDc: 13,
        });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        expect.arrayContaining([existingEffect]),
        campaignName,
      );
    });

    it('does not apply push_15ft as targetEffect', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Push Far', effect: 'push_15ft', value: 30 }] });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: 'Goblin', selectedOptionName: 'Push Far', saveDc: 13,
        });

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        expect.anything(),
        campaignName,
      );
    });

    it('returns a result message indicating success when save succeeds, failure with effect when it fails', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });
      const savePromise = Promise.resolve({ success: true, total: 15, roll: 10, saveBonus: 5 });
      createSaveListener.mockReturnValue({ promise: savePromise });

      let result = await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: 'Goblin', selectedOptionName: 'Knock Prone', saveDc: 13,
        });
      expect(result.payload.description).toContain('Success');
      expect(result.payload.description).toContain('No effect applied');

      vi.clearAllMocks();
      action.automation.options = [{ name: 'Push Away', effect: 'push_15ft', saveType: 'STR' }];
      createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 }) });
      getRuntimeValue.mockReturnValue([]);

      result = await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: 'Goblin', selectedOptionName: 'Push Away', saveDc: 13,
        });
      expect(result.payload.description).toContain('Failure');
      expect(result.payload.description).toContain('target pushed 15 ft away');
    });

    it('builds an effect description for unknown effect types using the option name', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Unique Effect', effect: 'custom_effect' }] });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      const result = await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: 'Goblin', selectedOptionName: 'Unique Effect', saveDc: 13,
        });

      expect(result.payload.description).toContain('Unique Effect');
    });
  });

  describe('without target', () => {
    it('returns a popup noting no target and clears pendingRiderChoice when targetName is null or undefined', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });

      let result = await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: null, selectedOptionName: 'Knock Prone', saveDc: 13,
        });
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
      expect(result.payload.description).toContain('effect noted for manual application');
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'pendingRiderChoice', null, campaignName);

      vi.clearAllMocks();
      result = await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: undefined, selectedOptionName: 'Knock Prone', saveDc: 13,
        });
      expect(result.payload.description).toContain('No target selected');
      expect(createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('mismatched or missing option', () => {
    it('returns null when the option name does not match, or options array is null/empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });

      let result = await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: 'Goblin', selectedOptionName: 'Nonexistent Option', saveDc: 13,
        });
      expect(result).toBeNull();

      vi.clearAllMocks();
      action.automation.options = null;
      result = await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: 'Goblin', selectedOptionName: 'Any', saveDc: 13,
        });
      expect(result).toBeNull();

      vi.clearAllMocks();
      action.automation.options = [];
      result = await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: 'Goblin', selectedOptionName: 'Any', saveDc: 13,
        });
      expect(result).toBeNull();
    });
  });

  describe('auto.options fallback', () => {
    it('uses action.options when automation or automation.options is missing', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Open Hand Technique',
        options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }],
      };
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      let result = await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: 'Goblin', selectedOptionName: 'Knock Prone', saveDc: 13,
        });
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');

      vi.clearAllMocks();
      action.automation = undefined;
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      result = await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: 'Goblin', selectedOptionName: 'Knock Prone', saveDc: 13,
        });
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });
  });

  describe('error handling', () => {
    it('returns a popup result when addEntry rejects in any path', async () => {
      const ps = makePlayerStats();

      // save listener path
      let action = makeAction({ options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }] });
      createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 }) });
      getRuntimeValue.mockReturnValue([]);
      addEntry.mockReturnValue(Promise.reject(new Error('log failure')));

      let result = await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: 'Goblin', selectedOptionName: 'Knock Prone', saveDc: 13,
        });
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');

      vi.clearAllMocks();

      // addled effect path
      action = makeAction({ options: [{ name: 'Disarm', effect: 'addled', saveType: 'STR' }] });
      addEntry.mockReturnValue(Promise.reject(new Error('log failure')));

      result = await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: 'Goblin', selectedOptionName: 'Disarm', saveDc: 13,
        });
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');

      vi.clearAllMocks();

      // push_15ft path
      action = makeAction({ options: [{ name: 'Push Far', effect: 'push_15ft', value: 30 }] });
      createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 }) });
      getRuntimeValue.mockReturnValue([]);
      addEntry.mockReturnValue(Promise.reject(new Error('log failure')));

      result = await applyOpenHandTechnique({
          action, playerStats: ps, campaignName, targetName: 'Goblin', selectedOptionName: 'Push Far', saveDc: 13,
        });
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });
  });
});
