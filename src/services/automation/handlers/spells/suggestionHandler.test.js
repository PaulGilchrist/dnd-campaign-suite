// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
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
import { postLogEntry } from '../../../shared/logPoster.js';
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

    it('returns popup when resolveTarget returns { target: null }', async () => {
      resolveTarget.mockResolvedValue({ target: null });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('returns popup when target info has no target property', async () => {
      resolveTarget.mockResolvedValue({});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('returns popup when target exists but name is undefined', async () => {
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
      });
    });
  });

  describe('ability_use log entry', () => {
    it('logs ability_use when a target is resolved', async () => {
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

    it('includes save DC in ability_use description', async () => {
      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: expect.stringContaining('DC 15'),
      }));
    });

    it('includes save type in ability_use description', async () => {
      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: expect.stringContaining('WIS save'),
      }));
    });
  });

  describe('successful save', () => {
    it('returns popup with success description', async () => {
      setupBaseMocks({ success: true });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('succeeded on WIS save');
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

    it('does not apply charmed condition on success', async () => {
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does not add expiration on success', async () => {
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).not.toHaveBeenCalled();
    });

    it('does not post condition log on success', async () => {
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(postLogEntry).not.toHaveBeenCalled();
    });

    it('includes target name in success popup description', async () => {
      setupBaseMocks({ success: true });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Goblin');
    });

    it('includes action name in success popup', async () => {
      setupBaseMocks({ success: true });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.name).toBe('Suggestion');
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

    it('deduplicates charmed when already present lowercase', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(['charmed']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('deduplicates charmed when already present capitalized', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(['Charmed']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('preserves other conditions when adding charmed', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(['frightened', 'charmed']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['frightened', 'charmed'],
        campaignName,
      );
    });

    it('filters charmed by case-insensitive comparison', async () => {
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

    it('registers expiration with default 24 hour duration', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        expect.arrayContaining([{ type: 'charmed', condition: 'charmed' }]),
        campaignName,
        24,
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
        8,
      );
    });

    it('posts condition log entry with full note', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(postLogEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Charmed',
        reason: 'Suggestion spell',
        note: expect.stringContaining('pursues the suggested course of activity'),
        timestamp: expect.any(Number),
      }));
    });

    it('posts condition log mentioning caster in note', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const logCall = postLogEntry.mock.calls[0][1];
      expect(logCall.note).toContain('TestCaster');
      expect(logCall.note).toContain('damage');
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

    it('includes caster name in popup description', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('TestCaster');
    });

    it('includes target name in popup description', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Goblin');
    });

    it('mentions spell end condition in popup', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('damage');
      expect(result.payload.description).toContain('Charmed');
    });

    it('returns popup with correct payload type on failure', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Suggestion');
    });

    it('calls addEntry before setting runtime values (order matters)', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // ability_use should be first, save_result should be after charmed application
      const abilityUseCall = addEntry.mock.calls.findIndex(
        call => call[1].type === 'ability_use',
      );
      const saveResultCall = addEntry.mock.calls.findIndex(
        call => call[1].type === 'save_result',
      );
      expect(abilityUseCall).toBeLessThan(saveResultCall);
    });
  });

  describe('edge cases', () => {
    it('uses default DC 10 when automation is empty', async () => {
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle({ name: 'Suggestion', automation: {} }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenCalledWith({}, makePlayerStats());
    });

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

    it('handles undefined getRuntimeValue by defaulting to empty array', async () => {
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

    it('handles non-array getRuntimeValue by defaulting to empty array', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue('not-an-array');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('handles zero getRuntimeValue by defaulting to empty array', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(0);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('uses action.name in popup payload', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle({ name: 'My Custom Suggestion', automation: { type: 'suggestion' } }, makePlayerStats(), campaignName, null);

      expect(result.payload.name).toBe('My Custom Suggestion');
    });

    it('uses custom playerStats name in descriptions', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const ps = makePlayerStats({ name: 'WizardX' });
      const result = await handle(makeAction(), ps, campaignName, null);

      expect(result.payload.description).toContain('WizardX');
    });

    it('uses custom playerStats name in ability_use description', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const ps = makePlayerStats({ name: 'WizardX' });

      await handle(makeAction(), ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: expect.stringContaining('WizardX casts Suggestion'),
      }));
    });
  });
});
