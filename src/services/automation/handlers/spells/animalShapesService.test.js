// @maintained-by-ai
//
// LANE: animalShapesService.js mutation lane (#1860 — second of animalShapes trio,
// handler lane closed, spellData closes next). This lane owns the service's storage
// writes: confirm-transform targetEffects MERGE pins (same-target replace incl.
// array-target normalisation, other-target/other-effect preservation, skipSync=true)
// — distinct from the handler's read-only already-transformed guard. Also owns
// pendingExpirations filter+push exact arrays (apply + revert sides), THP grant /
// remainder via setRuntimeObject only (never setRuntimeValue), polymorphOriginal
// capture-once, and combatSummary persistence. All deps mocked; deterministic.
//
// TRIO MAP:
// - animalShapesHandler.test.js: dispatch entry, read-only guard, popup composition.
// - animalShapesSpellData.test.js: spells.json automation.type data pin.
// Consumers (different seams, not dupes): clearExpirationEffects*.test.js and
// CreatureCard*.test.js / CreatureBadge consumers mock this service and own their seam.
//
// TRIM HISTORY (consolidations):
// - three revert-side pendingExpirations-filter tests (one literal duplicate pair +
//   one discriminating variant) → one exact-array pin + one no-write guard (the
//   filtered.length===expirations.length early-return was previously unpinned).
// - three apply-side expiration tests (add-existing-filter) → one exact-array pin.
// - weak "should set animal_shapes targetEffect" (Array.isArray only) → exact merge pin.
// - two THP revert tests that both asserted tempHp:0 (non-discriminating) →
//   remainder(7) / clamp(0) / no-grant(no-write) triple.
// - shared mutable creature fixture → per-test factory (no cross-test bleed).

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

import { getRuntimeValue, setRuntimeValue, setRuntimeObject } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, setCombatSummaryCache } from '../../../encounters/combatData.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';
import { applyAnimalShapes, revertAnimalShapes, getActiveAnimalShapes, getAnimalShapesCaster, confirmAnimalShapesTransform } from './animalShapesService.js';

const campaignName = 'TestCampaign';
const casterName = 'Druid1';
const targetName = 'Rogue1';
const spell = { name: 'Animal Shapes', level: 8 };

const beast = {
  name: 'Wolf',
  index: 'wolf',
  size: 'Large',
  hit_points: 13,
  armor_class: 11,
  speed: { walk: 40 },
  challenge_rating: '1/4',
  actions: [{ name: 'Bite' }],
};

function makeCreature(overrides = {}) {
  return { name: targetName, type: 'player', maxHp: 10, ac: 14, speed: { walk: 30 }, currentHp: 8, ...overrides };
}

// Router over the service's runtime reads — replaces positional mock chains.
function mockState({ creatures = [makeCreature()], targetEffects = [], pendingExpirations = [], tempHp = 0, animalShapesTempHp = 0 } = {}) {
  const cs = { creatures };
  getCombatContext.mockResolvedValue(cs);
  getCombatSummary.mockReturnValue(cs);
  getRuntimeValue.mockImplementation((key, subKey) => {
    if (key === 'campaign' && subKey === 'targetEffects') return targetEffects;
    if (key === casterName && subKey === 'pendingExpirations') return pendingExpirations;
    if (key === targetName && subKey === 'tempHp') return tempHp;
    if (key === targetName && subKey === 'animalShapesTempHp') return animalShapesTempHp;
    return undefined;
  });
  return cs;
}

beforeEach(() => {
  getRuntimeValue.mockReset();
  setRuntimeValue.mockReset();
  setRuntimeObject.mockReset();
  getCombatSummary.mockReset();
  getCombatContext.mockReset();
  setCombatSummaryCache.mockReset();
  addEntry.mockReset().mockResolvedValue();
  storage.set.mockReset().mockResolvedValue(undefined);
});

