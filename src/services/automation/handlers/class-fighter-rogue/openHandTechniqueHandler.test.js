import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
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
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
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

// ── Tests ──────────────────────────────────────────────────────

describe('openHandTechniqueHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with options (modal flow)', () => {
    it('should return modal result when automation has options', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Knock Prone', effect: 'prone' },
          { name: 'Push Away', effect: 'push_15ft' },
          { name: 'Focus', effect: 'disadvantage_next_attack' },
          { name: 'Sever Connections', effect: 'no_reactions' },
        ],
      });

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(13);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('openHandTechnique');
      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBe(ps);
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.targetName).toBe('Goblin');
      expect(result.payload.saveDc).toBe(13);
      expect(result.payload.saveType).toBe('STR');
    });

    it('should default saveType to STR when auto.saveType is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        saveType: undefined,
        options: [{ name: 'Knock Prone', effect: 'prone' }],
      });

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
      buildSaveDc.mockReturnValue(15);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.saveType).toBe('STR');
    });

    it('should use custom saveType from automation', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        saveType: 'CON',
        options: [{ name: 'Knock Prone', effect: 'prone' }],
      });

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
      buildSaveDc.mockReturnValue(15);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.saveType).toBe('CON');
    });

    it('should set targetName to null when no combat context', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [{ name: 'Knock Prone', effect: 'prone' }],
      });

      getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetName).toBeNull();
    });

    it('should set targetName to null when target not found', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [{ name: 'Knock Prone', effect: 'prone' }],
      });

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetName).toBeNull();
    });

    it('should log ability_use entry', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [{ name: 'Knock Prone', effect: 'prone' }],
      });

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

    it('should log ability_use entry without target when no target', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [{ name: 'Knock Prone', effect: 'prone' }],
      });

      getCombatContext.mockResolvedValue(null);

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestMonk',
        abilityName: 'Open Hand Technique',
        description: 'Open Hand Technique used',
      });
    });
  });

  describe('without options (popup flow)', () => {
    it('should return popup result when automation has no options', async () => {
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

    it('should default saveType to STR in popup description when missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveType: undefined });

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
      buildSaveDc.mockReturnValue(15);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('STR saving throw');
    });
  });
});

