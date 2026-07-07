// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  createSaveListener: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './reactionSaveHealHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestBarbarian',
    level: 5,
    barbarianLevel: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Relentless Rage',
    automation: {
      saveType: 'CON',
      saveDc: 12,
      healExpression: 'barbarian_level + 4',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('reactionSaveHealHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'ragePoints') return 1;
      if (key === 'currentHitPoints') return 0;
      if (key === 'relentlessrageUses') return 0;
      return 0;
    });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }],
    });
    savePrompt.createSaveListener.mockReturnValue({ promptId: 'prompt-123' });
  });

  // ── Early exit guards ───────────────────────────────────────

  describe('early exit guards', () => {
    it('returns popup when rage is zero, null, undefined, or negative', async () => {
      for (const badRage of [0, null, undefined, -1]) {
        runtimeState.getRuntimeValue.mockReturnValue(badRage);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No Rage remaining');
      }
    });

    it('returns popup when no combat is active', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('No combat active');
    });

    it('returns popup when player is not at 0 HP', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 5;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('not at 0 Hit Points');
    });

    it('returns popup when uses are exhausted', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 1;
        return 0;
      });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('no uses remaining');
    });
  });

  // ── Save prompt creation ────────────────────────────────────

  describe('save prompt creation', () => {
    it('creates save listener with provided saveType and saveDc', async () => {
      const action = makeAction({ saveType: 'WIS', saveDc: 15 });
      await handle(action, makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'WIS',
        saveDc: 15,
      });
    });

    it('defaults saveType to CON and saveDc to 10 when not provided', async () => {
      const action = { name: 'Relentless Rage', automation: {} };
      await handle(action, makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'CON',
        saveDc: 10,
      });
    });
  });

  // ── Log entry ───────────────────────────────────────────────

  describe('log entry', () => {
    it('adds ability_use log entry with correct details', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestBarbarian',
        abilityName: 'Relentless Rage',
        description: 'Relentless Rage triggered — TestBarbarian must make CON save (DC 12)',
        promptId: 'prompt-123',
      });
    });

    it('uses custom feature name and saveType in log entry', async () => {
      const action = { name: 'Unbreakable Spirit', automation: { saveType: 'WIS' } };
      await handle(action, makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        abilityName: 'Unbreakable Spirit',
        description: expect.stringContaining('Unbreakable Spirit'),
      }));
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: expect.stringContaining('WIS save'),
      }));
    });
  });

  // ── Popup return ────────────────────────────────────────────

  describe('popup return', () => {
    it('returns automation_info popup with target name and automation', async () => {
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Relentless Rage');
      expect(result.payload.targetName).toBe('TestBarbarian');
      expect(result.payload.automation).toStrictEqual(makeAction().automation);
    });

    it('includes save type and DC in popup description', async () => {
      const result = await handle(makeAction({ saveDc: 15 }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('CON saving throw');
      expect(result.payload.description).toContain('DC 15');
    });
  });

  // ── Creature name matching ──────────────────────────────────

  describe('creature name matching', () => {
    it('finds creature by name prefix match (name + space)', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian (Player)', type: 'player', currentHp: 0 }],
      });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.targetName).toBe('TestBarbarian');
    });

    it('defaults to 0 HP when creature not found in combat', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'OtherCreature', type: 'npc', currentHp: 5 }],
      });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('saving throw');
    });
  });

  // ── Uses key derivation ─────────────────────────────────────

  describe('uses key derivation', () => {
    it('builds uses key from feature name lowercase without spaces', async () => {
      const action = { name: 'Special Rage', automation: { saveType: 'CON' } };
      await handle(action, makePlayerStats(), campaignName, null);

      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'specialrageUses',
      );
    });
  });

  // ── Save result - success path ──────────────────────────────

  describe('save result - success', () => {
    function triggerSuccess() {
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));
    }

    it('sets HP to healAmount on successful save', async () => {
      await handle(makeAction({ healExpression: '2 * barbarian_level' }), makePlayerStats(), campaignName, null);
      triggerSuccess();

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        10,
        campaignName,
      );
    });

    it('increments uses after successful save', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      triggerSuccess();

      await vi.waitFor(() => {
        const calls = runtimeState.setRuntimeValue.mock.calls;
        const usesCall = calls.find(
          (call) => call[1] === 'relentlessrageUses',
        );
        expect(usesCall).toEqual(['TestBarbarian', 'relentlessrageUses', 1, campaignName]);
      });
    });

    it('logs save_result with success=true', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      triggerSuccess();

      await vi.waitFor(() => {
        const calls = logService.addEntry.mock.calls.filter(
          (call) => call[1]?.type === 'save_result',
        );
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0][1].success).toBe(true);
        expect(calls[0][1].saveType).toBe('CON');
        expect(calls[0][1].saveDc).toBe(12);
      });
    });

    it('dispatches combat-summary-updated event', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const dispatched = vi.fn();
      window.addEventListener('combat-summary-updated', dispatched, { once: true });

      triggerSuccess();

      await vi.waitFor(() => expect(dispatched).toHaveBeenCalled());
    });

    it('ignores save-result with mismatched promptId', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'wrong-prompt-id', success: true },
      }));

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        expect.any(Number),
        campaignName,
      );
    });
  });

  // ── Save result - failure path ──────────────────────────────

  describe('save result - failure', () => {
    function triggerFailure() {
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: false },
      }));
    }

    it('does not set HP on failed save', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      triggerFailure();

      const hpCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'currentHitPoints',
      );
      expect(hpCalls.length).toBe(0);
    });

    it('logs save_result with success=false', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      triggerFailure();

      const calls = logService.addEntry.mock.calls.filter(
        (call) => call[1]?.type === 'save_result',
      );
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][1].success).toBe(false);
    });
  });

  // ── Heal expression evaluation ──────────────────────────────

  describe('heal expression evaluation', () => {
    function triggerSuccess() {
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));
    }

    it('uses numeric expression directly', async () => {
      await handle(makeAction({ healExpression: 10 }), makePlayerStats(), campaignName, null);
      triggerSuccess();

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        10,
        campaignName,
      );
    });

    it('evaluates "2 * barbarian_level" using direct field', async () => {
      const ps = makePlayerStats({ barbarianLevel: 5 });
      await handle(makeAction({ healExpression: '2 * barbarian_level' }), ps, campaignName, null);
      triggerSuccess();

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        10,
        campaignName,
      );
    });

    it('evaluates "2 * barbarian_level" from class_levels', async () => {
      const ps = makePlayerStats({
        barbarianLevel: undefined,
        class: { class_levels: [{ name: 'Barbarian', level: 8 }] },
      });
      await handle(makeAction({ healExpression: '2 * barbarian_level' }), ps, campaignName, null);
      triggerSuccess();

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        16,
        campaignName,
      );
    });

    it('evaluates "2 * level"', async () => {
      const ps = makePlayerStats({ level: 7 });
      await handle(makeAction({ healExpression: '2 * level' }), ps, campaignName, null);
      triggerSuccess();

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        14,
        campaignName,
      );
    });

    it('falls back to player level for unrecognizable expressions', async () => {
      const ps = makePlayerStats({ level: 3 });
      await handle(makeAction({ healExpression: '1d8+CON' }), ps, campaignName, null);
      triggerSuccess();

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        3,
        campaignName,
      );
    });

    it('falls back to barbarian not found in class_levels', async () => {
      const ps = makePlayerStats({
        barbarianLevel: undefined,
        class: { class_levels: [{ name: 'Fighter', level: 10 }] },
      });
      await handle(makeAction({ healExpression: '2 * barbarian_level' }), ps, campaignName, null);
      triggerSuccess();

      // No Barbarian in class_levels -> falls to playerStats.level (5) -> 2 * 5 = 10
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        10,
        campaignName,
      );
    });
  });
});
