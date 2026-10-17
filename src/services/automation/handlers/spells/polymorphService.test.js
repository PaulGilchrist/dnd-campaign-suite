// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * polymorphService.test.js — lane #1937, SECOND of the polymorph PAIR
 * (sibling #1936 polymorphHandler.test.js closes first). Closes the family.
 *
 * Split (recorded at polymorphHandler.test.js header): handler lane is pure
 * gating + payload building with ZERO writes; THIS lane owns:
 * - applyPolymorph invocation shape (exact-key action object, arg identity,
 *   DC/slot resolution order, non-polymorph gate)
 * - confirmPolymorphTransform application semantics (form-stat swap,
 *   polymorphOriginal snapshot, tempHp/polymorphTempHp, targetEffects
 *   rewrite, concentration, pendingExpirations)
 * - revertPolymorph (restore, tempHp subtraction, caster recovery)
 *
 * Production-caller liveness (verified 2026-10-16):
 * - applyPolymorph ← useSimpleSpellHandlers.js:153 and useComplexSpellHandlers.js:81.
 *   Both pass metaCtx `{ polymorphTarget, characters }` — NEVER spellSaveDc /
 *   slotLevel — so the production DC path is playerStats.spellAbilities.saveDc
 *   and the production slot path is spell.level. Pinned as the primary shape.
 * - confirmPolymorphTransform ← CharSheet.jsx:232 (polymorph_select popup
 *   confirm, after popup registered by handler lane #1936).
 * - revertPolymorph ← applyDamage.js:446 (0hp break), clearExpirationEffects.js:448,
 *   CreatureCard.jsx:323, truePolymorphService.js:444.
 *
 * PROD-BUG-CLASS PINS (flagged for final report — production NOT touched):
 * 1. polymorphService.js:60 `playerStats.abilities?.CON?.bonus` is an
 *    object-property access on an ABILITIES ARRAY (prod shape verified in
 *    public/campaigns/test-campaign/*.json: [{ name: 'Constitution', ... }],
 *    same defect class as holdMonster #1924). It is always undefined, so the
 *    CON modifier NEVER counts toward the concentration DC. Pinned honestly
 *    below at 8 + proficiency + 0; if prod is fixed to do a name-based array
 *    lookup (abilityCalc convention), this pin changes 12 → 14.
 * 2. confirmPolymorphTransform clobbers polymorphOriginal UNCONDITIONALLY on
 *    a recast, unlike the canonical transform-MERGE sibling animalShapesService
 *    (isFirstTransform guard, maintained). Pinned honestly: a re-polymorph
 *    snapshots the beast-form values, losing the true original.
 *
 * Merge semantics (as-shipped): confirm mutates the combat-summary creature IN
 * PLACE — object-level MERGE. Only maxHp/ac/speed/beastName/polymorphSource/
 * polymorphBeast/polymorphOriginal are replaced; currentHp and unrelated
 * fields (conditions, equipment) carry through untouched, with the beast HP
 * landing as the tempHp/polymorphTempHp buffer.
 *
 * Turn-based only: no timers in this lane's source or tests; expiry is the
 * Infinity-rounds pendingExpirations marker, cleared at seams by callers.
 */

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
  getCurrentCombatRound: vi.fn(() => 3),
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

vi.mock('./polymorphHandler.js', () => ({
  handle: vi.fn(),
}));

import { applyPolymorph, confirmPolymorphTransform, revertPolymorph, getActivePolymorphs, getPolymorphCaster } from './polymorphService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, setCombatSummaryCache } from '../../../encounters/combatData.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';
import { handle as runPolymorphHandler } from './polymorphHandler.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';

const beast = {
  name: 'Wolf',
  index: 'wolf',
  size: 'Medium',
  hit_points: 22,
  armor_class: 13,
  speed: '40 ft.',
  challenge_rating: '1/4',
};

// Prod-fidelity stats: `abilities` is an ARRAY of full-name entries
// (verified against public/campaigns/test-campaign/*.json), `spellAbilities`
// is an object with saveDc. Do not reshape — the array shape is the point:
// it is what makes the :60 PROD-BUG pin honest.
function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [
      { name: 'Constitution', baseScore: 14, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0, bonus: 2 },
      { name: 'Charisma', baseScore: 20, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0, bonus: 5 },
    ],
    spellAbilities: { saveDc: 15, spellCastingAbility: 'Charisma', modifier: 5, toHit: 9 },
    ...overrides,
  };
}

function makeTargetCreature(overrides = {}) {
  return { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, ac: 15, speed: 30, ...overrides };
}

function makeRuntime({ targetEffects = [], pendingExpirations = [] } = {}) {
  getRuntimeValue.mockImplementation((key, subKey) => {
    if (key === 'campaign' && subKey === 'targetEffects') return targetEffects;
    if (key === casterName && subKey === 'pendingExpirations') return pendingExpirations;
    return undefined;
  });
}

const baseTransform = {
  targetName,
  beast,
  casterName,
  spell: { name: 'Polymorph', level: 4 },
  playerStats: makePlayerStats(),
  campaignName,
};

describe('polymorphService.applyPolymorph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for non-polymorph spells without dispatching', async () => {
    expect(await applyPolymorph({ name: 'Fireball' }, {}, makePlayerStats(), campaignName, null)).toBeNull();
    expect(await applyPolymorph({}, {}, makePlayerStats(), campaignName, null)).toBeNull();

    expect(runPolymorphHandler).not.toHaveBeenCalled();
  });

  it('dispatches the production caller shape and returns the popup verbatim', async () => {
    const popup = { type: 'popup', payload: { type: 'polymorph_select', targetName } };
    runPolymorphHandler.mockResolvedValue(popup);
    const spell = { name: 'Polymorph', level: 4 };
    const stats = makePlayerStats();
    // Exact metaCtx shape from useSimpleSpellHandlers.js:153 / useComplexSpellHandlers.js:81:
    // no spellSaveDc, no slotLevel — DC resolves via spellAbilities.saveDc, slot via spell.level.
    const metaCtx = { polymorphTarget: targetName, characters: [] };

    const result = await applyPolymorph(spell, metaCtx, stats, campaignName, null);

    expect(runPolymorphHandler).toHaveBeenCalledWith(
      {
        name: 'Polymorph',
        automation: { type: 'polymorph', saveDc: 15, saveType: 'WIS' },
        spell,
        spellSlotLevel: 4,
        metaCtx,
      },
      stats,
      campaignName,
      null,
    );
    expect(result).toBe(popup);
  });

  it('honors metaCtx DC/slot overrides and falls back to 8+prof and level 4', async () => {
    runPolymorphHandler.mockResolvedValue(null);

    await applyPolymorph({ name: 'Polymorph', level: 7 }, { spellSaveDc: 18, slotLevel: 7 }, makePlayerStats(), campaignName, null);
    // Thin stats: no spellAbilities, no proficiency → 8 + (proficiency || 2); spell without level → slot 4.
    await applyPolymorph({ name: 'Polymorph' }, {}, { name: casterName }, campaignName, null);

    const [first, second] = runPolymorphHandler.mock.calls.map(c => c[0]);
    expect(first.automation).toEqual({ type: 'polymorph', saveDc: 18, saveType: 'WIS' });
    expect(first.spellSlotLevel).toBe(7);
    expect(second.automation).toEqual({ type: 'polymorph', saveDc: 10, saveType: 'WIS' });
    expect(second.spellSlotLevel).toBe(4);
  });

  it('returns null when the handler throws', async () => {
    runPolymorphHandler.mockRejectedValueOnce(new Error('boom'));

    const result = await applyPolymorph({ name: 'Polymorph', level: 4 }, { polymorphTarget: targetName }, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });
});