describe('openHandTechniqueHandler.applyOpenHandTechnique', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with target', () => {
    it('should clear pendingRiderChoice and return save listener result', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Knock Prone', effect: 'prone' },
        ],
      });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });

      const result = await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        'Goblin',
        'Knock Prone',
        13,
        'STR',
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

    it('should apply effect when save fails', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Knock Prone', effect: 'prone' },
        ],
      });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });

      await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        'Goblin',
        'Knock Prone',
        13,
        'STR',
      );

      // 2nd call is the save result entry (1st is the save prompt entry)
      expect(addEntry).toHaveBeenNthCalledWith(2, campaignName, {
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
        timestamp: expect.any(Number),
      });
    });

    it('should log success when save succeeds', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Knock Prone', effect: 'prone' },
        ],
      });
      const savePromise = Promise.resolve({ success: true, total: 15, roll: 10, saveBonus: 5 });
      createSaveListener.mockReturnValue({ promise: savePromise });

      await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        'Goblin',
        'Knock Prone',
        13,
        'STR',
      );

      // 2nd call is the save result entry (1st is the save prompt entry)
      expect(addEntry).toHaveBeenNthCalledWith(2, campaignName, {
        type: 'roll',
        name: 'Open Hand Technique',
        characterName: 'TestMonk',
        rollType: 'save-damage',
        targetName: 'Goblin',
        saveDc: 13,
        saveType: 'STR',
        saveResult: 'success',
        total: 15,
        rolls: [10],
        bonus: 5,
        formula: '1d20+5',
        timestamp: expect.any(Number),
      });
    });

    it('should not apply effect when save succeeds', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Knock Prone', effect: 'prone' },
        ],
      });
      const savePromise = Promise.resolve({ success: true, total: 15, roll: 10, saveBonus: 5 });
      createSaveListener.mockReturnValue({ promise: savePromise });

      await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        'Goblin',
        'Knock Prone',
        13,
        'STR',
      );

      // targetEffects should NOT have been updated
      expect(getRuntimeValue).not.toHaveBeenCalledWith(campaignName, 'targetEffects');
    });

    it('should push effect to targetEffects when save fails', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Push Away', effect: 'push_15ft' },
        ],
      });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        'Goblin',
        'Push Away',
        13,
        'STR',
      );

      expect(getRuntimeValue).toHaveBeenCalledWith(campaignName, 'targetEffects');
      expect(setRuntimeValue).toHaveBeenCalledWith(campaignName, 'targetEffects', [
        {
          target: 'Goblin',
          source: 'Open Hand Technique',
          option: 'Push Away',
          effect: 'push_15ft',
          value: null,
          duration: 'until_start_of_next_turn',
        },
      ], campaignName);
    });

    it('should append to existing targetEffects', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Knock Prone', effect: 'prone' },
        ],
      });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([
        { target: 'Goblin', source: 'Other Ability', option: 'Other', effect: 'other', value: null, duration: 'until_start_of_next_turn' },
      ]);

      await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        'Goblin',
        'Knock Prone',
        13,
        'STR',
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(campaignName, 'targetEffects', [
        { target: 'Goblin', source: 'Other Ability', option: 'Other', effect: 'other', value: null, duration: 'until_start_of_next_turn' },
        {
          target: 'Goblin',
          source: 'Open Hand Technique',
          option: 'Knock Prone',
          effect: 'prone',
          value: null,
          duration: 'until_start_of_next_turn',
        },
      ], campaignName);
    });

    it('should handle option with value field', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Push Far', effect: 'push_15ft', value: 30 },
        ],
      });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        'Goblin',
        'Push Far',
        13,
        'STR',
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(campaignName, 'targetEffects', [
        {
          target: 'Goblin',
          source: 'Open Hand Technique',
          option: 'Push Far',
          effect: 'push_15ft',
          value: 30,
          duration: 'until_start_of_next_turn',
        },
      ], campaignName);
    });

    it('should build success result message when save passes', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Knock Prone', effect: 'prone' },
        ],
      });
      const savePromise = Promise.resolve({ success: true, total: 15, roll: 10, saveBonus: 5 });
      createSaveListener.mockReturnValue({ promise: savePromise });

      const result = await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        'Goblin',
        'Knock Prone',
        13,
        'STR',
      );

      expect(result.payload.description).toContain('Success');
      expect(result.payload.description).toContain('No effect applied');
    });

    it('should build failure result message with effect description when save fails', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Push Away', effect: 'push_15ft' },
        ],
      });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      const result = await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        'Goblin',
        'Push Away',
        13,
        'STR',
      );

      expect(result.payload.description).toContain('Failure');
      expect(result.payload.description).toContain('target pushed 15 ft away');
    });

    it('should handle disadvantage_next_attack effect description', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Focus', effect: 'disadvantage_next_attack' },
        ],
      });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      const result = await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        'Goblin',
        'Focus',
        13,
        'STR',
      );

      expect(result.payload.description).toContain('Disadvantage on its next attack roll');
    });

    it('should handle no_reactions effect description', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Sever Connections', effect: 'no_reactions' },
        ],
      });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      const result = await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        'Goblin',
        'Sever Connections',
        13,
        'STR',
      );

      expect(result.payload.description).toContain("can't take Reactions until the start of your next turn");
    });

    it('should handle unknown effect type by returning option name', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Unknown Effect', effect: 'custom_effect' },
        ],
      });
      const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      const result = await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        'Goblin',
        'Unknown Effect',
        13,
        'STR',
      );

      expect(result.payload.description).toContain('Unknown Effect');
    });

    it('should handle zero bonus in formula', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Knock Prone', effect: 'prone' },
        ],
      });
      const savePromise = Promise.resolve({ success: false, total: 5, roll: 5, saveBonus: 0 });
      createSaveListener.mockReturnValue({ promise: savePromise });
      getRuntimeValue.mockReturnValue([]);

      await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        'Goblin',
        'Knock Prone',
        13,
        'STR',
      );

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        formula: '1d20',
      }));
    });
  });

  describe('without target', () => {
    it('should return popup noting no target when targetName is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Knock Prone', effect: 'prone' },
        ],
      });

      const result = await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        null,
        'Knock Prone',
        13,
        'STR',
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
      expect(result.payload.description).toContain('effect noted for manual application');
    });

    it('should return popup noting no target when targetName is undefined', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Knock Prone', effect: 'prone' },
        ],
      });

      const result = await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        undefined,
        'Knock Prone',
        13,
        'STR',
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('should not call createSaveListener when no target', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Knock Prone', effect: 'prone' },
        ],
      });

      await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        null,
        'Knock Prone',
        13,
        'STR',
      );

      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('should still clear pendingRiderChoice when no target', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Knock Prone', effect: 'prone' },
        ],
      });

      await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        null,
        'Knock Prone',
        13,
        'STR',
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'pendingRiderChoice', null, campaignName);
    });
  });

  describe('missing option', () => {
    it('should return null when selected option name does not match any automation option', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        options: [
          { name: 'Knock Prone', effect: 'prone' },
        ],
      });

      const result = await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        'Goblin',
        'Nonexistent Option',
        13,
        'STR',
      );

      expect(result).toBeNull();
    });

    it('should return null when automation has no options', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      const result = await applyOpenHandTechnique(
        action,
        ps,
        campaignName,
        'Goblin',
        'Any',
        13,
        'STR',
      );

      expect(result).toBeNull();
    });
  });
});
