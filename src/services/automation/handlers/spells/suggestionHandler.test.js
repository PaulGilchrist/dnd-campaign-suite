// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
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

import { handle } from './suggestionHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Suggestion',
    automation: { type: 'suggestion', saveType: 'WIS', saveDc: 15, ...automation },
  };
}

function setupBaseMocks(saveResult = { success: true }) {
  resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
  buildSaveDc.mockReturnValue(15);
  createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve(saveResult),
  });
}

describe('suggestionHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('target resolution', () => {
    it('returns popup when no target is selected', async () => {
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
      expect(result.payload.description).toContain('Suggestion has no effect');
    });

    it('returns popup when target name is missing', async () => {
      resolveTarget.mockResolvedValue({ target: {} });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('calls resolveTarget with campaignName and caster name', async () => {
      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
    });

    it('calls createSaveListener with correct arguments', async () => {
      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 15,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });
  });

  describe('ability_use log entry', () => {
    it('logs ability_use with correct details when a target is resolved', async () => {
      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Suggestion',
        description: expect.stringContaining('TestCaster casts Suggestion on Goblin'),
        promptId: 'test-prompt-id',
      });
    });

    it('uses action.name as abilityName in ability_use entry', async () => {
      setupBaseMocks();

      await handle({ name: 'My Suggestion', automation: { saveType: 'WIS', saveDc: 15 } }, makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        abilityName: 'My Suggestion',
      }));
    });
  });

  describe('successful save', () => {
    it('returns popup with success description', async () => {
      setupBaseMocks({ success: true });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('succeeded on WIS save');
      expect(result.payload.description).toContain('Goblin');
      expect(result.payload.name).toBe('Suggestion');
    });

    it('logs save_result with success=true', async () => {
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: true,
        rollType: 'save-suggestion',
        saveDc: 15,
        saveType: 'WIS',
      }));
    });

    it('does not apply charmed condition or add expiration on success', async () => {
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
      expect(addEntry).toHaveBeenCalledTimes(2);
      const abilityEntries = addEntry.mock.calls.filter(call => call[1].type === 'ability_use');
      expect(abilityEntries.length).toBe(1);
      const saveEntries = addEntry.mock.calls.filter(call => call[1].type === 'save_result');
      expect(saveEntries.length).toBe(1);
    });
  });

  describe('failed save', () => {
    it('applies charmed condition to target', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['charmed']),
        campaignName,
      );
    });

    it('deduplicates charmed condition regardless of case', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(['CHARMED', 'frightened']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['frightened', 'charmed'],
        campaignName,
      );
    });

    it('preserves other conditions when adding charmed', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(['frightened', 'unconscious']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['frightened', 'unconscious', 'charmed'],
        campaignName,
      );
    });

    it('registers expiration with default 24 hour duration', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        expect.arrayContaining([{ type: 'charmed', condition: 'charmed' }]),
        campaignName,
      );
    });

    it('registers expiration with 8 hour duration when auto.duration is true', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction({ duration: true }), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        expect.arrayContaining([{ type: 'charmed', condition: 'charmed' }]),
        campaignName,
      );
    });

    it('posts condition log entry with full note', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Charmed',
        reason: 'Suggestion spell',
        note: expect.stringContaining('pursues the suggested course of activity'),
        timestamp: expect.any(Number),
      }));
    });

    it('logs save_result with success=false', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: false,
        rollType: 'save-suggestion',
        saveDc: 15,
        saveType: 'WIS',
      }));
    });

    it('returns popup with failure description including caster, target, and spell end condition', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Suggestion');
      expect(result.payload.description).toContain('TestCaster');
      expect(result.payload.description).toContain('Goblin');
      expect(result.payload.description).toContain('damage');
      expect(result.payload.description).toContain('Charmed');
    });
  });

  describe('edge cases', () => {
    it('handles missing automation property by defaulting to empty object', async () => {
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle({ name: 'Suggestion' }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenCalledWith({}, makePlayerStats());
    });

    it('ignores the mapName parameter', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, 'some-map');

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
    });

    it('handles undefined or non-array getRuntimeValue by defaulting to empty array', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(undefined);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('uses custom names in popup and ability_use descriptions', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const ps = makePlayerStats({ name: 'WizardX' });
      const result = await handle(makeAction(), ps, campaignName, null);

      expect(result.payload.description).toContain('WizardX');
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: expect.stringContaining('WizardX casts Suggestion'),
      }));
    });
  });
});