describe('polymorphService.confirmPolymorphTransform', () => {
  let cs;

  beforeEach(() => {
    vi.clearAllMocks();
    cs = { creatures: [makeTargetCreature(), { name: casterName, type: 'player' }] };
    getCombatContext.mockResolvedValue(cs);
    makeRuntime();
  });

  it('returns no_target and writes nothing when creature is missing from combat', async () => {
    getCombatContext.mockResolvedValue({ creatures: [{ name: casterName, type: 'player' }] });

    const result = await confirmPolymorphTransform(baseTransform);

    expect(result).toEqual({ ok: false, reason: 'no_target' });
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
  });

  it('swaps form stats in place, snapshots originals, and merges unrelated fields', async () => {
    cs.creatures[0].conditions = ['stunned'];
    cs.creatures[0].equipment = ['scimitar'];

    const result = await confirmPolymorphTransform(baseTransform);

    expect(result).toEqual({ ok: true });
    const creature = cs.creatures[0];
    expect(creature.maxHp).toBe(22);
    expect(creature.ac).toBe(13);
    expect(creature.speed).toBe('40 ft.');
    expect(creature.beastName).toBe('Wolf');
    expect(creature.polymorphSource).toBe(casterName);
    expect(creature.polymorphBeast).toEqual({
      name: 'Wolf', index: 'wolf', size: 'Medium', hitPoints: 22, armorClass: 13, speed: '40 ft.', challengeRating: '1/4',
    });
    expect(creature.polymorphOriginal).toEqual({ maxHp: 7, ac: 15, speed: 30 });
    // Merge semantics: untouched fields carry through (no wholesale replace).
    expect(creature.currentHp).toBe(5);
    expect(creature.conditions).toEqual(['stunned']);
    expect(creature.equipment).toEqual(['scimitar']);
  });

  it('applies numOr fallbacks for thin beast data and replaces speed even when undefined', async () => {
    await confirmPolymorphTransform({ ...baseTransform, beast: { name: 'Rat', hit_points: undefined, armor_class: undefined } });

    const creature = cs.creatures[0];
    expect(creature.maxHp).toBe(0);
    expect(creature.ac).toBe(10);
    // No numOr guard on speed: undefined overwrites the original value on the form.
    expect(creature.speed).toBeUndefined();
    expect(creature.polymorphOriginal).toEqual({ maxHp: 7, ac: 15, speed: 30 });
  });

  it('PIN: recast clobbers polymorphOriginal (unlike canonical animalShapes isFirstTransform merge)', async () => {
    // FLAG FOR FINAL REPORT (equipment-merge-gap adjacent): a re-polymorph
    // overwrites the snapshot with current BEAST-form values; the maintained
    // sibling animalShapesService.js:66-73 guards with isFirstTransform.
    cs.creatures[0] = makeTargetCreature({
      maxHp: 22, ac: 13, speed: '40 ft.', beastName: 'Wolf', polymorphSource: casterName,
      polymorphOriginal: { maxHp: 7, ac: 15, speed: 30 },
    });
    const bear = { name: 'Bear', index: 'bear', size: 'Large', hit_points: 34, armor_class: 12, speed: '40 ft.', challenge_rating: '1/2' };

    await confirmPolymorphTransform({ ...baseTransform, beast: bear });

    const creature = cs.creatures[0];
    expect(creature.polymorphOriginal).toEqual({ maxHp: 22, ac: 13, speed: '40 ft.' });
    expect(creature.maxHp).toBe(34);
    expect(creature.beastName).toBe('Bear');
  });

  it('writes the beast HP as tempHp and polymorphTempHp', async () => {
    await confirmPolymorphTransform(baseTransform);

    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'tempHp', 22, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'polymorphTempHp', 22, campaignName);
  });

  it('persists the mutated combat summary by identity', async () => {
    await confirmPolymorphTransform(baseTransform);

    expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
    expect(setCombatSummaryCache).toHaveBeenCalledWith(cs, campaignName);
  });

  it('pushes a registry-shaped polymorph targetEffect with skipSync', async () => {
    await confirmPolymorphTransform(baseTransform);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [{ target: targetName, source: casterName, effect: 'polymorph', duration: 'concentration', beastName: 'Wolf' }],
      campaignName,
      true,
    );
  });

  it('replaces a prior polymorph for this target and preserves all other effects in order', async () => {
    const orc = { target: 'Orc', source: 'SomeoneElse', effect: 'polymorph' };
    const held = { target: targetName, source: casterName, effect: 'hold_monster' };
    makeRuntime({ targetEffects: [orc, held, { target: targetName, effect: 'polymorph', source: 'OldCaster' }] });

    await confirmPolymorphTransform(baseTransform);

    const effectsCall = setRuntimeValue.mock.calls.find(call => call[0] === 'campaign' && call[1] === 'targetEffects');
    expect(effectsCall[2]).toEqual([
      orc,
      held,
      { target: targetName, source: casterName, effect: 'polymorph', duration: 'concentration', beastName: 'Wolf' },
    ]);
    expect(effectsCall[4]).toBe(true);
  });

  it('PIN: concentration DC omits the CON modifier (PROD-BUG-CLASS, polymorphService.js:60)', async () => {
    // abilities?.CON?.bonus is object access on an ABILITIES ARRAY → always
    // undefined → ?? 0. Honest pin of ACTUAL behavior: 8 + proficiency(4) + 0 = 12.
    // If prod is fixed to a name-based array lookup, the honest DC is 14
    // (CON bonus 2) and this pin must move — do not "fix" it by reshaping stats.
    await confirmPolymorphTransform(baseTransform);

    expect(addConcentration).toHaveBeenCalledWith(cs, casterName, 'Polymorph', 12);
  });

  it('uses the proficiency fallback for the concentration DC when stats are thin', async () => {
    await confirmPolymorphTransform({ ...baseTransform, playerStats: { name: casterName } });

    expect(addConcentration).toHaveBeenCalledWith(cs, casterName, 'Polymorph', 10);
  });

  it('skips concentration registration when the caster is absent from combat', async () => {
    getCombatContext.mockResolvedValue({ creatures: [makeTargetCreature()] });

    const result = await confirmPolymorphTransform(baseTransform);

    expect(result).toEqual({ ok: true });
    expect(addConcentration).not.toHaveBeenCalled();
    // Form swap + summary persist still happened (helper early-return is the only skip).
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
  });

  it('writes the exact infinite-rounds pending expiration and preserves unrelated ones', async () => {
    const otherTarget = { target: 'Orc', effects: [{ type: 'hex' }], expiryRounds: Infinity };
    const otherType = { target: targetName, effects: [{ type: 'bless' }], expiryRounds: 5 };
    makeRuntime({ pendingExpirations: [otherTarget, otherType, { target: targetName, effects: [{ type: 'polymorph' }], expiryRounds: 1 }]});

    await confirmPolymorphTransform(baseTransform);

    expect(setRuntimeValue).toHaveBeenCalledWith(casterName, 'pendingExpirations', [
      otherTarget,
      otherType,
      { target: targetName, effects: [{ type: 'polymorph' }], appliedRound: 3, expiryRounds: Infinity, expireOnCreatureName: null },
    ], campaignName);
  });

  it('builds a fresh expiration list when the caster has none (non-array runtime)', async () => {
    makeRuntime({ pendingExpirations: undefined });

    await confirmPolymorphTransform(baseTransform);

    expect(setRuntimeValue).toHaveBeenCalledWith(casterName, 'pendingExpirations', [
      { target: targetName, effects: [{ type: 'polymorph' }], appliedRound: 3, expiryRounds: Infinity, expireOnCreatureName: null },
    ], campaignName);
  });

  it('logs the transformation with its exact own composition', async () => {
    await confirmPolymorphTransform(baseTransform);

    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'save_result',
      characterName: casterName,
      rollType: 'save-polymorph',
      targetName,
      saveDc: 0,
      saveType: 'WIS',
      success: false,
      description: "Goblin is transformed into Wolf (CR 1/4) by TestCaster's Polymorph.",
    });
  });
});

