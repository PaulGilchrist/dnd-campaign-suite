import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

import { handle } from './commandHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addTargetResult } from '../../common/damageRollback.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(commandChoice = 'Approach') {
  return {
    name: 'Command',
    automation: { type: 'command', commandChoice, saveType: 'WIS', saveDc: 15 },
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

function setupRejectingAddEntry() {
  addEntry.mockImplementation(() => Promise.reject(new Error('log error')));
}

describe('commandHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('target resolution', () => {
    it('returns popup when no target is selected', async () => {
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
      expect(result.payload.description).toContain('Command has no effect');
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
        abilityName: 'Command',
        description: expect.stringContaining('TestCaster casts Command on Goblin'),
        promptId: 'test-prompt-id',
      });
    });

    it('includes command choice in ability_use description', async () => {
      setupBaseMocks();

      await handle(makeAction('Grovel'), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: expect.stringContaining('command "Grovel"'),
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
      expect(result.payload.name).toBe('Command');
    });

    it('logs save_result with success=true', async () => {
      setupBaseMocks({ success: true, roll: 12, total: 17 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 12,
        total: 17,
        conditions: [],
        appliedDamage: 0,
      });

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        rollType: 'save-command',
        success: true,
      }));
    });
  });

  describe('failed save — Grovel', () => {
    it('applies prone condition to target', async () => {
      getRuntimeValue.mockImplementation((scope, key) => {
        if (key === 'activeConditions') return [];
        return undefined;
      });
      setupBaseMocks({ success: false, roll: 5, total: 10 });

      const result = await handle(makeAction('Grovel'), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', expect.arrayContaining(['prone']), campaignName);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('failed WIS save');
      expect(result.payload.description).toContain('Grovel');
    });

    it('logs condition applied entry for prone', async () => {
      getRuntimeValue.mockImplementation((scope, key) => {
        if (key === 'activeConditions') return [];
        return undefined;
      });
      setupBaseMocks({ success: false });

      await handle(makeAction('Grovel'), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Prone',
        reason: 'Command spell (Grovel)',
      }));
    });
  });

  describe('failed save — Approach', () => {
    it('logs ability_use with approach description', async () => {
      setupBaseMocks({ success: false, roll: 5, total: 10 });

      await handle(makeAction('Approach'), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        abilityName: 'Command: Approach',
        description: expect.stringContaining('should move toward'),
      }));
    });

    it('returns popup with correct description', async () => {
      setupBaseMocks({ success: false });

      const result = await handle(makeAction('Approach'), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('failed WIS save');
      expect(result.payload.description).toContain('Approach');
    });
  });

  describe('failed save — Drop', () => {
    it('logs ability_use with drop description', async () => {
      setupBaseMocks({ success: false });

      await handle(makeAction('Drop'), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        abilityName: 'Command: Drop',
        description: expect.stringContaining('drop held items'),
      }));
    });
  });

  describe('failed save — Flee', () => {
    it('logs ability_use with flee description', async () => {
      setupBaseMocks({ success: false });

      await handle(makeAction('Flee'), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        abilityName: 'Command: Flee',
        description: expect.stringContaining('moving away'),
      }));
    });
  });

  describe('failed save — Halt', () => {
    it('sets commandHalt flag on target', async () => {
      setupBaseMocks({ success: false });

      await handle(makeAction('Halt'), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'commandHalt', true, campaignName);
    });

    it('logs ability_use with halt description', async () => {
      setupBaseMocks({ success: false });

      await handle(makeAction('Halt'), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        abilityName: 'Command: Halt',
        description: expect.stringContaining('shouldn\'t move or take actions'),
      }));
    });
  });

  describe('save_result logging', () => {
    it('logs save_result with failure=true on failed save', async () => {
      setupBaseMocks({ success: false, roll: 3, total: 8 });

      await handle(makeAction('Drop'), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        rollType: 'save-command',
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'WIS',
        success: false,
        description: expect.stringContaining('failed WIS save'),
      }));
    });
  });

  describe('error handling', () => {
    it('catches and logs errors from addEntry rejection on ability_use', async () => {
      setupRejectingAddEntry();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith('[command] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('catches and logs errors from addEntry rejection on save_result', async () => {
      setupRejectingAddEntry();
      getRuntimeValue.mockImplementation((scope, key) => {
        if (key === 'activeConditions') return [];
        return undefined;
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupBaseMocks({ success: false });

      await handle(makeAction('Grovel'), makePlayerStats(), campaignName, null);

      const errorCalls = consoleSpy.mock.calls.filter(call => call[0] === '[command] Error:');
      expect(errorCalls.length).toBeGreaterThan(0);
      consoleSpy.mockRestore();
    });
  });
});
