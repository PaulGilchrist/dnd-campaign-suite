// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
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

    it('returns popup when target name is missing', async () => {
      resolveTarget.mockResolvedValue({ target: null });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
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
        disadvantage: false,
      });
    });
  });

  describe('ability_use log entry', () => {
    it('logs ability_use with full details when a target is resolved', async () => {
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
  });

  describe('NPC auto-save', () => {
    it('calls rollSaveForCreature and sendSaveResult for NPC targets', async () => {
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
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        promptId: 'test-prompt-id',
        success: false,
      }));
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
    it('returns popup and logs save_result with success=true', async () => {
      setupBaseMocks({ success: true });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('succeeded on WIS save');
      expect(result.payload.description).toContain('Goblin');

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: true,
        rollType: 'save-charm-person',
        saveDc: 15,
        saveType: 'WIS',
      }));

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
    it('returns popup with correct payload and description', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Charm Person');
      expect(result.payload.description).toContain('TestCaster');
      expect(result.payload.description).toContain('Goblin');
      expect(result.payload.description).toContain('harmful');
      expect(result.payload.description).toContain('Charmed');
    });

    it('applies charmed condition with deduplication and preservation of other conditions', async () => {
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

    it('deduplicates charmed when already present', async () => {
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
        undefined,
        'TestCaster',
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
        reason: 'Charm Person spell',
        note: expect.stringContaining('friendly acquaintance'),
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
        rollType: 'save-charm-person',
        saveDc: 15,
        saveType: 'WIS',
      }));
    });
  });

  describe('edge cases', () => {
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
  });
});
