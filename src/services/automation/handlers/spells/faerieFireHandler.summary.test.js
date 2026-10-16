// @maintained-by-ai
/**
 * faerieFire TRIO lane #1909 — faerieFireSummary template + runtime-store fallbacks
 * (faerieFireHandler.js). Canonical TRIO SEAM MAP lives in faerieFireHandler.handle.test.js
 * header (#1907).
 *  - #1909 THIS FILE — owns faerieFireSummary L142-148 FULL-STRING template pins:
 *        affected branch (counts, affected-list results.join(' '), saved count, immunity
 *        note present/omitted legs, advantage/Dim-Light tail) and all-saved branch
 *        (immune note appended / trailing-space empty note). The 'immunity and advantage
 *        notes in summary' full-string pin is the load-bearing pin shed here by #1908's
 *        23→18 trim (verified live here 2026-10-16 — #1908 pins only the outlineTarget
 *        LOG note, never the popup summary). Plus runtime-store fallbacks L30-31/L49-50/
 *        L67-68 (null AND non-array legs via it.each), per-site addEntry .catch()
 *        exercises (isolated rejection so each console.error hit proves its own catch
 *        block: L79/L99/L110/L139/L193/L213), and the concentration-DC proficiency
 *        fallback (areaSpellUtils.js L28: spellAbilities.saveDc missing → 8 + (proficiency||2)).
 *  - #1907 faerieFireHandler.handle.test.js — handle orchestration (selection, prompt
 *        options, immunity-gate COUNTS incl. 'dex'/'Dexterity' variant table, mixed-dispatch
 *        smoke, spellNoticePopup envelope). Dropped here per #1907's overlap flag:
 *        'should handle all targets being the caster' (selection is handle's lane).
 *  - #1908 faerieFireHandler.save-handling.test.js — outlineTarget/recordFaerieFireSaveSuccess
 *        internals incl. addTargetResult payloads and log envelopes. Dropped here:
 *        'should handle save result with undefined roll and total' (byte-identical to #1908
 *        'should call addTargetResult with failure details') and the explicit roll/total
 *        pass-through pin (#1908 owns the payload lane; fallback leg pinned there).
 *
 * Kept name-stable for sibling cross-references (#1907 header):
 *  - 'should generate summary when no creatures affected (all saved)'
 *  - 'should include immune count in summary when some are immune'
 * Also kept: 'should process creature with non-DEX immunities array normally' — the ONLY
 * negative leg of hasDexImmunity anywhere in the trio (siblings use no-array or DEX-immune
 * creatures only), so it is load-bearing despite living in the handle-adjacent zone.
 *
 * Caller liveness (verified at source 2026-10-16): automation/index.js L274 import +
 * L586 dynamic dispatch `faerie_fire: handleFaerieFire`; automationRouter.js L255 routes
 * 'faerie_fire' to specialActions; meta from rules/features/faerieFireService.js L10;
 * live te consumers conditionEffects.js L510, clearExpirationEffects.js L163/L435
 * ('remove_faerie_fire'), concentrationService.js L334, ConditionEffectBadges.jsx L75.
 *
 * Lane patterns: exact full-string toEqual pins on the summary's own composition (empty
 * immuneNote produces a visible double/trailing space — pinned, not normalized); it.each
 * tables over fallback values; mockGetRuntimeValue router; makeSaveListener returns a
 * fresh pre-resolved promise — handle awaits its own chain, no setTimeout / vi.waitFor.
 * spellNoticePopup runs live (envelope asserted inline through its real composition).
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
import * as combatData from '../../../encounters/combatData.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import { addEntry } from '../../../ui/logService.js';

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

const soloCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster' },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

const dexImmuneCombatContext = {
  creatures: [
    { name: 'IronGolem', type: 'monster', weaknessesAndResistivities: { immunities: ['DEX'] } },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

function mockGetRuntimeValue(dispatch) {
  runtimeState.getRuntimeValue.mockImplementation((playerName, key, _cName) => dispatch(playerName, key, _cName));
}

function makeSaveListener(promiseResult, promptId) {
  return { promptId: promptId || 'faerie-prompt', promise: Promise.resolve(promiseResult) };
}

function setupFailedSaveMock() {
  damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
  savePrompt.buildSaveDc.mockReturnValue(15);
  mockGetRuntimeValue((playerName, key) => {
    if (key === 'targetEffects') return [];
    if (key === 'activeBuffs') return [];
    if (key === 'activeConditions') return [];
    return null;
  });
  savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));
}

// Runs handle() over `combat` with every non-immune target saving `success`,
// returning the popup result so faerieFireSummary's exact composition can be pinned.
async function runSummary({ combat = baseCombatContext, success = false } = {}) {
  damageUtils.getCombatContext.mockResolvedValue(combat);
  savePrompt.buildSaveDc.mockReturnValue(15);
  mockGetRuntimeValue((playerName, key) => {
    if (key === 'targetEffects') return [];
    if (key === 'activeBuffs') return [];
    if (key === 'activeConditions') return [];
    return null;
  });
  savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success }));
  return handle(makeAction(), makePlayerStats(), campaignName, null);
}

describe('faerieFireHandler.summary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('faerieFireSummary full-string templates (L142-148)', () => {
    it('should pin the full affected-branch summary with immunity and advantage notes', async () => {
      const result = await runSummary();

      // Full-string own-composition pin (the note pin shed by #1908): affected count,
      // results.join(' ') list, saved count, OMITTED immune note (note the double space
      // before 'Affected' — empty immuneNote is part of the template), advantage tail.
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Faerie Fire');
      expect(result.payload.description).toBe(
        'Faerie Fire affects 2 creature(s). Goblin is outlined. Orc is outlined. ' +
        '0 creature(s) saved.  Affected creatures shed Dim Light in a 10-foot radius, ' +
        'are immune to the Invisible condition, and attack rolls against them have Advantage.'
      );
    });

    it('should include immune count in summary when some are immune', async () => {
      // IronGolem immune (no prompt), Goblin fails: results join keeps the immune
      // entry ahead of the outlined entry; immune note embedded before the advantage tail.
      const result = await runSummary({
        combat: {
          ...baseCombatContext,
          creatures: [
            { name: 'IronGolem', type: 'monster', weaknessesAndResistivities: { immunities: ['DEX'] } },
            { name: 'Goblin', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
        },
      });

      expect(result.payload.description).toBe(
        'Faerie Fire affects 1 creature(s). IronGolem is immune. Goblin is outlined. ' +
        '0 creature(s) saved. 1 creature(s) immune. Affected creatures shed Dim Light ' +
        'in a 10-foot radius, are immune to the Invisible condition, and attack rolls ' +
        'against them have Advantage.'
      );
    });

    it('should generate summary when no creatures affected (all saved)', async () => {
      const result = await runSummary({ success: true });

      // Second branch; trailing space from the empty immune note is template-faithful.
      expect(result.payload.description).toBe(
        'No creatures affected by Faerie Fire. 2 creature(s) saved. '
      );
    });

    it('should append the immune note to the all-saved branch when targets are immune', async () => {
      const result = await runSummary({
        combat: {
          ...baseCombatContext,
          creatures: [
            { name: 'IronGolem', type: 'monster', weaknessesAndResistivities: { immunities: ['DEX'] } },
            { name: 'Goblin', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
        },
        success: true,
      });

      expect(result.payload.description).toBe(
        'No creatures affected by Faerie Fire. 1 creature(s) saved. 1 creature(s) immune.'
      );
    });
  });

  describe('runtime-store fallbacks (outlineTarget L30-31/L49-50/L67-68)', () => {
    it.each([
      ['null', null],
      ['a non-array string', 'not-an-array'],
    ])('should rebuild the targetEffects write from %s into a fresh array', async (_label, value) => {
      setupFailedSaveMock();
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'targetEffects') return value;
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Fallback guard evidence only — te SHAPE is #1908's lane.
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        expect.arrayContaining([expect.objectContaining({ target: 'Goblin', effect: 'faerie_fire' })]),
        campaignName,
      );
    });

    it.each([
      ['null', null],
      ['a non-array string', 'not-an-array'],
    ])('should rebuild the activeBuffs write from %s into a fresh array', async (_label, value) => {
      setupFailedSaveMock();
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return value;
        if (key === 'activeConditions') return [];
        return null;
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeBuffs',
        expect.arrayContaining([expect.objectContaining({ name: 'Faerie Fire' })]),
        campaignName,
      );
    });

    it.each([
      ['null', null],
      ['a non-array string', 'not-an-array'],
    ])('should write no activeConditions when the stored value is %s', async (_label, value) => {
      setupFailedSaveMock();
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return value;
        return null;
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.any(Array),
        campaignName,
      );
    });
  });

  describe('concentration DC proficiency fallback (areaSpellUtils L28)', () => {
    it('should compute concentration DC from proficiency when spellAbilities.saveDc is missing', async () => {
      const summary = { creatures: [{ name: 'TestCaster' }, { name: 'Goblin' }] };
      combatData.getCombatSummary.mockReturnValue(summary);
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      const playerStats = makePlayerStats({ spellAbilities: undefined });
      await handle(makeAction(), playerStats, campaignName, null);

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        summary,
        'TestCaster',
        'Faerie Fire',
        11,
      );
    });

    it('should use proficiency fallback of 2 when proficiency is 0 for concentration DC', async () => {
      const summary = { creatures: [{ name: 'TestCaster' }, { name: 'Goblin' }] };
      combatData.getCombatSummary.mockReturnValue(summary);
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      const playerStats = makePlayerStats({ spellAbilities: undefined, proficiency: 0 });
      await handle(makeAction(), playerStats, campaignName, null);

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        summary,
        'TestCaster',
        'Faerie Fire',
        10,
      );
    });
  });

  describe('addEntry .catch() error handling per log site', () => {
    // Each row rejects ONLY its own addEntry call, so exactly one console.error hit
    // proves that specific catch block is wired (handler L79/L99/L110/L139/L193/L213).
    const catchSites = [
      {
        label: 'immune-creature ability_use log (L193)',
        combat: dexImmuneCombatContext,
        success: false,
        conditions: [],
        reject: e => e.type === 'ability_use',
      },
      {
        label: 'cast ability_use prompt log (L213)',
        combat: soloCombatContext,
        success: false,
        conditions: [],
        reject: e => e.type === 'ability_use' && !!e.promptId,
      },
      {
        label: 'save_result success log (L139)',
        combat: soloCombatContext,
        success: true,
        conditions: [],
        reject: e => e.type === 'save_result' && e.success === true,
      },
      {
        label: 'Invisible removal condition log (L79)',
        combat: soloCombatContext,
        success: false,
        conditions: ['invisible'],
        reject: e => e.type === 'condition' && e.action === 'removed',
      },
      {
        label: 'condition applied log (L99)',
        combat: soloCombatContext,
        success: false,
        conditions: [],
        reject: e => e.type === 'condition' && e.action === 'applied',
      },
      {
        label: 'save_result failure log (L110)',
        combat: soloCombatContext,
        success: false,
        conditions: [],
        reject: e => e.type === 'save_result' && e.success === false,
      },
    ];

    it.each(catchSites)('should exercise the catch of the $label', async ({ combat, success, conditions, reject }) => {
      damageUtils.getCombatContext.mockResolvedValue(combat);
      savePrompt.buildSaveDc.mockReturnValue(15);
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return conditions;
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success }));
      addEntry.mockImplementation((cn, entry) =>
        reject(entry) ? Promise.reject(new Error('log error')) : Promise.resolve()
      );

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('[faerieFire] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('input fallbacks and immunity-gate negative leg', () => {
    it('should fall back to an empty automation object and build the DC from player stats', async () => {
      damageUtils.getCombatContext.mockResolvedValue(soloCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(10);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      const playerStats = makePlayerStats({ proficiency: 0, abilities: [] });
      const result = await handle({ name: 'Faerie Fire', automation: null }, playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith({}, playerStats);
    });

    it('should process creature with non-DEX immunities array normally', async () => {
      // Trio's ONLY negative leg of hasDexImmunity: siblings pin positive DEX/'dex'/
      // 'Dexterity' or no-immunity creatures — none pin a non-empty non-DEX array.
      const combatWithOtherImmunities = {
        ...baseCombatContext,
        creatures: [
          { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: ['fire'] } },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
      };
      damageUtils.getCombatContext.mockResolvedValue(combatWithOtherImmunities);
      savePrompt.buildSaveDc.mockReturnValue(14);
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return [];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Goblin' }),
      );
      expect(result.payload.description).toContain('Goblin is outlined.');
    });
  });
});
