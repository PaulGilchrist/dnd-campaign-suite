// @maintained-by-ai
/**
 * faerieFire TRIO lane #1908 — save-handling OUTCOMES (faerieFireHandler.js).
 * Canonical TRIO SEAM MAP lives in faerieFireHandler.handle.test.js header (#1907).
 *  - #1908 THIS FILE — outlineTarget internals L28-111 (campaign targetEffects SHAPE
 *        incl. re-cast replace-in-place, activeBuffs shape + replace-not-duplicate,
 *        addExpiration enqueue, Invisible-condition removal + removed-log envelope,
 *        addTargetResult payloads, applied-condition and save_result log envelopes with
 *        full own-composition strings), recordFaerieFireSaveSuccess internals L121-140
 *        (payload + success save_result envelope + no-write/no-condition-log guards),
 *        registerSpellConcentration content (areaSpellUtils.js L25-31 via its
 *        combatData/concentrationService/storage mocks + window event dispatch), and the
 *        per-target ability_use log envelopes L188-193/L207-213 (content pins only —
 *        prompt OPTIONS and immunity-gate COUNTS belong to #1907, never re-absorbed).
 *  - #1907 faerieFireHandler.handle.test.js — handle orchestration (selection, prompt
 *        options, gate counts, mixed-dispatch smoke). Closes there: 'should return early
 *        when all creatures are the caster' — no duplicate here (verified 2026-10-16).
 *  - #1909 faerieFireHandler.summary.test.js — owns faerieFireSummary L142-148 template
 *        (smoke only here: the immunity/advantage wording below is pinned on the
 *        outlineTarget LOG note, not the popup summary) plus runtime-store fallbacks,
 *        addEntry .catch() exercises, and the concentration-DC proficiency fallback.
 *
 * Trimmed 2026-10-16 (23→18): summary-notes pin → #1909; duplicate concentration-DC
 * saveDc-value pin dropped (same branch as the 16-pin); applied-condition log pair,
 * ability_use pair, and success no-condition-log merged into their envelope owners;
 * dead addEventListenerSpy removed; own-lane pins tightened to exact objects.
 *
 * Caller liveness (verified at source 2026-10-16): automation/index.js L274/L586
 * `faerie_fire: handleFaerieFire` (dynamic dispatch map); automationRouter.js L255;
 * meta from rules/features/faerieFireService.js; te consumers conditionEffects.js L510,
 * clearExpirationEffects.js L163/L435 ('remove_faerie_fire'), concentrationService.js L334.
 *
 * Captured-listener pattern: makeSaveListener returns a pre-resolved promise — handle
 * awaits its own chain, so no setTimeout / vi.waitFor graces anywhere in this file.
 * Turn-based: 'concentration' / 'Concentration, up to 1 minute' are latch strings
 * cleared at concentration/initiative/rest seams via addExpiration — never a wall-clock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './faerieFireHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as combatData from '../../../encounters/combatData.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as damageRollback from '../../common/damageRollback.js';
import storage from '../../../ui/storage.js';

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

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Faerie Fire',
    automation: { type: 'faerie_fire', saveType: 'DEX', saveDc: 15, ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster' },
    { name: 'Orc', type: 'monster' },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

function mockGetRuntimeValue(dispatch) {
  runtimeState.getRuntimeValue.mockImplementation((playerName, key, _cName) => dispatch(playerName, key, _cName));
}

function mockEmptyStores() {
  mockGetRuntimeValue((playerName, key) => {
    if (key === 'targetEffects') return [];
    if (key === 'activeBuffs') return [];
    if (key === 'activeConditions') return [];
    return null;
  });
}

function makeSaveListener(promiseResult, promptId) {
  return { promptId: promptId || 'faerie-prompt', promise: Promise.resolve(promiseResult) };
}

function setupFailedSaveMock() {
  damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
  savePrompt.buildSaveDc.mockReturnValue(15);
  mockEmptyStores();
  savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));
}

function setupSuccessfulSaveMock() {
  damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
  savePrompt.buildSaveDc.mockReturnValue(20);
  savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));
}

describe('faerieFireHandler.save-handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('failed save — outlineTarget writes', () => {
    it('should write exact faerie_fire targetEffect on failed save', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [{ target: 'Goblin', effect: 'faerie_fire', source: 'TestCaster', duration: 'concentration' }],
        campaignName,
      );
    });

    it('should write exact activeBuffs entry with invisible immunity on failed save', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeBuffs',
        [{
          name: 'Faerie Fire',
          effect: 'faerie_fire',
          duration: 'Concentration, up to 1 minute',
          source: 'TestCaster',
          conditionImmunity: ['invisible'],
        }],
        campaignName,
      );
    });

    it('should register remove_faerie_fire expiration on failed save', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestCaster',
        targetName: 'Goblin',
        effects: [{ type: 'remove_faerie_fire' }],
        campaignName,
      });
    });

    it('should replace existing faerie_fire targetEffect in place when re-casting on same target', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      const existingEffect = {
        target: 'Goblin',
        effect: 'faerie_fire',
        source: 'OldCaster',
        duration: 'concentration',
      };
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'targetEffects') return [existingEffect];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return [];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      await handle(makeAction(), makePlayerStats({ name: 'OldCaster' }), campaignName, null);

      const targetEffectsCall = runtimeState.setRuntimeValue.mock.calls.find(
        call => call[0] === 'campaign' && call[1] === 'targetEffects'
      );
      // Replace-in-place: single entry, source retargeted to the new caster.
      expect(targetEffectsCall).toBeDefined();
      expect(targetEffectsCall[2]).toEqual([
        { target: 'Goblin', effect: 'faerie_fire', source: 'OldCaster', duration: 'concentration' },
      ]);
    });

    it('should replace existing faerie_fire buff in activeBuffs instead of duplicating', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      const staleBuff = {
        name: 'Faerie Fire',
        effect: 'faerie_fire',
        duration: 'Concentration, up to 1 minute',
        source: 'AncientFaerie',
        conditionImmunity: ['invisible'],
      };
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [staleBuff];
        if (key === 'activeConditions') return [];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const buffsCall = runtimeState.setRuntimeValue.mock.calls.find(
        call => call[0] === 'Goblin' && call[1] === 'activeBuffs'
      );
      expect(buffsCall).toBeDefined();
      // Length 1 AND source switched to the current caster — proves replace, not keep.
      expect(buffsCall[2]).toEqual([{
        name: 'Faerie Fire',
        effect: 'faerie_fire',
        duration: 'Concentration, up to 1 minute',
        source: 'TestCaster',
        conditionImmunity: ['invisible'],
      }]);
    });

    it('should remove invisible condition and log the removal envelope', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return ['invisible'];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        [],
        campaignName,
      );

      const { addEntry } = await import('../../../ui/logService.js');
      const removedEntry = addEntry.mock.calls.find(
        ([, entry]) => entry.type === 'condition' && entry.action === 'removed'
      );
      expect(removedEntry).toBeDefined();
      expect(removedEntry[1]).toEqual(expect.objectContaining({
        characterName: 'Goblin',
        condition: 'Invisible',
        reason: 'Faerie Fire spell — affected creatures can\'t benefit from invisibility',
      }));
    });

    it('should not touch activeConditions when invisible is absent', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.any(Array),
        campaignName,
      );
    });
  });

  describe('failed save — log and rollback envelopes', () => {
    it('should log condition applied entry with full outline note', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const { addEntry } = await import('../../../ui/logService.js');
      const appliedEntry = addEntry.mock.calls.find(
        ([, entry]) => entry.type === 'condition' && entry.action === 'applied'
      );
      expect(appliedEntry).toBeDefined();
      expect(appliedEntry[1]).toEqual(expect.objectContaining({
        characterName: 'Goblin',
        condition: 'Faerie Fire',
        reason: 'Faerie Fire spell',
        note: 'Goblin is outlined by Faerie Fire: sheds Dim Light in 10-foot radius, is immune to the Invisible condition, and attack rolls against it have Advantage.',
      }));
    });

    it('should log save_result failure envelope with full description', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const { addEntry } = await import('../../../ui/logService.js');
      const saveResultEntry = addEntry.mock.calls.find(
        ([, entry]) => entry.type === 'save_result' && entry.success === false
      );
      expect(saveResultEntry).toBeDefined();
      expect(saveResultEntry[1]).toEqual({
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-faerie-fire',
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'DEX',
        success: false,
        description: 'Goblin failed DEX save against Faerie Fire. Outlined in light.',
      });
    });

    it('should log ability_use prompt entry with action.name, DC, and promptId', async () => {
      setupFailedSaveMock();

      const customAction = { name: 'My Faerie Fire', automation: { type: 'faerie_fire', saveType: 'DEX', saveDc: 15 } };
      await handle(customAction, makePlayerStats(), campaignName, null);

      const { addEntry } = await import('../../../ui/logService.js');
      const abilityEntry = addEntry.mock.calls.find(
        ([, entry]) => entry.type === 'ability_use' && entry.promptId
      );
      expect(abilityEntry).toBeDefined();
      // abilityName follows action.name (custom here); description is handle's own template.
      expect(abilityEntry[1]).toEqual({
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'My Faerie Fire',
        description: 'TestCaster casts Faerie Fire! Goblin must make a DEX save (DC 15) or be outlined in light.',
        promptId: 'faerie-prompt',
      });
    });

    it('should log ability_use entry for immune creature without a promptId', async () => {
      const combatWithImmune = {
        ...baseCombatContext,
        creatures: [
          { name: 'IronGolem', type: 'monster', weaknessesAndResistivities: { immunities: ['DEX'] } },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
      };
      damageUtils.getCombatContext.mockResolvedValue(combatWithImmune);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const { addEntry } = await import('../../../ui/logService.js');
      const immuneEntry = addEntry.mock.calls.find(
        ([, entry]) => entry.type === 'ability_use' && entry.description?.includes('immune')
      );
      expect(immuneEntry).toBeDefined();
      expect(immuneEntry[1]).toEqual({
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Faerie Fire',
        description: 'IronGolem is immune to Faerie Fire (DEX immunity).',
      });
    });

    it('should call addTargetResult with failure details', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 0,
        total: 0,
        conditions: ['faerie_fire'],
        appliedDamage: 0,
      });
    });
  });

  describe('successful save — recordFaerieFireSaveSuccess', () => {
    it('should write no state and log no condition when save succeeds', async () => {
      setupSuccessfulSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(expirations.addExpiration).not.toHaveBeenCalled();

      const { addEntry } = await import('../../../ui/logService.js');
      const faerieConditionEntry = addEntry.mock.calls.find(
        ([, entry]) => entry.type === 'condition' && entry.action === 'applied' && entry.condition === 'Faerie Fire'
      );
      expect(faerieConditionEntry).toBeUndefined();
    });

    it('should call addTargetResult with success details', async () => {
      setupSuccessfulSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 0,
        total: 0,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('should log save_result success envelope with full description', async () => {
      setupSuccessfulSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const { addEntry } = await import('../../../ui/logService.js');
      const saveResultEntry = addEntry.mock.calls.find(
        ([, entry]) => entry.type === 'save_result' && entry.success === true
      );
      expect(saveResultEntry).toBeDefined();
      expect(saveResultEntry[1]).toEqual({
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-faerie-fire',
        targetName: 'Goblin',
        saveDc: 20,
        saveType: 'DEX',
        success: true,
        description: 'Goblin succeeded on DEX save against Faerie Fire.',
      });
    });
  });

  describe('concentration', () => {
    it('should register concentration from spellAbilities.saveDc and persist summary', async () => {
      const summary = { creatures: [{ name: 'TestCaster' }, { name: 'Goblin' }] };
      combatData.getCombatSummary.mockReturnValue(summary);
      setupSuccessfulSaveMock();

      const playerStats = makePlayerStats({ spellAbilities: { saveDc: 16 } });
      await handle(makeAction(), playerStats, campaignName, null);

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        summary,
        'TestCaster',
        'Faerie Fire',
        16,
      );
      expect(storage.set).toHaveBeenCalledWith('combatSummary', summary, campaignName);
    });

    it('should not register concentration when combat summary is null', async () => {
      combatData.getCombatSummary.mockReturnValue(null);
      setupSuccessfulSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(concentrationService.addConcentration).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('should dispatch window event for combat-summary-updated', async () => {
      const summary = { creatures: [{ name: 'TestCaster' }, { name: 'Goblin' }] };
      combatData.getCombatSummary.mockReturnValue(summary);
      setupSuccessfulSaveMock();

      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
      dispatchEventSpy.mockRestore();
    });
  });
});
