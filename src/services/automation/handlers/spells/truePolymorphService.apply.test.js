// @maintained-by-ai
/**
 * truePolymorph HEXAD lane #1983 — .apply (FOURTH lane). Subject: truePolymorphService.js.
 * Seam map: truePolymorphHandleModes.test.js header (#1980–#1986); also read
 * handler-main #1981 (truePolymorphHandler.test.js) + #1982 (truePolymorphResolveMaxCR.test.js).
 *
 * Owns (application lane):
 * - applyTruePolymorph (:42) — spell-name gate, strict action payload-builder contract,
 *   DC precedence chain, slotLevel fallback, throw-catch. LIVE via
 *   useComplexSpellHandlers.js:143/:163 (arity 5/5 verified at both call sites).
 * - confirmTruePolymorphTransform (:139) APPLICATION SEMANTICS — form-stat MERGE-vs-replace
 *   (truePolymorph merges stat blocks RAW; this engine replaces maxHp/ac/speed +
 *   polymorph* bookkeeping in place, carries currentHp/name/initiative/size/senses/
 *   equipment untouched), polymorphOriginal snapshot shape, tempHp policy + recast THP
 *   re-anchor, concentration DC math (:88), targetEffects stamp (:122), Infinity-compliant
 *   pendingExpirations (:171). LIVE via CharSheet.jsx:268.
 *
 * Differentiated vs #1986 (.transforms), which already pins basic transform writes
 * (first-transform stat swap, te add/replace-by-source, any(Number) conc DC, capacity
 * icon table). Byte-twin overlap there (first-snapshot swap + basic te/tempHp stamp)
 * is FINAL-REPORT consolidation fodder — no cross-file edits from this lane.
 *
 * CARRIED FLAGS (verified against source + prod data, production NOT touched):
 * 1. BUG-FLAG abilities-ARRAY (:88) — `playerStats.abilities?.CON?.bonus ?? 0` is an
 *    object-property access on the PROD ABILITIES ARRAY (verified test-campaign/*.json:
 *    [{ name: 'Constitution', baseScore: ... }], same defect class as polymorphService
 *    .js:60 twin, closed #1937). `.CON` is always undefined → CON modifier NEVER counts
 *    toward the concentration DC. Manifest corroborates: docs/automations-manifest.json:7026
 *    "conc-DC cosmetic divergence 14v19". Pinned honestly below: array shape → 8+prof+0;
 *    if prod gains a name-based lookup the array pin changes 12 → 14 (object-shape
 *    contrast pin stays 14).
 * 2. FLAG recast-snapshot-clobber (:98) — applyCreatureForm clobbers polymorphOriginal
 *    UNCONDITIONALLY (no isFirstTransform guard; canonical sibling animalShapesService
 *    .js:66-73 guards, polymorphService.js:78-82 same bug class, #1937). The handler's
 *    already-transformed gate (truePolymorphHandler.js:77-99) does NOT protect this lane:
 *    CharSheet.jsx:268 calls confirmTruePolymorphTransform directly. Pinned honest 'PIN:'
 *    recast-overwrites-first-snapshot; revert after recast restores beast-form, not the
 *    true original.
 *
 * RAW gaps noted, not fixed (shipped-as-is): ability scores / size / senses are NOT
 * swapped onto the combat-summary creature (only recorded inside polymorphBeast); gear
 * is neither absorbed nor stripped — it simply carries through untouched.
 * Seam note (#1986/final report): CharSheet passes spellLevel; confirm reads spell.level —
 * the spellLevel key is ignored outside the summon branch's slotLevel fallback.
 *
 * Turn-based only: no timers here or in the source lane; expiry is the Infinity-rounds
 * pendingExpirations marker cleared at seams — no clock, per no-timers policy.
 * Arity note (#1980 map): getRuntimeValue is really 2-arg; the prod 3rd campaignName arg
 * is silently ignored — mock implementations here depend on (key, subKey) only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { get: vi.fn(), set: vi.fn(() => Promise.resolve()) },
}));

vi.mock('./truePolymorphHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('./polymorphService.js', () => ({
  revertPolymorph: vi.fn(),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
  loadMonsters: vi.fn(),
}));

import {
  applyTruePolymorph,
  confirmTruePolymorphTransform,
} from './truePolymorphService.js';
import { handle as runTruePolymorphHandler } from './truePolymorphHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, setCombatSummaryCache } from '../../../encounters/combatData.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';

const SPELL = { name: 'True Polymorph', level: 9 };

const BEAR = {
  name: 'Bear', index: 'bear', size: 'Large',
  hit_points: 34, armor_class: 11, speed: '40 ft.', challenge_rating: '1',
};
const WOLF = {
  name: 'Wolf', index: 'wolf', size: 'Medium',
  hit_points: 22, armor_class: 12, speed: '35 ft.', challenge_rating: '1/2',
};

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: { CON: { bonus: 2 } },
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

function makeTarget(overrides = {}) {
  return {
    name: targetName, type: 'monster',
    currentHp: 5, maxHp: 15, ac: 13, speed: '30 ft.',
    ...overrides,
  };
}

function lastCall(mock, key, subKey) {
  const calls = vi.mocked(mock).mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    if (calls[i][0] === key && calls[i][1] === subKey) return calls[i];
  }
  return undefined;
}

describe('truePolymorphService.applyTruePolymorph — gate + payload builder (#1983)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null for non-true-polymorph spells', async () => {
    const result = await applyTruePolymorph({ name: 'Fireball' }, {}, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
    expect(runTruePolymorphHandler).not.toHaveBeenCalled();
  });

  it('SP-124: guards missing spell (no TypeError) when confirm wiring passes undefined', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await applyTruePolymorph(undefined, {}, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
    expect(runTruePolymorphHandler).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('gate strictness: case-insensitive exact match, and sibling spell "Polymorph" is a zero-side-effect refusal', async () => {
    runTruePolymorphHandler.mockResolvedValue({ type: 'popup', payload: {} });

    expect(await applyTruePolymorph({ name: 'TRUE POLYMORPH' }, {}, makePlayerStats(), campaignName, null)).not.toBeNull();
    expect(runTruePolymorphHandler).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    const result = await applyTruePolymorph({ name: 'Polymorph' }, {}, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
    // no-side-effect guard: gate bails before any runtime/log/concentration touch
    expect(runTruePolymorphHandler).not.toHaveBeenCalled();
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('dispatches the exact payload-builder contract and returns the handler result', async () => {
    const popup = { type: 'popup', payload: { type: 'true_polymorph_select', targetName } };
    runTruePolymorphHandler.mockResolvedValue(popup);

    const playerStats = makePlayerStats();
    const metaCtx = { truePolymorphTarget: targetName, spellSaveDc: 16, slotLevel: 9 };
    const result = await applyTruePolymorph(SPELL, metaCtx, playerStats, campaignName, null);

    expect(result).toBe(popup);
    const sent = vi.mocked(runTruePolymorphHandler).mock.calls[0][0];
    expect(sent.name).toBe('True Polymorph');
    expect(sent.automation).toEqual({
      type: 'true_polymorph',
      saveDc: 16,
      saveType: 'WIS',
      mode: undefined,
    });
    expect(sent.spell).toBe(SPELL);
    expect(sent.spellSlotLevel).toBe(9);
    expect(sent.metaCtx).toBe(metaCtx);
    expect(sent.mapName).toBeUndefined();
    // remaining handler args: playerStats identity, campaignName, mapName
    expect(runTruePolymorphHandler).toHaveBeenCalledWith(sent, playerStats, campaignName, null);
  });

  it('passes the mode from metaCtx.truePolymorphPath through automation.mode', async () => {
    runTruePolymorphHandler.mockResolvedValue({ type: 'popup', payload: {} });

    await applyTruePolymorph({ name: 'True Polymorph' }, { truePolymorphPath: 'object_into_creature' }, makePlayerStats(), campaignName, 'map-1');

    const sent = vi.mocked(runTruePolymorphHandler).mock.calls[0][0];
    expect(sent.automation.mode).toBe('object_into_creature');
    // mapName passthrough (5th arg → handler 4th arg), non-null verified here
    expect(runTruePolymorphHandler).toHaveBeenCalledWith(sent, expect.anything(), campaignName, 'map-1');
  });

  it('DC precedence strict table: metaCtx.spellSaveDc > spellAbilities.saveDc > 8+(proficiency||2)', async () => {
    runTruePolymorphHandler.mockResolvedValue({ type: 'popup', payload: {} });

    const cases = [
      { label: 'metaCtx wins over everything', metaCtx: { spellSaveDc: 16 }, stats: makePlayerStats(), want: 16 },
      { label: 'spellAbilities.saveDc is the middle tier', metaCtx: {}, stats: makePlayerStats(), want: 15 },
      { label: 'falsy metaCtx.spellSaveDc=0 falls through (|| chain)', metaCtx: { spellSaveDc: 0 }, stats: makePlayerStats(), want: 15 },
      { label: 'proficiency fallback', metaCtx: {}, stats: makePlayerStats({ spellAbilities: null }), want: 12 },
      { label: 'missing proficiency defaults to 2', metaCtx: {}, stats: makePlayerStats({ spellAbilities: null, proficiency: undefined }), want: 10 },
    ];

    for (const c of cases) {
      await applyTruePolymorph(SPELL, c.metaCtx, c.stats, campaignName, null);
      const sent = vi.mocked(runTruePolymorphHandler).mock.calls.at(-1)[0];
      expect(sent.automation.saveDc, c.label).toBe(c.want);
    }
    expect(runTruePolymorphHandler).toHaveBeenCalledTimes(cases.length);
  });

  it('slotLevel: metaCtx.slotLevel overrides spell.level, default 9 when neither present', async () => {
    runTruePolymorphHandler.mockResolvedValue({ type: 'popup', payload: {} });

    await applyTruePolymorph(SPELL, { slotLevel: 7 }, makePlayerStats(), campaignName, null);
    expect(vi.mocked(runTruePolymorphHandler).mock.calls[0][0].spellSlotLevel).toBe(7);

    await applyTruePolymorph(SPELL, {}, makePlayerStats(), campaignName, null);
    expect(vi.mocked(runTruePolymorphHandler).mock.calls[1][0].spellSlotLevel).toBe(9);

    await applyTruePolymorph({ name: 'True Polymorph' }, {}, makePlayerStats(), campaignName, null);
    expect(vi.mocked(runTruePolymorphHandler).mock.calls[2][0].spellSlotLevel).toBe(9);
  });

  it('returns null when the handler throws, logging the composed prefix with the error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = new Error('boom');
    runTruePolymorphHandler.mockRejectedValueOnce(boom);

    const result = await applyTruePolymorph(SPELL, {}, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith('[truePolymorphService] Failed to execute True Polymorph handler:', boom);
    errorSpy.mockRestore();
  });
});

describe('truePolymorphService.confirmTruePolymorphTransform — application semantics (#1983)', () => {
  let cs;

  function makeCombat() {
    return {
      round: 7,
      creatures: [
        makeTarget({ initiative: 12, size: 'Small', equipment: ['scimitar'], senses: 'darkvision 60 ft.' }),
        { name: casterName, type: 'player', initiative: 15, initiativeBonus: 2 },
      ],
    };
  }

  function confirm(args = {}) {
    return confirmTruePolymorphTransform({
      targetName,
      creature: BEAR,
      casterName,
      spell: SPELL,
      playerStats: makePlayerStats(),
      campaignName,
      ...args,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    cs = makeCombat();
    getCombatContext.mockResolvedValue(cs);
    getCombatSummary.mockReturnValue(cs);
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === casterName && subKey === 'pendingExpirations') return [];
      return undefined;
    });
  });

  it('in-place MERGE, not replace: form overwrites maxHp/ac/speed + polymorph bookkeeping only; currentHp/name/initiative/size/senses/equipment carry through', async () => {
    const result = await confirm();

    expect(result).toEqual({ ok: true });
    const creature = cs.creatures[0];
    // replaced by form
    expect(creature.maxHp).toBe(34);
    expect(creature.ac).toBe(11);
    expect(creature.speed).toBe('40 ft.');
    expect(creature.beastName).toBe('Bear');
    expect(creature.polymorphSource).toBe(casterName);
    expect(creature.polymorphOriginal).toEqual({ maxHp: 15, ac: 13, speed: '30 ft.' });
    expect(creature.polymorphBeast).toEqual({
      name: 'Bear', index: 'bear', size: 'Large',
      hitPoints: 34, armorClass: 11, speed: '40 ft.', challengeRating: '1',
    });
    // carried untouched (RAW full-stat-block replacement is NOT modeled on the
    // combat-summary creature: abilities/size/senses are only recorded in polymorphBeast)
    expect(creature.currentHp).toBe(5);
    expect(creature.name).toBe(targetName);
    expect(creature.initiative).toBe(12);
    expect(creature.size).toBe('Small');
    expect(creature.senses).toBe('darkvision 60 ft.');
    expect(creature.equipment).toEqual(['scimitar']);
    expect(creature.abilities).toBeUndefined();
  });

  it('tempHp policy: THP anchored to FULL form HP regardless of wounded currentHp', async () => {
    await confirm();

    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'tempHp', 34, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'polymorphTempHp', 34, campaignName);
  });

  it('PIN: recast-overwrites-first-snapshot — polymorphOriginal is clobbered with beast-form values (no isFirstTransform guard)', async () => {
    // FLAG FOR FINAL REPORT (:98) — applyCreatureForm clobbers polymorphOriginal
    // unconditionally. Canonical sibling animalShapesService.js:66-73 guards with
    // isFirstTransform; polymorphService.js:78-82 is the same bug class (#1937).
    // The handler's already-transformed gate does NOT cover this lane: CharSheet.jsx:268
    // calls confirmTruePolymorphTransform directly. Consequence: revert after recast
    // restores the FIRST FORM, not the true original.
    await confirm(); // goblin 15/13/30 → bear 34/11/40
    expect(cs.creatures[0].polymorphOriginal).toEqual({ maxHp: 15, ac: 13, speed: '30 ft.' });

    await confirm({ creature: WOLF }); // recast bear → wolf 22/12/35

    const creature = cs.creatures[0];
    expect(creature.polymorphOriginal).toEqual({ maxHp: 34, ac: 11, speed: '40 ft.' });
    expect(creature.maxHp).toBe(22);
    expect(creature.ac).toBe(12);
    expect(creature.beastName).toBe('Wolf');
    // THP anchor recast behavior: tempHp re-set to the NEW form's full HP.
    expect(lastCall(setRuntimeValue, targetName, 'tempHp')[2]).toBe(22);
    expect(lastCall(setRuntimeValue, targetName, 'polymorphTempHp')[2]).toBe(22);
  });

  it('PIN: BUG-FLAG abilities-ARRAY (:88) — concentration DC computed WITHOUT the CON modifier on prod array-shaped abilities', async () => {
    // Production shape verified in public/campaigns/test-campaign/*.json:
    // abilities is an ARRAY of { name, baseScore, ... } — `.CON` is undefined, so
    // `abilities?.CON?.bonus ?? 0` silently contributes 0. Honest pin of ACTUAL
    // behavior: DC = 8 + proficiency(4) + 0 = 12, NOT 8+4+2=14. A name-based fix
    // would move this pin 12 → 14. Manifest: docs/automations-manifest.json:7026
    // ("conc-DC cosmetic divergence 14v19"). Production NOT fixed here — pin only.
    const arrayAbilitiesStats = makePlayerStats({
      abilities: [{ name: 'Constitution', bonus: 2 }, { name: 'Strength', bonus: 0 }],
    });

    await confirm({ playerStats: arrayAbilitiesStats });

    expect(addConcentration).toHaveBeenCalledWith(cs, casterName, 'True Polymorph', 12);
  });

  it('concentration DC contrast: object-shaped abilities DO honor .CON.bonus — isolating the array-shape defect as strictly :88', async () => {
    await confirm({ playerStats: makePlayerStats({ abilities: { CON: { bonus: 2 } } }) });

    expect(addConcentration).toHaveBeenCalledWith(cs, casterName, 'True Polymorph', 14);
    // addCasterConcentration persists cs after the conc write, by identity
    expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
    expect(setCombatSummaryCache).toHaveBeenCalledWith(cs, campaignName);
  });

  it('caster absent from combat: transform still applies, concentration silently skipped', async () => {
    const csNoCaster = { round: 7, creatures: [makeTarget()] };
    getCombatContext.mockResolvedValue(csNoCaster);
    getCombatSummary.mockReturnValue(csNoCaster);

    const result = await confirm();

    expect(result).toEqual({ ok: true });
    expect(csNoCaster.creatures[0].maxHp).toBe(34);
    expect(addConcentration).not.toHaveBeenCalled();
    // main-flow cs persist (:161) still lands
    expect(storage.set).toHaveBeenCalledWith('combatSummary', csNoCaster, campaignName);
  });

  it('targetEffects stamp: exact strict table — array-target entries cleaned by first-element match, unrelated effects kept, new te last, skipSync=true', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') {
        return [
          { target: [targetName], effect: 'polymorph', source: 'OldCaster' },
          { target: 'Other', effect: 'stunned', source: 'Other' },
          { target: targetName, effect: 'true_polymorph', source: 'OldCaster' },
        ];
      }
      if (key === casterName && subKey === 'pendingExpirations') return [];
      return undefined;
    });

    await confirm({ mode: 'creature_to_object' });

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [
        { target: 'Other', effect: 'stunned', source: 'Other' },
        {
          target: targetName,
          source: casterName,
          effect: 'true_polymorph',
          duration: 'concentration',
          beastName: 'Bear',
          mode: 'creature_to_object',
        },
      ],
      campaignName,
      true,
    );
  });

  it('pendingExpirations: Infinity-rounds marker (no clock), replace-not-duplicate, appliedRound from cs.round with 1 fallback', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === casterName && subKey === 'pendingExpirations') {
        return [
          { target: targetName, effects: [{ type: 'true_polymorph' }], appliedRound: 2, expiryRounds: Infinity },
          { target: 'Other', effects: [{ type: 'hex' }] },
          { target: targetName, effects: [{ type: 'blessing' }] },
        ];
      }
      return undefined;
    });

    await confirm();

    const written = lastCall(setRuntimeValue, casterName, 'pendingExpirations')[2];
    expect(written).toEqual([
      { target: 'Other', effects: [{ type: 'hex' }] },
      { target: targetName, effects: [{ type: 'blessing' }] },
      { target: targetName, effects: [{ type: 'true_polymorph' }], appliedRound: 7, expiryRounds: Infinity, expireOnCreatureName: null },
    ]);

    // recast: replaced again, never duplicated
    await confirm({ creature: WOLF });
    const recast = lastCall(setRuntimeValue, casterName, 'pendingExpirations')[2];
    expect(recast.filter(e => e.target === targetName && e.effects.some(ef => ef.type === 'true_polymorph'))).toHaveLength(1);

    // no-round combat summary falls back to round 1
    getCombatSummary.mockReturnValue({ creatures: cs.creatures });
    await confirm();
    expect(lastCall(setRuntimeValue, casterName, 'pendingExpirations')[2].at(-1).appliedRound).toBe(1);
  });

  it('logs the transformation with the exact composed save_result entry (saveDc 0 / success:false hardcoded — cosmetic, pinned honest)', async () => {
    await confirm();

    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'save_result',
      characterName: casterName,
      rollType: 'save-polymorph',
      targetName,
      saveDc: 0,
      saveType: 'WIS',
      success: false,
      description: "Goblin is transformed into Bear (CR 1) by TestCaster's True Polymorph.",
    });
  });
});
