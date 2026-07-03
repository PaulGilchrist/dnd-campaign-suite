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

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  rollSaveForCreature: vi.fn(),
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
}));

import { handle } from './charmPersonHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';

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
    name: 'Charm Person',
    automation: { type: 'charm_person', saveType: 'WIS', saveDc: 15, ...automation },
  };
}

function setupBaseMocks(saveResult = { success: true }, isNpc = false) {
  resolveTarget.mockResolvedValue({
    target: { name: 'Goblin', type: isNpc ? 'npc' : 'player' },
    cs: {
      creatures: [
        { name: 'Goblin', type: isNpc ? 'npc' : 'player', saveBonuses: { WIS: 2 } },
      ],
    },
  });
  buildSaveDc.mockReturnValue(15);
  createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve(saveResult),
  });
}

describe('charmPersonHandler.handle', () => {
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
    });

    it('returns popup when resolveTarget returns { target: null }', async () => {
      resolveTarget.mockResolvedValue({ target: null });

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
        advantage: false,
      });
    });

    it('passes advantage from automation config to createSaveListener', async () => {
      setupBaseMocks();

      await handle(makeAction({ advantage: true }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 15,
        dcSuccess: 'none',
        advantage: true,
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
        abilityName: 'Charm Person',
        description: expect.stringContaining('TestCaster casts Charm Person on Goblin'),
        promptId: 'test-prompt-id',
      });
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

  describe('NPC auto-save', () => {
    it('calls rollSaveForCreature for NPC targets', async () => {
      setupBaseMocks({ success: false }, true);
      rollSaveForCreature.mockReturnValue({ roll: 8, total: 10, bonus: 2, success: false, rawRolls: [8, 12] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(rollSaveForCreature).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Goblin' }),
        'WIS',
        15,
        false,
        false,
      );
    });

    it('calls sendSaveResult for NPC targets', async () => {
      setupBaseMocks({ success: false }, true);
      rollSaveForCreature.mockReturnValue({ roll: 8, total: 10, bonus: 2, success: false, rawRolls: [8, 12] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        promptId: 'test-prompt-id',
        success: false,
      }));
    });

    it('dispatches save-result CustomEvent for NPC targets', async () => {
      setupBaseMocks({ success: false }, true);
      rollSaveForCreature.mockReturnValue({ roll: 8, total: 10, bonus: 2, success: false, rawRolls: [8, 12] });

      const eventHandler = vi.fn();
      window.addEventListener('save-result', eventHandler);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(eventHandler).toHaveBeenCalled();
      const event = eventHandler.mock.calls[0][0];
      expect(event.detail.promptId).toBe('test-prompt-id');
      expect(event.detail.success).toBe(false);
      expect(event.detail.targetName).toBe('Goblin');
      expect(event.detail.saveType).toBe('WIS');

      window.removeEventListener('save-result', eventHandler);
    });

    it('uses fallback roll when creature not found in combat summary', async () => {
      resolveTarget.mockResolvedValue({
        target: { name: 'Goblin', type: 'npc' },
        cs: { creatures: [] },
      });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendSaveResult).toHaveBeenCalled();
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
        rollType: 'save-charm-person',
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

    it('registers expiration with 1 hour duration', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        expect.arrayContaining([{ type: 'charmed', condition: 'charmed' }]),
        campaignName,
        1,
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
        reason: 'Charm Person spell',
        note: expect.stringContaining('friendly acquaintance'),
        timestamp: expect.any(Number),
      }));
    });

    it('posts condition log mentioning caster in note', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const logCall = postLogEntry.mock.calls[0][1];
      expect(logCall.note).toContain('TestCaster');
      expect(logCall.note).toContain('harmful');
    });

    it('logs save_result with success=false', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: false,
        rollType: 'save-charm-person',
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

      expect(result.payload.description).toContain('harmful');
      expect(result.payload.description).toContain('Charmed');
    });

    it('returns popup with correct payload type on failure', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Charm Person');
    });

    it('calls addEntry before setting runtime values (order matters)', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

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
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'player' } });
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle({ name: 'Charm Person', automation: {} }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenCalledWith({}, makePlayerStats());
    });

    it('handles missing automation property by defaulting to empty object', async () => {
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'player' } });
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle({ name: 'Charm Person' }, makePlayerStats(), campaignName, null);

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

    it('uses action.name in popup payload', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle({ name: 'My Charm Person', automation: { type: 'charm_person' } }, makePlayerStats(), campaignName, null);

      expect(result.payload.name).toBe('My Charm Person');
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
        description: expect.stringContaining('WizardX casts Charm Person'),
      }));
    });

    it('does not call rollSaveForCreature for player targets', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(rollSaveForCreature).not.toHaveBeenCalled();
    });

    it('does not call sendSaveResult for player targets', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendSaveResult).not.toHaveBeenCalled();
    });
  });
});
