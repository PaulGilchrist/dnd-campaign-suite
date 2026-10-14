// Suppress fire-and-forget logService.addEntry rejection warnings from source code
process.on('unhandledRejection', () => {});

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

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
}));

vi.mock('../../../ui/utils.js', () => ({
  default: { guid: vi.fn(() => 'death-prompt-123') },
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './reactionSaveHealHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import { sendDeathSavePrompt } from '../../../combat/conditions/savePromptService.js';

const campaignName = 'test-campaign';

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

// Shared event trigger helpers — defined once at module level.
function triggerSaveResult(success, extra = {}) {
  window.dispatchEvent(new CustomEvent('save-result', {
    detail: {
      promptId: 'prompt-123',
      success,
      roll: success ? 15 : 8,
      saveBonus: 7,
      total: success ? 22 : 15,
      ...extra,
    },
  }));
}

function triggerDeathSaveResult(extra = {}) {
  window.dispatchEvent(new CustomEvent('death-save-result', {
    detail: {
      promptId: 'death-prompt-123',
      success: true,
      isNat20: false,
      roll: 15,
      ...extra,
    },
  }));
}

// ── Tests ──────────────────────────────────────────────────────

describe('reactionSaveHealHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clean up any event listeners from previous tests to prevent cross-test pollution
    window.removeEventListener('save-result', () => {});
    window.removeEventListener('death-save-result', () => {});
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
      if (key === 'currentHitPoints') return 0;
      if (key === 'relentlessrageUses') return 0;
      if (key === 'deathSaves') return [false, false, false];
      if (key === 'deathFailures') return [false, false, false];
      return 0;
    });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }],
    });
    savePrompt.createSaveListener.mockReturnValue({ promptId: 'prompt-123' });
  });

  // ── Early exit guards ───────────────────────────────────────

  describe('early exit guards', () => {
    it('returns popup when Rage stance is not active even with ragePoints remaining', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 5;
        if (key === 'activeBuffs') return [];
        if (key === 'currentHitPoints') return 0;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Rage is not active');
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('continues when Rage stance is active even with ragePoints at zero', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 0;
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'currentHitPoints') return 0;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('saving throw');
      expect(savePrompt.createSaveListener).toHaveBeenCalled();
    });

    it('returns popup when no combat is active', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No combat active');
    });

    it('continues when combat context exists but has no creatures', async () => {
      damageUtils.getCombatContext.mockResolvedValue({});
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      // No creatures → playerHp defaults to 0 → handler proceeds to create save prompt
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.targetName).toBe('TestBarbarian');
      expect(result.payload.description).toContain('saving throw');
    });

    it('returns popup when player is not at 0 HP', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'currentHitPoints') return 5;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('not at 0 Hit Points');
    });

    it('returns popup when uses are exhausted', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'relentlessrageUses') return 1;
        return 0;
      });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
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

    it('applies dcScaling to the base DC', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'currentHitPoints') return 0;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      const action = makeAction({ saveType: 'CON', saveDc: 10, dcScaling: 2 });
      await handle(action, makePlayerStats(), campaignName, null);

      // DC = 10 + (0 * 2) = 10 (uses start at 0)
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'CON',
        saveDc: 10,
      });
    });
  });

  // ── Log entry ───────────────────────────────────────────────

  describe('log entry', () => {
    it('adds ability_use log entry with source field', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestBarbarian',
        abilityName: 'Relentless Rage',
        description: 'Relentless Rage triggered — TestBarbarian must make CON save (DC 12)',
        source: 'Relentless Rage',
        promptId: 'prompt-123',
      });
    });

    it('uses custom feature name and saveType in log entry', async () => {
      const action = { name: 'Unbreakable Spirit', automation: { saveType: 'WIS' } };
      await handle(action, makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        abilityName: 'Unbreakable Spirit',
        description: expect.stringContaining('Unbreakable Spirit'),
        source: 'Unbreakable Spirit',
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

    it('includes saveType in popup description when custom', async () => {
      const result = await handle(makeAction({ saveType: 'WIS', saveDc: 13 }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('WIS saving throw');
      expect(result.payload.description).toContain('DC 13');
    });
  });

  // ── Creature name matching ──────────────────────────────────

  describe('creature name matching', () => {
    it('finds creature by exact name match', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }],
      });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.targetName).toBe('TestBarbarian');
    });

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
      expect(result.payload.targetName).toBe('TestBarbarian');
      expect(result.payload.description).toContain('saving throw');
    });

    it('defaults to creature currentHp when creature is not a player type', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'npc', currentHp: 0 }],
      });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.targetName).toBe('TestBarbarian');
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
    it('sets HP to healAmount on successful save', async () => {
      await handle(makeAction({ healExpression: '2 * barbarian_level' }), makePlayerStats(), campaignName, null);
      triggerSaveResult(true);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        10,
        campaignName,
      );
    });

    it('increments uses after successful save', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      triggerSaveResult(true);

      await vi.waitFor(() => {
        const calls = runtimeState.setRuntimeValue.mock.calls;
        const usesCall = calls.find(
          (call) => call[1] === 'relentlessrageUses',
        );
        expect(usesCall).toEqual(['TestBarbarian', 'relentlessrageUses', 1, campaignName]);
      });
    });

    it('logs ability_use with save details and hpGained on success', async () => {
      await handle(makeAction({ healExpression: '2 * barbarian_level' }), makePlayerStats(), campaignName, null);
      triggerSaveResult(true);

      await vi.waitFor(() => {
        const calls = logService.addEntry.mock.calls.filter(
          (call) => call[1]?.type === 'ability_use' && call[1]?.saveSuccess === true,
        );
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0][1].saveRoll).toBe(15);
        expect(calls[0][1].saveBonus).toBe(7);
        expect(calls[0][1].saveTotal).toBe(22);
        expect(calls[0][1].saveDc).toBe(12);
        expect(calls[0][1].hpGained).toBe(10);
        expect(calls[0][1].source).toBe('Relentless Rage');
      });
    });

    it('dispatches combat-summary-updated event', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const dispatched = vi.fn();
      window.addEventListener('combat-summary-updated', dispatched, { once: true });

      triggerSaveResult(true);

      await vi.waitFor(() => expect(dispatched).toHaveBeenCalled());
    });

    it('does NOT dispatch combat-summary-updated on failed save', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const dispatched = vi.fn();
      window.addEventListener('combat-summary-updated', dispatched, { once: true });

      triggerSaveResult(false);

      // Wait a tick to confirm the event was NOT dispatched
      await vi.waitFor(() => {
        expect(dispatched).not.toHaveBeenCalled();
      });
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
    it('does not set HP on failed save', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      triggerSaveResult(false);

      const hpCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'currentHitPoints',
      );
      expect(hpCalls.length).toBe(0);
    });

    it('logs ability_use with save details and saveSuccess=false on failure', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      triggerSaveResult(false);

      await vi.waitFor(() => {
        const calls = logService.addEntry.mock.calls.filter(
          (call) => call[1]?.type === 'ability_use' && call[1]?.saveSuccess === false,
        );
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0][1].saveRoll).toBe(8);
        expect(calls[0][1].saveBonus).toBe(7);
        expect(calls[0][1].saveTotal).toBe(15);
        expect(calls[0][1].saveDc).toBe(12);
        expect(calls[0][1].source).toBe('Relentless Rage');
      });
    });

    it('sends death save prompt when HP is 0 after failed save', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      triggerSaveResult(false);

      await vi.waitFor(() => {
        expect(sendDeathSavePrompt).toHaveBeenCalledWith(campaignName, {
          promptId: 'death-prompt-123',
          targetName: 'TestBarbarian',
        });
      });
    });
  });

  // ── Death save results ──────────────────────────────────────

  describe('death save results', () => {
    function setupDeathSaveFlow() {
      // Returns a function that triggers the initial save failure
      return async () => {
        await handle(makeAction(), makePlayerStats(), campaignName, null);
        triggerSaveResult(false);
        await vi.waitFor(() => {
          expect(sendDeathSavePrompt).toHaveBeenCalled();
        });
      };
    }

    it('natural 20 clears saves/failures and sets HP to 1', async () => {
      const triggerFailure = setupDeathSaveFlow();
      await triggerFailure();

      triggerDeathSaveResult({ isNat20: true, roll: 20, success: true });

      await vi.waitFor(() => {
        const calls = runtimeState.setRuntimeValue.mock.calls;
        const hpCalls = calls.filter((c) => c[1] === 'currentHitPoints');
        expect(hpCalls).toContainEqual(['TestBarbarian', 'currentHitPoints', 1, campaignName]);

        const saveCalls = calls.filter((c) => c[1] === 'deathSaves');
        expect(saveCalls).toContainEqual(['TestBarbarian', 'deathSaves', [false, false, false], campaignName]);

        const failCalls = calls.filter((c) => c[1] === 'deathFailures');
        expect(failCalls).toContainEqual(['TestBarbarian', 'deathFailures', [false, false, false], campaignName]);
      });
    });

    it('success marks first empty save slot', async () => {
      const triggerFailure = setupDeathSaveFlow();
      await triggerFailure();

      triggerDeathSaveResult({ isNat20: false, roll: 15, success: true });

      await vi.waitFor(() => {
        const calls = runtimeState.setRuntimeValue.mock.calls;
        const saveCalls = calls.filter((c) => c[1] === 'deathSaves');
        expect(saveCalls).toContainEqual(['TestBarbarian', 'deathSaves', [true, false, false], campaignName]);
      });
    });

    it('success with existing saves marks next empty slot', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
        if (key === 'currentHitPoints') return 0;
        if (key === 'relentlessrageUses') return 0;
        if (key === 'deathSaves') return [true, true, false];
        if (key === 'deathFailures') return [false, false, false];
        return 0;
      });

      const triggerFailure = setupDeathSaveFlow();
      await triggerFailure();

      triggerDeathSaveResult({ isNat20: false, roll: 12, success: true });

      await vi.waitFor(() => {
        const calls = runtimeState.setRuntimeValue.mock.calls;
        const saveCalls = calls.filter((c) => c[1] === 'deathSaves');
        expect(saveCalls).toContainEqual(['TestBarbarian', 'deathSaves', [true, true, true], campaignName]);
      });
    });

    it('nat1 marks two failure slots', async () => {
      const triggerFailure = setupDeathSaveFlow();
      await triggerFailure();

      triggerDeathSaveResult({ isNat1: true, roll: 1, success: false });

      await vi.waitFor(() => {
        const calls = runtimeState.setRuntimeValue.mock.calls;
        const failCalls = calls.filter((c) => c[1] === 'deathFailures');
        expect(failCalls).toContainEqual(['TestBarbarian', 'deathFailures', [true, true, false], campaignName]);
      });
    });

    it('regular failure marks one slot', async () => {
      const triggerFailure = setupDeathSaveFlow();
      await triggerFailure();

      triggerDeathSaveResult({ isNat1: false, roll: 5, success: false });

      await vi.waitFor(() => {
        const calls = runtimeState.setRuntimeValue.mock.calls;
        const failCalls = calls.filter((c) => c[1] === 'deathFailures');
        expect(failCalls).toContainEqual(['TestBarbarian', 'deathFailures', [true, false, false], campaignName]);
      });
    });

    it('ignores death-save-result with mismatched promptId', async () => {
      const triggerFailure = setupDeathSaveFlow();
      await triggerFailure();

      window.dispatchEvent(new CustomEvent('death-save-result', {
        detail: { promptId: 'wrong-prompt-id', success: true, isNat20: true, roll: 20 },
      }));

      await vi.waitFor(() => {
        const calls = runtimeState.setRuntimeValue.mock.calls;
        const hpCalls = calls.filter((c) => c[1] === 'currentHitPoints' && c[2] === 1);
        expect(hpCalls.length).toBe(0);
      });
    });

    it('logs death_save entry with correct fields on natural 20', async () => {
      const triggerFailure = setupDeathSaveFlow();
      await triggerFailure();

      triggerDeathSaveResult({ isNat20: true, roll: 20, success: true });

      await vi.waitFor(() => {
        const calls = logService.addEntry.mock.calls.filter(
          (call) => call[1]?.type === 'death_save',
        );
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0][1].characterName).toBe('TestBarbarian');
        expect(calls[0][1].roll).toBe(20);
        expect(calls[0][1].isNatural20).toBe(true);
        expect(calls[0][1].success).toBe(true);
      });
    });
  });

  // ── Heal expression evaluation ──────────────────────────────

  describe('heal expression evaluation', () => {
    it('uses numeric expression directly', async () => {
      await handle(makeAction({ healExpression: 10 }), makePlayerStats(), campaignName, null);
      triggerSaveResult(true);

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
      triggerSaveResult(true);

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
      triggerSaveResult(true);

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
      triggerSaveResult(true);

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
      triggerSaveResult(true);

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
      triggerSaveResult(true);

      // No Barbarian in class_levels -> falls to playerStats.level (5) -> 2 * 5 = 10
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        10,
        campaignName,
      );
    });

    it('falls back to player level when barbarianLevel is undefined and no class_levels', async () => {
      const ps = makePlayerStats({
        barbarianLevel: undefined,
        class: undefined,
      });
      await handle(makeAction({ healExpression: '2 * barbarian_level' }), ps, campaignName, null);
      triggerSaveResult(true);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        10,
        campaignName,
      );
    });

    it('uses 1 as ultimate fallback when no level info available', async () => {
      const ps = makePlayerStats({ level: undefined, barbarianLevel: undefined, class: undefined });
      await handle(makeAction({ healExpression: '2 * barbarian_level' }), ps, campaignName, null);
      triggerSaveResult(true);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        2,
        campaignName,
      );
    });

    it('handles undefined healExpression by falling back to barbarianLevel', async () => {
      const ps = makePlayerStats({ barbarianLevel: 7 });
      await handle(makeAction({ healExpression: undefined }), ps, campaignName, null);
      triggerSaveResult(true);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        7,
        campaignName,
      );
    });
  });

  // ── Error handling (.catch on addEntry) ─────────────────────

  describe('error handling', () => {
    it('handles addEntry rejection on success path without throwing', async () => {
      logService.addEntry.mockRejectedValue(new Error('db error'));

      await handle(makeAction({ healExpression: '2 * barbarian_level' }), makePlayerStats(), campaignName, null);
      triggerSaveResult(true);

      await vi.waitFor(() => {
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'TestBarbarian',
          'currentHitPoints',
          10,
          campaignName,
        );
      });
    });

    it('handles addEntry rejection on failure path without throwing', async () => {
      logService.addEntry.mockRejectedValue(new Error('db error'));

      await handle(makeAction(), makePlayerStats(), campaignName, null);
      triggerSaveResult(false);

      await vi.waitFor(() => {
        expect(sendDeathSavePrompt).toHaveBeenCalled();
      });
    });

    it('handles addEntry rejection on death save logging without throwing', async () => {
      logService.addEntry.mockRejectedValue(new Error('db error'));

      const triggerFailure = async () => {
        await handle(makeAction(), makePlayerStats(), campaignName, null);
        triggerSaveResult(false);
        await vi.waitFor(() => {
          expect(sendDeathSavePrompt).toHaveBeenCalled();
        });
      };

      await triggerFailure();

      triggerDeathSaveResult({ isNat20: true, roll: 20, success: true });

      await vi.waitFor(() => {
        const calls = runtimeState.setRuntimeValue.mock.calls;
        const hpCalls = calls.filter((c) => c[1] === 'currentHitPoints');
        expect(hpCalls).toContainEqual(['TestBarbarian', 'currentHitPoints', 1, campaignName]);
      });
    });
  });
});