describe('polymorphService.revertPolymorph', () => {
  let cs;
  const polymorphEffect = { target: targetName, source: casterName, effect: 'polymorph', beastName: 'Wolf' };

  beforeEach(() => {
    vi.clearAllMocks();
    cs = { creatures: [makeTargetCreature({
      maxHp: 22, ac: 13, speed: '40 ft.',
      polymorphSource: casterName,
      polymorphOriginal: { maxHp: 7, ac: 15, speed: 30 },
      polymorphBeast: { name: 'Wolf' },
      beastName: 'Wolf',
    })] };
    getCombatSummary.mockReturnValue(cs);
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [polymorphEffect];
      if (key === targetName && subKey === 'polymorphTempHp') return 22;
      if (key === targetName && subKey === 'tempHp') return 22;
      if (key === casterName && subKey === 'pendingExpirations') return [{ target: targetName, effects: [{ type: 'polymorph' }], expiryRounds: Infinity }];
      return undefined;
    });
  });

  it('restores original stats, clears polymorph fields, and persists by identity', () => {
    const changed = revertPolymorph(targetName, campaignName);

    const creature = cs.creatures[0];
    expect(changed).toBe(true);
    expect(creature.maxHp).toBe(7);
    expect(creature.ac).toBe(15);
    expect(creature.speed).toBe(30);
    expect(creature.polymorphSource).toBeUndefined();
    expect(creature.polymorphOriginal).toBeUndefined();
    expect(creature.polymorphBeast).toBeUndefined();
    expect(creature.beastName).toBeUndefined();
    expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
    expect(setCombatSummaryCache).toHaveBeenCalledWith(cs, campaignName);
  });

  it('removes only this target\'s polymorph effect from the campaign', () => {
    const orc = { target: 'Orc', source: 'SomeoneElse', effect: 'polymorph' };
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [orc, polymorphEffect];
      return undefined;
    });

    revertPolymorph(targetName, campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [orc], campaignName, true);
  });

  it('subtracts the polymorph buffer from stored temp HP, keeping the remainder', () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'polymorphTempHp') return 22;
      if (key === targetName && subKey === 'tempHp') return 30;
      return undefined;
    });

    revertPolymorph(targetName, campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'tempHp', 8, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'polymorphTempHp', 0, campaignName);
  });

  it('restores temp HP from currentHitPoints when no polymorph buffer was tracked', () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'currentHitPoints') return 5;
      return undefined;
    });

    revertPolymorph(targetName, campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'tempHp', 5, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'polymorphTempHp', 0, campaignName);
  });

  it('writes nothing to temp HP when there is no buffer and no tracked current HP', () => {
    getRuntimeValue.mockImplementation(() => undefined);
    const targetWrites = () => setRuntimeValue.mock.calls.filter(c => c[1] === 'tempHp' || c[1] === 'polymorphTempHp');

    revertPolymorph(targetName, campaignName);

    expect(targetWrites()).toHaveLength(0);
  });

  it('removes the polymorph expiration from the caster, preserving other types', () => {
    const bless = { target: targetName, effects: [{ type: 'bless' }], expiryRounds: 5 };
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === casterName && subKey === 'pendingExpirations') return [{ target: targetName, effects: [{ type: 'polymorph' }], expiryRounds: Infinity }, bless];
      return undefined;
    });

    revertPolymorph(targetName, campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith(casterName, 'pendingExpirations', [bless], campaignName);
  });

  it('recovers the caster from targetEffects when the creature marker is gone', () => {
    cs.creatures[0] = makeTargetCreature();
    const otherEffect = { target: targetName, source: casterName, effect: 'polymorph', beastName: 'Wolf' };
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [otherEffect];
      if (key === casterName && subKey === 'pendingExpirations') return [{ target: targetName, effects: [{ type: 'polymorph' }], expiryRounds: Infinity }];
      return undefined;
    });

    const changed = revertPolymorph(targetName, campaignName);

    expect(changed).toBe(false);
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], campaignName, true);
    // Caster recovered from the effect, so its expiration is still cleaned.
    expect(setRuntimeValue).toHaveBeenCalledWith(casterName, 'pendingExpirations', [], campaignName);
  });

  it('keeps the beast speed when the snapshot has no speed (undefined guard)', () => {
    cs.creatures[0] = makeTargetCreature({
      maxHp: 22, ac: 13, speed: '40 ft.', polymorphSource: casterName, polymorphOriginal: { maxHp: 7, ac: 15 },
    });

    revertPolymorph(targetName, campaignName);

    const creature = cs.creatures[0];
    expect(creature.maxHp).toBe(7);
    expect(creature.ac).toBe(15);
    expect(creature.speed).toBe('40 ft.');
  });

  it('restores to undefined maxHp/ac when no snapshot exists (actual behavior)', () => {
    cs.creatures[0] = makeTargetCreature({ maxHp: 22, ac: 13, polymorphSource: casterName });

    const changed = revertPolymorph(targetName, campaignName);

    expect(changed).toBe(true);
    expect(cs.creatures[0].maxHp).toBeUndefined();
    expect(cs.creatures[0].ac).toBeUndefined();
  });

  it('is an idempotent no-op for an unpolymorphed target (log still fires)', () => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue({ creatures: [makeTargetCreature()] });
    getRuntimeValue.mockImplementation(() => undefined);

    const changed = revertPolymorph(targetName, campaignName);

    expect(changed).toBe(false);
    expect(storage.set).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: targetName,
      abilityName: 'Polymorph',
      description: 'Goblin reverts to their normal form.',
    });
  });
});

