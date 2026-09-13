// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
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

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  __esModule: true,
  default: {
    set: vi.fn(() => Promise.resolve()),
  },
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './confusionHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addTargetResult } from '../../common/damageRollback.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    spellAbilities: { saveDc: 13 },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Confusion',
    automation: {
      type: 'confusion',
      saveType: 'WIS',
      saveDc: 13,
      ...automation,
    },
  };
}

function makeCombatContext(creatures) {
  return {
    creatures,
    players: [],
    placedItems: [],
  };
}

function failSaveListener() {
  return {
    promptId: 'confusion-prompt',
    promise: Promise.resolve({ success: false, roll: 5, total: 7 }),
  };
}

function successSaveListener() {
  return {
    promptId: 'confusion-prompt',
    promise: Promise.resolve({ success: true, roll: 18, total: 20 }),
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('confusionHandler - save results', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('on successful save', () => {
    it('posts a save_result entry with success=true', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue(successSaveListener());

      await handle(action, ps, campaignName, null);

      const saveResultEntries = addEntry.mock.calls.filter(
        call => call[1].type === 'save_result',
      );
      expect(saveResultEntries.length).toBe(1);
      const entry = saveResultEntries[0][1];
      expect(entry.targetName).toBe('Goblin');
      expect(entry.success).toBe(true);
      expect(entry.saveType).toBe('WIS');
      expect(entry.saveDc).toBe(20);
      expect(entry.rollType).toBe('save-confusion');
    });

    it('posts a save_result entry for each target that saves', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin' },
        { name: 'Orc' },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue(successSaveListener());

      await handle(action, ps, campaignName, null);

      const saveResultEntries = addEntry.mock.calls.filter(
        call => call[1].type === 'save_result',
      );
      expect(saveResultEntries.length).toBe(2);
    });

    it('posts a save_result via addTargetResult with correct params', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue({
        promptId: 'confusion-prompt',
        promise: Promise.resolve({ success: true, roll: 18, total: 20 }),
      });

      await handle(action, ps, campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 18,
        total: 20,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('does not apply any conditions or expirations on save success', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue(successSaveListener());

      await handle(action, ps, campaignName, null);

      expect(addExpiration).not.toHaveBeenCalled();
    });

    it('includes save_result type in total entry count', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue(successSaveListener());

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledTimes(2);
      const abilityEntries = addEntry.mock.calls.filter(call => call[1].type === 'ability_use');
      const saveEntries = addEntry.mock.calls.filter(call => call[1].type === 'save_result');
      expect(abilityEntries.length).toBe(1);
      expect(saveEntries.length).toBe(1);
    });

    it('includes success description in target name', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue(successSaveListener());

      await handle(action, ps, campaignName, null);

      const saveEntry = addEntry.mock.calls.find(c => c[1].type === 'save_result')[1];
      expect(saveEntry.description).toContain('Goblin');
      expect(saveEntry.description).toContain('succeeded on WIS save');
    });

    it('handles saveResult with missing roll/total fields', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'confusion-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(action, ps, campaignName, null);

      // Should not throw - uses ?? 0 fallback
      const saveEntries = addEntry.mock.calls.filter(c => c[1].type === 'save_result');
      expect(saveEntries.length).toBe(1);
    });
  });

  describe('on failed save', () => {
    it('applies charmed and speed_zero conditions to the target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', expect.arrayContaining(['charmed', 'speed_zero']), campaignName,
      );
    });

    it('deduplicates charmed and speed_zero if already present', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue(['charmed', 'speed_zero', 'frightened']);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      const conditionsArg = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions')[2];
      expect(conditionsArg.filter(c => String(c).toLowerCase() === 'charmed').length).toBe(1);
      expect(conditionsArg.filter(c => String(c).toLowerCase() === 'speed_zero').length).toBe(1);
      expect(conditionsArg).toContain('frightened');
    });

    it('preserves other conditions when adding charmed and speed_zero', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue(['frightened', 'blinded']);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      const conditionsArg = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions')[2];
      expect(conditionsArg).toContain('frightened');
      expect(conditionsArg).toContain('blinded');
      expect(conditionsArg).toContain('charmed');
      expect(conditionsArg).toContain('speed_zero');
    });

    it('removes existing charmed and speed_zero before reapplying', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue(['charmed', 'speed_zero']);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      const conditionsArg = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions')[2];
      expect(conditionsArg).toEqual(['charmed', 'speed_zero']);
    });

    it('posts a condition log entry with the correct details', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Confused',
        reason: 'Confusion spell',
        note: expect.stringContaining('Can\'t take Bonus Actions or Reactions'),
        timestamp: expect.any(Number),
      }));
    });

    it('registers expirations for charmed, speed_zero, remove_target_effect, and confusion_turn_start', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName: 'Goblin', effects: expect.arrayContaining([
          expect.objectContaining({ type: 'charmed', condition: 'charmed' }),
          expect.objectContaining({ type: 'speed_zero', condition: 'speed_zero' }),
          expect.objectContaining({ type: 'remove_target_effect', effectKey: 'confusion' }),
          expect.objectContaining({ type: 'confusion_turn_start', name: 'Confusion' }),
        ]), campaignName });
    });

    it('tracks confusion effect in targetEffects with correct properties', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      const effectCalls = setRuntimeValue.mock.calls.filter(
        call => call[1] === 'targetEffects',
      );
      expect(effectCalls.length).toBeGreaterThan(0);
      const effects = effectCalls[effectCalls.length - 1][2];
      const confusionEffect = effects.find(e => e.effect === 'confusion');
      expect(confusionEffect).toBeDefined();
      expect(confusionEffect.target).toBe('Goblin');
      expect(confusionEffect.source).toBe(casterName);
      expect(confusionEffect.conditions).toEqual(['charmed', 'speed_zero']);
      expect(confusionEffect.dc).toBe(10);
      expect(confusionEffect.duration).toBe('concentration');
    });

    it('updates existing confusion effect if one already exists for the target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([
        { target: 'Goblin', effect: 'confusion', source: 'OldCaster', dc: 12 },
      ]);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      const effectCalls = setRuntimeValue.mock.calls.filter(
        call => call[1] === 'targetEffects',
      );
      const effects = effectCalls[effectCalls.length - 1][2];
      expect(effects.length).toBe(1);
      expect(effects[0].source).toBe(casterName);
      expect(effects[0].dc).toBe(10);
    });

    it('posts save_result via addTargetResult with failure params', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'confusion-prompt',
        promise: Promise.resolve({ success: false, roll: 5, total: 7 }),
      });

      await handle(action, ps, campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 5,
        total: 7,
        conditions: ['charmed', 'speed_zero'],
        appliedDamage: 0,
      });
    });

    it('does not call buildSaveDc with advantage/disadvantage confusion (disadvantage via metaCtx)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      // buildSaveDc should be called once at the start, not per-target
      expect(buildSaveDc).toHaveBeenCalledTimes(1);
    });

    it('handles non-array activeConditions gracefully', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue('not-an-array');
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', expect.arrayContaining(['charmed', 'speed_zero']), campaignName,
      );
    });

    it('handles undefined activeConditions gracefully', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue(undefined);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', expect.arrayContaining(['charmed', 'speed_zero']), campaignName,
      );
    });

    it('handles non-array targetEffects gracefully', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue('not-an-array');
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      // Should still set targetEffects as an array
      const effectCalls = setRuntimeValue.mock.calls.filter(
        call => call[1] === 'targetEffects',
      );
      expect(effectCalls.length).toBeGreaterThan(0);
    });
  });
});
