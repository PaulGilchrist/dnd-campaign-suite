// @maintained-by-ai
/**
 * faerieFire TRIO lane #1907 — handle() orchestration (faerieFireHandler.js L150-228).
 * TRIO SEAM MAP (this header is the trio's canonical map; siblings back-to-back):
 *  - #1907 THIS FILE — handle orchestration: combat-context validation popup L155-158
 *        (three input classes: null context, context missing .creatures, empty creatures),
 *        target selection via selectFaerieTargets L114-119 (default-all-except-caster,
 *        metaCtx.targets filter, caster excluded FROM an explicit selection, empty-after-
 *        filter popup L163-165), storeSpellLastAttack payload L167-173, per-target loop
 *        SHAPE L183-225: immunity gate counts and prompt-skip (hasDexImmunity L20-26 case
 *        normalization 'dex'/'Dexterity' — the trio has no helpers lane, so the variant
 *        table pins here), exact-key createSaveListener option pins incl. heightenTarget
 *        disadvantage L204, and mixed-outcome branch dispatch proven by reaches-applier
 *        smoke (failed leg lands the campaign targetEffects write, saved leg lands none).
 *  - #1908 faerieFireHandler.save-handling.test.js — owns save-handling OUTCOMES:
 *        outlineTarget internals L28-111 (te SHAPE, activeBuffs shape, addExpiration
 *        enqueue, Invisible-condition removal, addTargetResult payloads, log envelopes),
 *        recordFaerieFireSaveSuccess internals L121-140, and registerSpellConcentration
 *        content (areaSpellUtils.js L25-31 via its combatData/concentrationService mocks).
 *  - #1909 faerieFireHandler.summary.test.js — owns faerieFireSummary L142-148 template
 *        composition (full-string/contains pins, immune-note omission, all-saved branch)
 *        plus null/non-array runtime-store fallbacks and addEntry .catch() exercises.
 *
 * Caller liveness (verified at source 2026-10-16): dispatched via automation/index.js
 * L274/L586 `faerie_fire: handleFaerieFire`; automationRouter.js L255 routes
 * 'faerie_fire' to specialActions; automation meta produced by
 * rules/features/faerieFireService.js. Live consumers of the te this handler emits:
 * conditionEffects.js L510, clearExpirationEffects.js L163/L435 ('remove_faerie_fire'),
 * concentrationService.js L334, ConditionEffectBadges.jsx L75.
 *
 * Sibling-overlap flags (exact test names):
 *  - #1909 'should handle all targets being the caster' duplicates this lane's
 *        'should return early when all creatures are the caster' (selection is handle's
 *        orchestration — owned HERE; recommend dropping it from #1909).
 *  - this lane's former 'should report all targets saving successfully' was TRIMMED
 *        2026-10-16: fully owned by #1909 'should generate summary when no creatures
 *        affected (all saved)' (same setup, superset pins).
 *  - immune-count SUMMARY wording pins live in #1909 ('should include immune count in
 *        summary when some are immune', singular leg); this lane pins only the prompt-
 *        skip orchestration and the plural-count evidence of gate dispatch.
 *
 * Lane patterns: exact-key pins on save-prompt options and storeSpellLastAttack payload;
 * mockGetRuntimeValue router over positional then-chains; makeSaveListener helper returns
 * a fresh resolved listener; makeAction MERGES automation overrides (saveType/saveDc stay
 * at the authored defaults unless overridden). spellNoticePopup runs live — its popup
 * envelope shape is asserted through its real composition. areaSpellUtils stays live
 * deliberately; concentration content is NOT pinned here (#1908's mocked lane).
 * No setTimeout / vi.waitFor needed — handle awaits its own promise chain.
 *
 * Turn-based: 'concentration' / 'Concentration, up to 1 minute' are latch strings cleared
 * at concentration/initiative/rest seams via addExpiration — never a wall-clock; no
 * timers in this file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './faerieFireHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageRollback from '../../common/damageRollback.js';

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

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
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

function makeSaveListener(promiseResult, promptId) {
  return { promptId: promptId || 'faerie-prompt', promise: Promise.resolve(promiseResult) };
}

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

describe('faerieFireHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('should return popup when combat context has no creatures', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('should return popup when combat context has no creatures property', async () => {
      damageUtils.getCombatContext.mockResolvedValue({});
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target selection', () => {
    it('should skip the caster itself and prompt each remaining target in order', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      mockEmptyStores();
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(2);
      expect(savePrompt.createSaveListener).toHaveBeenNthCalledWith(
        1, campaignName, expect.objectContaining({ targetName: 'Goblin' }));
      expect(savePrompt.createSaveListener).toHaveBeenNthCalledWith(
        2, campaignName, expect.objectContaining({ targetName: 'Orc' }));
    });

    it('should return early when all creatures are the caster', async () => {
      const onlyPlayerCombat = {
        creatures: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      damageUtils.getCombatContext.mockResolvedValue(onlyPlayerCombat);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No creatures selected');
    });

    it('should filter targets when metaCtx.targets is provided', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      mockEmptyStores();
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      const action = { ...makeAction(), metaCtx: { targets: ['Goblin'] } };
      await handle(action, makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Goblin' }),
      );
    });

    it('should return early when selected targets are empty after filtering', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);

      const action = { ...makeAction(), metaCtx: { targets: [] } };
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No creatures selected');
    });

    it('should exclude caster from selected targets', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      const action = { ...makeAction(), metaCtx: { targets: ['TestCaster', 'Goblin'] } };
      await handle(action, makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Goblin' }),
      );
    });
  });

  describe('immunity gate (per-target, before prompt)', () => {
    it('should skip creatures with DEX immunity', async () => {
      const combatWithImmune = {
        ...baseCombatContext,
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'IronGolem', type: 'monster', weaknessesAndResistivities: { immunities: ['DEX'] } },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
      };
      damageUtils.getCombatContext.mockResolvedValue(combatWithImmune);
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Goblin' }),
      );
      expect(result.payload.description).toContain('1 creature(s) immune');
    });

    it('should skip creatures with dex and Dexterity immunity variants', async () => {
      const combatWithImmune = {
        ...baseCombatContext,
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'IronGolem', type: 'monster', weaknessesAndResistivities: { immunities: ['dex'] } },
          { name: 'SteelGolem', type: 'monster', weaknessesAndResistivities: { immunities: ['Dexterity'] } },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
      };
      damageUtils.getCombatContext.mockResolvedValue(combatWithImmune);
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Goblin' }),
      );
      expect(result.payload.description).toContain('2 creature(s) immune');
    });
  });

  describe('save prompt wiring', () => {
    it('should build exact DEX save-prompt options per target with heightenTarget disadvantage', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      mockEmptyStores();
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      const action = { ...makeAction(), metaCtx: { heightenTarget: 'Goblin' } };
      await handle(action, makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenNthCalledWith(
        1,
        campaignName,
        { targetName: 'Goblin', saveType: 'DEX', saveDc: 14, dcSuccess: 'none', disadvantage: true },
      );
      expect(savePrompt.createSaveListener).toHaveBeenNthCalledWith(
        2,
        campaignName,
        { targetName: 'Orc', saveType: 'DEX', saveDc: 14, dcSuccess: 'none', disadvantage: false },
      );
    });
  });

  describe('loop branch dispatch (reaches-applier smoke)', () => {
    it('should dispatch failed leg to outline and success leg to none on mixed outcomes', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      mockEmptyStores();

      let callCount = 0;
      savePrompt.createSaveListener.mockImplementation(() => {
        callCount++;
        return makeSaveListener({ success: callCount > 1 });
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Branch dispatch: Goblin (1st) fails → outlineTarget ran (the ONLY campaign
      // targetEffects writer in handle's path); Orc (2nd) saved → no write for it.
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(2);
      const teWrites = runtimeState.setRuntimeValue.mock.calls.filter(
        ([scope, key]) => scope === 'campaign' && key === 'targetEffects'
      );
      expect(teWrites).toHaveLength(1);
      expect(teWrites[0][2]).toEqual([
        expect.objectContaining({ target: 'Goblin', effect: 'faerie_fire' }),
      ]);
      expect(result.payload.description).toContain('Faerie Fire affects 1 creature(s)');
      expect(result.payload.description).toContain('1 creature(s) saved');
    });
  });

  describe('spell attack tracking', () => {
    it('should call storeSpellLastAttack with correct params', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(damageRollback.storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: 'Faerie Fire',
        saveType: 'DEX',
        saveDc: 15,
        attackScope: 'aoe',
      });
    });
  });
});