describe('polymorphService helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([
      { target: targetName, source: casterName, effect: 'polymorph' },
      { target: 'Orc', source: 'SomeoneElse', effect: 'polymorph' },
      { target: 'Kobold', source: casterName, effect: 'hold_monster' },
    ]);
  });

  it('getActivePolymorphs returns only polymorph effects', () => {
    const effects = getActivePolymorphs(campaignName);

    expect(effects).toHaveLength(2);
    expect(effects.every(te => te.effect === 'polymorph')).toBe(true);
  });

  it('getActivePolymorphs guards an unset targetEffects runtime', () => {
    getRuntimeValue.mockReturnValue(undefined);

    expect(getActivePolymorphs(campaignName)).toEqual([]);
  });

  it('getPolymorphCaster returns the source for direct and array targets', () => {
    expect(getPolymorphCaster(targetName, campaignName)).toBe(casterName);

    getRuntimeValue.mockReturnValue([{ target: [targetName, 'Orc'], source: casterName, effect: 'polymorph' }]);
    expect(getPolymorphCaster(targetName, campaignName)).toBe(casterName);
  });

  it('getPolymorphCaster returns null for non-polymorph targets and unset runtime', () => {
    expect(getPolymorphCaster('Kobold', campaignName)).toBeNull();

    getRuntimeValue.mockReturnValue(undefined);
    expect(getPolymorphCaster(targetName, campaignName)).toBeNull();
  });
});