describe('animalShapesService', () => {
  describe('applyAnimalShapes', () => {
    it('should return error when no targetBeastMap, writing nothing', async () => {
      const result = await applyAnimalShapes({ targetBeastMap: null, casterName, spell, campaignName });
      expect(result).toEqual({ ok: false, reason: 'no_targets' });
      expect(getCombatContext).not.toHaveBeenCalled();
      expect(setRuntimeObject).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('should transform a target with the chosen beast (full write contract)', async () => {
      const creature = makeCreature();
      mockState({ creatures: [creature] });
      const result = await applyAnimalShapes({ targetBeastMap: { [targetName]: beast }, casterName, spell, campaignName });

      expect(result.ok).toBe(true);
      expect(result.results).toEqual([{ ok: true }]);
      expect(creature.polymorphOriginal).toEqual({ maxHp: 10, ac: 14, speed: { walk: 30 } });
      expect(creature.maxHp).toBe(13);
      expect(creature.ac).toBe(11);
      expect(creature.speed).toEqual({ walk: 40 });
      expect(creature.animalShapesSource).toBe(casterName);
      expect(creature.beastName).toBe('Wolf');
      expect(creature.animalShapesBeast).toEqual({
        name: 'Wolf', index: 'wolf', size: 'Large', hitPoints: 13, armorClass: 11, speed: { walk: 40 }, challengeRating: '1/4',
      });
      expect(setRuntimeObject).toHaveBeenCalledWith(targetName, { tempHp: 13, animalShapesTempHp: 13 }, campaignName);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(targetName, 'tempHp', expect.anything(), campaignName);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(targetName, 'animalShapesTempHp', expect.anything(), campaignName);
      expect(storage.set).toHaveBeenCalledWith('combatSummary', { creatures: [creature] }, campaignName);
      expect(setCombatSummaryCache).toHaveBeenCalledWith({ creatures: [creature] }, campaignName);
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-animal-shapes',
        targetName,
        saveDc: 0,
        saveType: 'WIS',
        success: false,
        description: `${targetName} is transformed into Wolf (CR 1/4) by ${casterName}'s Animal Shapes.`,
      });
    });

    it('should skip targets not found in combat or missing beast, without writing', async () => {
      mockState({ creatures: [{ name: 'OtherTarget', type: 'player' }] });
      const result = await applyAnimalShapes({
        targetBeastMap: { [targetName]: beast, 'OtherTarget': null },
        casterName,
        spell,
        campaignName,
      });
      expect(result.results).toHaveLength(0);
      expect(setRuntimeObject).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('should transform every target in the map (apply-side aggregation)', async () => {
      const c1 = makeCreature();
      const c2 = makeCreature({ name: 'Rogue2', maxHp: 12, ac: 13 });
      const bat = { ...beast, index: 'bat', name: 'Bat', hit_points: 1, armor_class: 12 };
      mockState({ creatures: [c1, c2] });
      const result = await applyAnimalShapes({
        targetBeastMap: { [targetName]: beast, 'Rogue2': bat },
        casterName,
        spell,
        campaignName,
      });
      expect(result).toEqual({ ok: true, results: [{ ok: true }, { ok: true }] });
      expect(c1.beastName).toBe('Wolf');
      expect(c1.maxHp).toBe(13);
      expect(c2.beastName).toBe('Bat');
      expect(c2.maxHp).toBe(1);
      expect(c2.ac).toBe(12);
      expect(setRuntimeObject).toHaveBeenCalledWith('Rogue2', { tempHp: 1, animalShapesTempHp: 1 }, campaignName);
    });

    it('writes pendingExpirations exactly: drops stale same-target animal_shapes, preserves others, appends exact new entry', async () => {
      const creature = makeCreature();
      const staleExp = { target: targetName, effects: [{ type: 'animal_shapes' }], appliedRound: 1, expiryRounds: Infinity, expireOnCreatureName: targetName };
      const otherAnimalExp = { target: 'OtherTarget', effects: [{ type: 'animal_shapes' }], appliedRound: 2, expiryRounds: 3, expireOnCreatureName: 'OtherTarget' };
      const sameTargetHasteExp = { target: targetName, effects: [{ type: 'haste' }], appliedRound: 1, expiryRounds: 5, expireOnCreatureName: targetName };
      mockState({ creatures: [creature], pendingExpirations: [staleExp, otherAnimalExp, sameTargetHasteExp] });

      await applyAnimalShapes({ targetBeastMap: { [targetName]: beast }, casterName, spell, campaignName });

      expect(setRuntimeValue).toHaveBeenCalledWith(casterName, 'pendingExpirations', [
        otherAnimalExp,
        sameTargetHasteExp,
        { target: targetName, effects: [{ type: 'animal_shapes' }], appliedRound: 1, expiryRounds: Infinity, expireOnCreatureName: targetName },
      ], campaignName);
    });
  });

  describe('confirmAnimalShapesTransform', () => {
    it('should return error when creature not found in combat, writing nothing', async () => {
      mockState({ creatures: [{ name: 'OtherTarget', type: 'player' }] });
      const result = await confirmAnimalShapesTransform({ targetName, beast, casterName, spell, campaignName });
      expect(result).toEqual({ ok: false, reason: 'no_target' });
      expect(setRuntimeObject).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('targetEffects MERGE exact: replaces same-target animal_shapes (incl. array-target), preserves other effects and other targets, skipSync=true', async () => {
      const creature = makeCreature();
      const sameTargetArrayTarget = { effect: 'animal_shapes', target: [targetName], source: 'OldCaster' };
      const sameTargetHaste = { effect: 'haste', target: targetName, source: 'Sorc1' };
      const otherTargetAnimal = { effect: 'animal_shapes', target: 'OldTarget', source: 'OldCaster' };
      mockState({ creatures: [creature], targetEffects: [sameTargetArrayTarget, sameTargetHaste, otherTargetAnimal] });

      await confirmAnimalShapesTransform({ targetName, beast, casterName, spell, campaignName });

      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
        sameTargetHaste,
        otherTargetAnimal,
        { target: targetName, source: casterName, effect: 'animal_shapes', duration: '24hours', beastName: 'Wolf' },
      ], campaignName, true);
    });

    it('first transform captures TRUE original and grants THP once', async () => {
      const fresh = makeCreature({ maxHp: 50, ac: 18, speed: { walk: 30 }, currentHp: 45 });
      mockState({ creatures: [fresh] });

      await confirmAnimalShapesTransform({ targetName, beast, casterName, spell, campaignName });

      expect(fresh.polymorphOriginal).toEqual({ maxHp: 50, ac: 18, speed: { walk: 30 } });
      expect(setRuntimeObject).toHaveBeenCalledWith(targetName, { tempHp: 13, animalShapesTempHp: 13 }, campaignName);
    });

    it('re-form keeps TRUE polymorphOriginal and does NOT re-grant THP', async () => {
      const fresh = makeCreature({ maxHp: 50, ac: 18, speed: { walk: 30 }, currentHp: 45 });
      mockState({ creatures: [fresh] });
      await confirmAnimalShapesTransform({ targetName, beast, casterName, spell, campaignName });
      expect(fresh.polymorphOriginal).toEqual({ maxHp: 50, ac: 18, speed: { walk: 30 } });
      expect(fresh.maxHp).toBe(13);

      setRuntimeObject.mockClear();
      const biggerBeast = { ...beast, index: 'polar-bear', name: 'Polar Bear', hit_points: 42, armor_class: 12 };
      await confirmAnimalShapesTransform({ targetName, beast: biggerBeast, casterName, spell, campaignName });

      expect(fresh.polymorphOriginal).toEqual({ maxHp: 50, ac: 18, speed: { walk: 30 } });
      expect(fresh.maxHp).toBe(42);
      expect(fresh.ac).toBe(12);
      const tempHpWrites = setRuntimeObject.mock.calls.filter(call => 'tempHp' in (call[1] || {}));
      expect(tempHpWrites).toHaveLength(0);
    });
  });

  describe('revertAnimalShapes', () => {
    it('restores original stats, clears beast fields, persists summary, returns true, logs full revert', () => {
      const creature = makeCreature({
        polymorphOriginal: { maxHp: 10, ac: 14, speed: { walk: 30 } },
        animalShapesSource: casterName,
        animalShapesBeast: { name: 'Wolf' },
        beastName: 'Wolf',
        maxHp: 13,
        ac: 11,
        speed: { walk: 40 },
      });
      mockState({ creatures: [creature] });

      const result = revertAnimalShapes(targetName, campaignName);

      expect(result).toBe(true);
      expect(creature.maxHp).toBe(10);
      expect(creature.ac).toBe(14);
      expect(creature.speed).toEqual({ walk: 30 });
      expect(creature.animalShapesSource).toBeUndefined();
      expect(creature.animalShapesBeast).toBeUndefined();
      expect(creature.beastName).toBeUndefined();
      expect(creature.polymorphOriginal).toBeUndefined();
      expect(storage.set).toHaveBeenCalledWith('combatSummary', { creatures: [creature] }, campaignName);
      expect(setCombatSummaryCache).toHaveBeenCalledWith({ creatures: [creature] }, campaignName);
      expect(setRuntimeObject).not.toHaveBeenCalled();
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: targetName,
        abilityName: 'Animal Shapes',
        description: `${targetName} reverts to their normal form.`,
      });
    });

    it('THP revert: grants remainder to other sources, clamps at zero, stays silent without a grant', () => {
      const creature = makeCreature({
        polymorphOriginal: { maxHp: 10, ac: 14, speed: { walk: 30 } },
        animalShapesSource: casterName,
        beastName: 'Wolf',
        maxHp: 13,
        ac: 11,
        speed: { walk: 40 },
      });
      mockState({ creatures: [creature], tempHp: 20, animalShapesTempHp: 13 });
      revertAnimalShapes(targetName, campaignName);
      expect(setRuntimeObject).toHaveBeenCalledWith(targetName, { tempHp: 7, animalShapesTempHp: 0 }, campaignName);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(targetName, 'tempHp', expect.anything(), campaignName);

      // stored below granted -> clamped at 0
      setRuntimeObject.mockClear();
      mockState({ creatures: [creature], tempHp: 5, animalShapesTempHp: 13 });
      revertAnimalShapes(targetName, campaignName);
      expect(setRuntimeObject).toHaveBeenCalledWith(targetName, { tempHp: 0, animalShapesTempHp: 0 }, campaignName);

      // no animal-shapes grant -> no THP write at all
      setRuntimeObject.mockClear();
      mockState({ creatures: [creature], tempHp: 5, animalShapesTempHp: 0 });
      revertAnimalShapes(targetName, campaignName);
      expect(setRuntimeObject).not.toHaveBeenCalled();
    });

    it('returns false and writes nothing when creature was never transformed', () => {
      mockState({ creatures: [makeCreature()] });

      const result = revertAnimalShapes(targetName, campaignName);

      expect(result).toBe(false);
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(setRuntimeObject).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('finds caster from targetEffect when creature lacks animalShapesSource and still removes the effect', () => {
      const creature = makeCreature({ maxHp: 13, ac: 11, speed: { walk: 40 } });
      const animalShapesTe = { effect: 'animal_shapes', target: targetName, source: casterName };
      const hasteTe = { effect: 'haste', target: targetName, source: 'Sorc1' };
      mockState({ creatures: [creature], targetEffects: [animalShapesTe, hasteTe] });

      const result = revertAnimalShapes(targetName, campaignName);

      expect(result).toBe(false); // creature never marked transformed — stats untouched
      expect(creature.maxHp).toBe(13);
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [hasteTe], campaignName, true);
    });

    it('pendingExpirations revert exact: drops same-target animal_shapes entry, preserves unrelated entries', () => {
      const creature = makeCreature({
        polymorphOriginal: { maxHp: 10, ac: 14, speed: { walk: 30 } },
        animalShapesSource: casterName,
        beastName: 'Wolf',
        maxHp: 13,
        ac: 11,
        speed: { walk: 40 },
      });
      const staleExp = { target: targetName, effects: [{ type: 'animal_shapes' }, { type: 'haste' }], appliedRound: 1, expiryRounds: 5, expireOnCreatureName: targetName };
      const sameTargetOtherExp = { target: targetName, effects: [{ type: 'bless' }], appliedRound: 1, expiryRounds: 2, expireOnCreatureName: targetName };
      const otherExp = { target: 'OtherTarget', effects: [{ type: 'polymorph' }], appliedRound: 1, expiryRounds: 3, expireOnCreatureName: 'OtherTarget' };
      mockState({ creatures: [creature], pendingExpirations: [staleExp, sameTargetOtherExp, otherExp] });

      revertAnimalShapes(targetName, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith(casterName, 'pendingExpirations', [sameTargetOtherExp, otherExp], campaignName);
    });

    it('does not write pendingExpirations when nothing matches (early-return guard)', () => {
      const creature = makeCreature({
        polymorphOriginal: { maxHp: 10, ac: 14, speed: { walk: 30 } },
        animalShapesSource: casterName,
        beastName: 'Wolf',
      });
      const sameTargetHasteExp = { target: targetName, effects: [{ type: 'haste' }], appliedRound: 1, expiryRounds: 5, expireOnCreatureName: targetName };
      const otherAnimalExp = { target: 'OtherTarget', effects: [{ type: 'animal_shapes' }], appliedRound: 1, expiryRounds: Infinity, expireOnCreatureName: 'OtherTarget' };
      mockState({ creatures: [creature], pendingExpirations: [sameTargetHasteExp, otherAnimalExp] });

      revertAnimalShapes(targetName, campaignName);

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('getActiveAnimalShapes', () => {
    it('should return only animal_shapes effects, exactly', () => {
      const mine = { effect: 'animal_shapes', target: targetName };
      const barbarian = { effect: 'animal_shapes', target: 'Barbarian' };
      getRuntimeValue.mockReturnValue([
        { effect: 'polymorph', target: 'Goblin' },
        mine,
        { effect: 'haste', target: 'Wizard' },
        barbarian,
      ]);

      expect(getActiveAnimalShapes(campaignName)).toEqual([mine, barbarian]);
    });
  });

  describe('getAnimalShapesCaster', () => {
    it('should return the source of the animal_shapes effect, normalising array targets', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'polymorph', target: targetName, source: 'OtherCaster' },
        { effect: 'animal_shapes', target: [targetName], source: casterName },
      ]);
      expect(getAnimalShapesCaster(targetName, campaignName)).toBe(casterName);
    });

    it('should return null when no animal_shapes effect targets creature', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'polymorph', target: targetName, source: 'OtherCaster' },
        { effect: 'animal_shapes', target: 'Other', source: casterName },
      ]);
      expect(getAnimalShapesCaster(targetName, campaignName)).toBeNull();
    });
  });
});
