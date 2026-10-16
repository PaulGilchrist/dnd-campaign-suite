// @maintained-by-ai
// FT-094: Telekinetic Shove (2024 Telekinesis feat) — once-per-turn latch
// (_Telekinetic_Shove_usedRound refusal), DC ability derived from featAbilityChoices,
// telekinetic_movement te mirror on push, real attackerName on the save prompt.
// NOTE: this is the only suite exercising the real resolveFeatChosenAbility
// (shared/abilityLookup.js) — all other suites mock it away. Keep the
// featAbilityChoices derivation tests here unless abilityLookup gains its own.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue({ round: 1, creatures: [] }),
}));

vi.mock('../../../combat/conditions/targetEffectDefinitions.js', () => ({
  getEffectDefinition: vi.fn(() => ({ effect: 'telekinetic_movement' })),
  registerTargetEffect: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './telekineticShoveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as teDefs from '../../../combat/conditions/targetEffectDefinitions.js';

const LATCH_KEY = '_Telekinetic_Shove_usedRound';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestMonk',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Wisdom', bonus: 2 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Telekinetic Shove',
    automation: {
      type: 'telekinetic_shove',
      saveType: 'STR',
      pushDistance: 5,
      saveAbility: 'INT',
      ...automation,
    },
  };
}

function mockCreateSaveListener(promptId, saveResult) {
  savePrompt.createSaveListener.mockReturnValue({
    promptId,
    promise: Promise.resolve(saveResult || { success: false, promptId }),
  });
}

function refusalCalls() {
  return logService.addEntry.mock.calls
    .map(c => c[1])
    .filter(e => e && e.automationType === 'telekinetic_shove_refused');
}

// ── Tests ──────────────────────────────────────────────────────

describe('telekineticShoveHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    damageUtils.getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
    teDefs.getEffectDefinition.mockReturnValue({ effect: 'telekinetic_movement' });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    savePrompt.buildSaveDc.mockReturnValue(13);
  });

  describe('popup contract (own description composition, full-string pins)', () => {
    it('failed save: automation_info popup envelope with full push description', async () => {
      mockCreateSaveListener('fail-popup', { success: false, promptId: 'fail-popup' });

      const action = makeAction();
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: expect.objectContaining({
          type: 'automation_info',
          name: 'Telekinetic Shove',
          targetName: 'Goblin',
          automation: action.automation,
        }),
      });
      expect(result.payload.description).toBe(
        'Goblin failed the STR saving throw (DC 13). Pushed 5 feet toward or away from you.');
    });

    it('success save: automation_info popup with full no-effect description', async () => {
      savePrompt.buildSaveDc.mockReturnValue(17);
      mockCreateSaveListener('ok-popup', { success: true, promptId: 'ok-popup' });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.targetName).toBe('Goblin');
      expect(result.payload.description).toBe(
        'Goblin succeeded on the STR saving throw (DC 17). No effect.');
    });
  });

  describe('save prompt wiring', () => {
    it('resolves target and creates save listener with real attackerName', async () => {
      mockCreateSaveListener('test-prompt-1', { success: false, promptId: 'test-prompt-1' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        attackerName: 'TestMonk',
        saveType: 'STR',
        saveDc: 13,
      });
    });

    it('falls back to player name when no target resolved', async () => {
      targetResolver.resolveTarget.mockResolvedValue(null);
      mockCreateSaveListener('test-prompt-2', { success: false, promptId: 'test-prompt-2' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName,
        expect.objectContaining({ targetName: 'TestMonk', saveType: 'STR', saveDc: 13 }));
    });

    it('uses custom pushDistance and saveType from automation', async () => {
      mockCreateSaveListener('test-prompt-3', { success: false, promptId: 'test-prompt-3' });

      const result = await handle(makeAction({ pushDistance: 10, saveType: 'CON' }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        'Goblin failed the CON saving throw (DC 13). Pushed 10 feet toward or away from you.');
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName,
        expect.objectContaining({ targetName: 'Goblin', saveType: 'CON', saveDc: 13 }));
    });

    it('defaults pushDistance and saveType when falsy', async () => {
      mockCreateSaveListener('test-prompt-4', { success: false, promptId: 'test-prompt-4' });

      const result = await handle(makeAction({ pushDistance: null, saveType: undefined }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('5 feet');
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName,
        expect.objectContaining({ targetName: 'Goblin', saveType: 'STR' }));
    });
  });

  describe('logging', () => {
    it('adds ability_use log entry with promptId and push distance', async () => {
      mockCreateSaveListener('test-prompt-6', { success: false, promptId: 'test-prompt-6' });

      await handle(makeAction({ pushDistance: 10 }), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestMonk',
          abilityName: 'Telekinetic Shove',
          promptId: 'test-prompt-6',
          description: expect.stringContaining('10 feet'),
        }),
      );
    });

    it('logs save_result on failed save', async () => {
      mockCreateSaveListener('save-fail', { success: false, promptId: 'save-fail' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Goblin',
          success: false,
          saveType: 'STR',
        }),
      );
    });

    it('logs save_result on successful save', async () => {
      mockCreateSaveListener('save-success', { success: true, promptId: 'save-success' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Goblin',
          success: true,
        }),
      );
    });
  });

  describe('once-per-turn latch (FT-094 clause 1)', () => {
    it('stamps _Telekinetic_Shove_usedRound on the player at trigger', async () => {
      mockCreateSaveListener('latch-1', { success: false, promptId: 'latch-1' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestMonk', LATCH_KEY, { round: 1, activeCreature: 'TestMonk' }, campaignName);
    });

    it('refuses a same-round re-click with telekinetic_shove_refused log and no save prompt', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) =>
        key === LATCH_KEY ? { round: 1, activeCreature: 'TestMonk' } : null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(refusalCalls()).toHaveLength(1);
      expect(refusalCalls()[0]).toEqual({
        type: 'automation',
        characterName: 'TestMonk',
        automationType: 'telekinetic_shove_refused',
        name: 'Telekinetic Shove',
        description: 'Telekinetic Shove refused — You have already used your telekinetic shove this turn.',
        timestamp: expect.any(Number),
      });
      expect(result.payload.description).toBe(
        'Telekinetic Shove: You have already used your telekinetic shove this turn.');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('re-arms on a later round (latch.round < current round)', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ round: 2, creatures: [] });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) =>
        key === LATCH_KEY ? { round: 1, activeCreature: 'TestMonk' } : null);
      mockCreateSaveListener('latch-2', { success: false, promptId: 'latch-2' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalled();
      expect(refusalCalls()).toHaveLength(0);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestMonk', LATCH_KEY, { round: 2, activeCreature: 'TestMonk' }, campaignName);
    });
  });

  describe('DC ability derivation (FT-094 clause 2)', () => {
    it('derives saveAbility from featAbilityChoices ASI, not hardcoded data INT', async () => {
      mockCreateSaveListener('dc-1', { success: false, promptId: 'dc-1' });
      const ps = makePlayerStats({ featAbilityChoices: { 'Telekinesis-3': { assignment: 'Wisdom' } } });

      await handle(makeAction({ saveAbility: 'INT' }), ps, campaignName, null);

      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(
        expect.objectContaining({ saveAbility: 'Wisdom' }), ps);
    });

    it('accepts string-valued featAbilityChoices entry', async () => {
      mockCreateSaveListener('dc-2', { success: false, promptId: 'dc-2' });
      const ps = makePlayerStats({ featAbilityChoices: { 'Telekinesis-0': 'Charisma' } });

      await handle(makeAction({ saveAbility: 'INT' }), ps, campaignName, null);

      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(
        expect.objectContaining({ saveAbility: 'Charisma' }), ps);
    });

    it('falls back to feats.json saveAbility when no ASI choice exists', async () => {
      mockCreateSaveListener('dc-3', { success: false, promptId: 'dc-3' });

      await handle(makeAction({ saveAbility: 'INT' }), makePlayerStats(), campaignName, null);

      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(
        expect.objectContaining({ saveAbility: 'INT' }), expect.anything());
    });

    it('ignores featAbilityChoices entries from other feats', async () => {
      mockCreateSaveListener('dc-4', { success: false, promptId: 'dc-4' });
      const ps = makePlayerStats({ featAbilityChoices: { 'Skill Expert-1': { assignment: 'Dexterity' } } });

      await handle(makeAction({ saveAbility: 'INT' }), ps, campaignName, null);

      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(
        expect.objectContaining({ saveAbility: 'INT' }), ps);
    });
  });

  describe('push targetEffect mirror (FT-094 clause 3)', () => {
    it('writes telekinetic_movement te on failed save (shove lands)', async () => {
      mockCreateSaveListener('te-1', { success: false, promptId: 'te-1' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(teDefs.registerTargetEffect).toHaveBeenCalledWith(
        campaignName, 'Goblin', 'telekinetic_movement', 'Telekinetic Shove',
        { value: 5, movedDistanceFt: 5, duration: 'instant' });
    });

    it('writes custom push distance to the te', async () => {
      mockCreateSaveListener('te-2', { success: false, promptId: 'te-2' });

      await handle(makeAction({ pushDistance: 15 }), makePlayerStats(), campaignName, null);

      expect(teDefs.registerTargetEffect).toHaveBeenCalledWith(
        campaignName, 'Goblin', 'telekinetic_movement', 'Telekinetic Shove',
        expect.objectContaining({ value: 15, movedDistanceFt: 15 }));
    });

    it('does not write a targetEffect on successful save', async () => {
      mockCreateSaveListener('te-3', { success: true, promptId: 'te-3' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(teDefs.registerTargetEffect).not.toHaveBeenCalled();
    });

    it('still registers the te when the registry lacks the definition (logs error)', async () => {
      mockCreateSaveListener('te-4', { success: false, promptId: 'te-4' });
      teDefs.getEffectDefinition.mockReturnValue(null);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(errorSpy).toHaveBeenCalledWith(
        '[telekineticShove] Missing telekinetic_movement entry in targetEffectDefinitions registry');
      expect(teDefs.registerTargetEffect).toHaveBeenCalled();
      expect(result.type).toBe('popup');
      errorSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('does not reject when both addEntry logs reject', async () => {
      // addEntry fires twice per shove (ability_use, then save_result) —
      // consume exactly those two with Once so the reject never leaks forward.
      mockCreateSaveListener('err-prompt', { success: false, promptId: 'err-prompt' });
      logService.addEntry.mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce(new Error('network'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledTimes(2);
      expect(result.type).toBe('popup');
    });

    it('proceeds with round 1 when combat context fetch yields null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);
      mockCreateSaveListener('nocombat', { success: false, promptId: 'nocombat' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestMonk', LATCH_KEY, { round: 1, activeCreature: 'TestMonk' }, campaignName);
    });
  });
});
