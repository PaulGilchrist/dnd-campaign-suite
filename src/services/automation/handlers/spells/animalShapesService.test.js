// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';

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
import { getCombatSummary } from '../../../encounters/combatData.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';
import { applyAnimalShapes, revertAnimalShapes, getActiveAnimalShapes, getAnimalShapesCaster, confirmAnimalShapesTransform } from './animalShapesService.js';

const campaignName = 'TestCampaign';
const casterName = 'Druid1';
const targetName = 'Rogue1';

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

const creature = {
  name: targetName,
  type: 'player',
  maxHp: 10,
  ac: 14,
  speed: { walk: 30 },
  currentHp: 8,
};

function setupCombatContext(creatures = [creature]) {
  getCombatContext.mockResolvedValue({ creatures });
  getRuntimeValue.mockImplementation((key, subKey) => {
    if (key === 'campaign' && subKey === 'targetEffects') return [];
    if (key === casterName && subKey === 'pendingExpirations') return [];
    return undefined;
  });
  setRuntimeValue.mockClear();
  setRuntimeObject.mockClear();
  addEntry.mockClear();
  storage.set.mockClear();
}

describe('animalShapesService', () => {
  describe('applyAnimalShapes', () => {
    it('should return error when no targetBeastMap', async () => {
      const result = await applyAnimalShapes({
        targetBeastMap: null,
        casterName,
        spell: { name: 'Animal Shapes', level: 8 },
        campaignName,
      });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('no_targets');
    });

    it('should transform a target with the chosen beast', async () => {
      setupCombatContext();
      const result = await applyAnimalShapes({
        targetBeastMap: { [targetName]: beast },
        casterName,
        spell: { name: 'Animal Shapes', level: 8 },
        campaignName,
      });
      expect(result.ok).toBe(true);
      expect(setRuntimeObject).toHaveBeenCalledWith(targetName, { tempHp: 13, animalShapesTempHp: 13 }, campaignName);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(targetName, 'tempHp', expect.anything(), campaignName);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(targetName, 'animalShapesTempHp', expect.anything(), campaignName);
      expect(creature.maxHp).toBe(13);
      expect(creature.ac).toBe(11);
      expect(creature.speed).toEqual({ walk: 40 });
      expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
      expect(addEntry).toHaveBeenCalled();
    });

    it('should set animal_shapes targetEffect', async () => {
      setupCombatContext();
      await applyAnimalShapes({
        targetBeastMap: { [targetName]: beast },
        casterName,
        spell: { name: 'Animal Shapes', level: 8 },
        campaignName,
      });
      const calls = setRuntimeValue.mock.calls.filter(
        call => call[0] === 'campaign' && call[1] === 'targetEffects'
      );
      expect(calls.length).toBeGreaterThan(0);
      const effects = calls[calls.length - 1][2] ? calls[calls.length - 1] : calls[0];
      const effect = effects[2] || effects[1];
      expect(Array.isArray(effect)).toBe(true);
    });

    it('should add expiration with expireOnCreatureName set to target', async () => {
      setupCombatContext();
      await applyAnimalShapes({
        targetBeastMap: { [targetName]: beast },
        casterName,
        spell: { name: 'Animal Shapes', level: 8 },
        campaignName,
      });
      const expirationCalls = setRuntimeValue.mock.calls.filter(
        call => call[0] === casterName && call[1] === 'pendingExpirations'
      );
      expect(expirationCalls.length).toBeGreaterThan(0);
      const expList = expirationCalls[0][2];
      expect(Array.isArray(expList)).toBe(true);
      const expEntry = expList[0];
      expect(expEntry.target).toBe(targetName);
      expect(expEntry.expireOnCreatureName).toBe(targetName);
      expect(expEntry.expiryRounds).toBe(Infinity);
    });

    it('should skip targets not found in combat or missing beast', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'OtherTarget', type: 'player' }] });
      const result = await applyAnimalShapes({
        targetBeastMap: { [targetName]: beast, 'OtherTarget': null },
        casterName,
        spell: { name: 'Animal Shapes', level: 8 },
        campaignName,
      });
      expect(result.results).toHaveLength(0);
    });
  });

  describe('confirmAnimalShapesTransform', () => {
    it('should return error when creature not found in combat', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'OtherTarget', type: 'player' }] });
      const result = await confirmAnimalShapesTransform({
        targetName: targetName,
        beast: beast,
        casterName: casterName,
        spell: { name: 'Animal Shapes', level: 8 },
        campaignName,
      });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('no_target');
    });

    it('should handle existing animal_shapes effects during confirm transform', async () => {
      const existingEffect = { effect: 'animal_shapes', target: 'OldTarget', source: 'OldCaster' };
      getCombatContext.mockResolvedValue({ creatures: [creature] });
      getRuntimeValue.mockImplementation((key, subKey, _cn) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [existingEffect];
        if (key === casterName && subKey === 'pendingExpirations') return [];
        return undefined;
      });
      setRuntimeValue.mockClear();
      addEntry.mockClear();
      storage.set.mockClear();

      await applyAnimalShapes({
        targetBeastMap: { [targetName]: beast },
        casterName,
        spell: { name: 'Animal Shapes', level: 8 },
        campaignName,
      });

      const calls = setRuntimeValue.mock.calls.filter(
        call => call[0] === 'campaign' && call[1] === 'targetEffects'
      );
      expect(calls.length).toBeGreaterThan(0);
      const newEffects = calls[calls.length - 1][2];
      expect(newEffects).toHaveLength(2);
      expect(newEffects.find(e => e.target === targetName)).toBeDefined();
      expect(newEffects.find(e => e.target === 'OldTarget')).toBeDefined();
    });

    it('first transform captures TRUE original and grants THP once', async () => {
      const fresh = { name: targetName, type: 'player', maxHp: 50, ac: 18, speed: { walk: 30 }, currentHp: 45 };
      getCombatContext.mockResolvedValue({ creatures: [fresh] });
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        if (key === casterName && subKey === 'pendingExpirations') return [];
        return undefined;
      });
      setRuntimeObject.mockClear();

      await confirmAnimalShapesTransform({ targetName, beast, casterName, spell: { name: 'Animal Shapes', level: 8 }, campaignName });

      expect(fresh.polymorphOriginal).toEqual({ maxHp: 50, ac: 18, speed: { walk: 30 } });
      expect(setRuntimeObject).toHaveBeenCalledWith(targetName, { tempHp: 13, animalShapesTempHp: 13 }, campaignName);
    });

    it('re-form keeps TRUE polymorphOriginal and does NOT re-grant THP', async () => {
      const fresh = { name: targetName, type: 'player', maxHp: 50, ac: 18, speed: { walk: 30 }, currentHp: 45 };
      getCombatContext.mockResolvedValue({ creatures: [fresh] });
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        if (key === casterName && subKey === 'pendingExpirations') return [];
        return undefined;
      });
      await confirmAnimalShapesTransform({ targetName, beast, casterName, spell: { name: 'Animal Shapes', level: 8 }, campaignName });
      expect(fresh.polymorphOriginal).toEqual({ maxHp: 50, ac: 18, speed: { walk: 30 } });
      expect(fresh.maxHp).toBe(13);

      setRuntimeObject.mockClear();
      const biggerBeast = { ...beast, index: 'polar-bear', name: 'Polar Bear', hit_points: 42, armor_class: 12 };
      await confirmAnimalShapesTransform({ targetName, beast: biggerBeast, casterName, spell: { name: 'Animal Shapes', level: 8 }, campaignName });

      expect(fresh.polymorphOriginal).toEqual({ maxHp: 50, ac: 18, speed: { walk: 30 } });
      expect(fresh.maxHp).toBe(42);
      expect(fresh.ac).toBe(12);
      const tempHpWrites = setRuntimeObject.mock.calls.filter(call => 'tempHp' in (call[1] || {}));
      expect(tempHpWrites).toHaveLength(0);
    });

    it('should handle existing pendingExpirations during confirm transform', async () => {
      const existingExp = {
        target: 'OldTarget',
        effects: [{ type: 'animal_shapes' }],
        appliedRound: 1,
        expiryRounds: Infinity,
        expireOnCreatureName: 'OldTarget',
      };
      getCombatContext.mockResolvedValue({ creatures: [creature] });
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        if (key === casterName && subKey === 'pendingExpirations') return [existingExp];
        return undefined;
      });
      setRuntimeValue.mockClear();
      addEntry.mockClear();
      storage.set.mockClear();

      await applyAnimalShapes({
        targetBeastMap: { [targetName]: beast },
        casterName,
        spell: { name: 'Animal Shapes', level: 8 },
        campaignName,
      });

      const expCalls = setRuntimeValue.mock.calls.filter(
        call => call[0] === casterName && call[1] === 'pendingExpirations'
      );
      expect(expCalls.length).toBeGreaterThan(0);
      const expList = expCalls[0][2];
      expect(expList).toHaveLength(2);
      const oldExp = expList.find(e => e.target === 'OldTarget');
      expect(oldExp).toBeDefined();
      const newExp = expList.find(e => e.target === targetName);
      expect(newExp).toBeDefined();
      expect(newExp.expireOnCreatureName).toBe(targetName);
    });

    it('should filter existing expirations matching target and effect type', async () => {
      const matchingExp = {
        target: targetName,
        effects: [{ type: 'animal_shapes' }, { type: 'haste' }],
        appliedRound: 1,
        expiryRounds: 5,
        expireOnCreatureName: targetName,
      };
      getCombatContext.mockResolvedValue({ creatures: [creature] });
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        if (key === casterName && subKey === 'pendingExpirations') return [matchingExp];
        return undefined;
      });
      setRuntimeValue.mockClear();
      addEntry.mockClear();
      storage.set.mockClear();

      await applyAnimalShapes({
        targetBeastMap: { [targetName]: beast },
        casterName,
        spell: { name: 'Animal Shapes', level: 8 },
        campaignName,
      });

      const expCalls = setRuntimeValue.mock.calls.filter(
        call => call[0] === casterName && call[1] === 'pendingExpirations'
      );
      expect(expCalls.length).toBeGreaterThan(0);
      const expList = expCalls[0][2];
      expect(expList).toHaveLength(1);
      expect(expList[0].target).toBe(targetName);
    });
  });

  describe('revertAnimalShapes', () => {
    it('should restore original stats', () => {
      const cs = {
        creatures: [{
          ...creature,
          polymorphOriginal: { maxHp: 10, ac: 14, speed: { walk: 30 } },
          animalShapesSource: casterName,
          animalShapesBeast: beast,
          beastName: 'Wolf',
          maxHp: 13,
          ac: 11,
          speed: { walk: 40 },
        }],
      };
      getCombatSummary.mockReturnValue(cs);
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [{ effect: 'animal_shapes', target: targetName }];
        if (key === casterName && subKey === 'pendingExpirations') return [];
        if (key === targetName && subKey === 'animalShapesTempHp') return 13;
        if (key === targetName && subKey === 'tempHp') return 5;
        return undefined;
      });

      revertAnimalShapes(targetName, campaignName);

      expect(cs.creatures[0].maxHp).toBe(10);
      expect(cs.creatures[0].ac).toBe(14);
      expect(cs.creatures[0].speed).toEqual({ walk: 30 });
      expect(cs.creatures[0].animalShapesSource).toBeUndefined();
      expect(cs.creatures[0].animalShapesBeast).toBeUndefined();
      expect(cs.creatures[0].beastName).toBeUndefined();
    });

    it('should calculate remaining temp HP correctly', () => {
      const cs = {
        creatures: [{
          ...creature,
          polymorphOriginal: { maxHp: 10, ac: 14, speed: { walk: 30 } },
          animalShapesSource: casterName,
          beastName: 'Wolf',
          maxHp: 10,
          ac: 14,
          speed: { walk: 30 },
        }],
      };
      getCombatSummary.mockReturnValue(cs);
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        if (key === casterName && subKey === 'pendingExpirations') return [];
        if (key === targetName && subKey === 'animalShapesTempHp') return 13;
        if (key === targetName && subKey === 'tempHp') return 5;
        return undefined;
      });

      revertAnimalShapes(targetName, campaignName);

      expect(setRuntimeObject).toHaveBeenCalledWith(targetName, { tempHp: 0, animalShapesTempHp: 0 }, campaignName);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(targetName, 'tempHp', expect.anything(), campaignName);
      expect(cs.creatures[0].polymorphOriginal).toBeUndefined();
    });

    it('reverts THP fully when animalShapesTempHp persists at granted value', () => {
      const cs = {
        creatures: [{
          ...creature,
          polymorphOriginal: { maxHp: 10, ac: 14, speed: { walk: 30 } },
          animalShapesSource: casterName,
          beastName: 'Wolf',
          maxHp: 13,
          ac: 11,
          speed: { walk: 40 },
        }],
      };
      getCombatSummary.mockReturnValue(cs);
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        if (key === casterName && subKey === 'pendingExpirations') return [];
        if (key === targetName && subKey === 'animalShapesTempHp') return 13;
        if (key === targetName && subKey === 'tempHp') return 13;
        return undefined;
      });
      setRuntimeObject.mockClear();

      revertAnimalShapes(targetName, campaignName);

      expect(setRuntimeObject).toHaveBeenCalledWith(targetName, { tempHp: 0, animalShapesTempHp: 0 }, campaignName);
    });

    it('should return true when changes were made', () => {
      const cs = {
        creatures: [{
          ...creature,
          animalShapesSource: casterName,
          polymorphOriginal: { maxHp: 10 },
          beastName: 'Wolf',
        }],
      };
      getCombatSummary.mockReturnValue(cs);
      getRuntimeValue.mockImplementation(() => undefined);

      const result = revertAnimalShapes(targetName, campaignName);
      expect(result).toBe(true);
    });

    it('should return false when no animal_shapes effect found', () => {
      const freshCreature = { name: targetName, type: 'player', maxHp: 10, ac: 14, speed: { walk: 30 } };
      const cs = { creatures: [freshCreature] };
      getCombatSummary.mockReturnValue(cs);
      getRuntimeValue.mockImplementation(() => undefined);

      const result = revertAnimalShapes(targetName, campaignName);
      expect(result).toBe(false);
    });

    it('should find caster from effect when creature lacks animalShapesSource', () => {
      const cs = {
        creatures: [{
          ...creature,
          maxHp: 13,
          ac: 11,
          speed: { walk: 40 },
        }],
      };
      getCombatSummary.mockReturnValue(cs);
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [{ effect: 'animal_shapes', target: targetName, source: casterName }];
        if (key === casterName && subKey === 'pendingExpirations') return [];
        return undefined;
      });
      setRuntimeValue.mockClear();
      addEntry.mockClear();
      storage.set.mockClear();

      revertAnimalShapes(targetName, campaignName);

      const targetEffectCalls = setRuntimeValue.mock.calls.filter(
        call => call[0] === 'campaign' && call[1] === 'targetEffects'
      );
      expect(targetEffectCalls.length).toBeGreaterThan(0);
      expect(targetEffectCalls[0][2]).toHaveLength(0);
    });

    it('should call pendingExpirations setRuntimeValue when filtering removes matching expirations', () => {
      const existingExp = {
        target: targetName,
        effects: [{ type: 'animal_shapes' }],
        appliedRound: 1,
        expiryRounds: Infinity,
        expireOnCreatureName: targetName,
      };
      const cs = {
        creatures: [{
          ...creature,
          animalShapesSource: casterName,
          polymorphOriginal: { maxHp: 10, ac: 14, speed: { walk: 30 } },
          beastName: 'Wolf',
          maxHp: 13,
          ac: 11,
          speed: { walk: 40 },
        }],
      };
      getCombatSummary.mockReturnValue(cs);
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        if (key === casterName && subKey === 'pendingExpirations') return [existingExp];
        return undefined;
      });
      setRuntimeValue.mockClear();
      addEntry.mockClear();
      storage.set.mockClear();

      revertAnimalShapes(targetName, campaignName);

      const expCalls = setRuntimeValue.mock.calls.filter(
        call => call[0] === casterName && call[1] === 'pendingExpirations'
      );
      expect(expCalls.length).toBeGreaterThan(0);
      expect(expCalls[0][2]).toHaveLength(0);
    });

    it('should filter pendingExpirations with matching effect types', () => {
      const existingExp = {
        target: targetName,
        effects: [{ type: 'animal_shapes' }, { type: 'haste' }],
        appliedRound: 1,
        expiryRounds: 5,
        expireOnCreatureName: targetName,
      };
      const otherExp = {
        target: 'OtherTarget',
        effects: [{ type: 'polymorph' }],
        appliedRound: 1,
        expiryRounds: 3,
        expireOnCreatureName: 'OtherTarget',
      };
      const cs = {
        creatures: [{
          ...creature,
          animalShapesSource: casterName,
          polymorphOriginal: { maxHp: 10, ac: 14, speed: { walk: 30 } },
          beastName: 'Wolf',
          maxHp: 13,
          ac: 11,
          speed: { walk: 40 },
        }],
      };
      getCombatSummary.mockReturnValue(cs);
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        if (key === casterName && subKey === 'pendingExpirations') return [existingExp, otherExp];
        return undefined;
      });
      setRuntimeValue.mockClear();
      addEntry.mockClear();
      storage.set.mockClear();

      revertAnimalShapes(targetName, campaignName);

      const expCalls = setRuntimeValue.mock.calls.filter(
        call => call[0] === casterName && call[1] === 'pendingExpirations'
      );
      expect(expCalls.length).toBeGreaterThan(0);
      const filtered = expCalls[0][2];
      expect(filtered).toHaveLength(1);
      expect(filtered[0].target).toBe('OtherTarget');
    });

    it('should filter existing pendingExpirations when reverting', () => {
      const existingExp = {
        target: targetName,
        effects: [{ type: 'animal_shapes' }],
        appliedRound: 1,
        expiryRounds: Infinity,
        expireOnCreatureName: targetName,
      };
      const cs = {
        creatures: [{
          ...creature,
          animalShapesSource: casterName,
          polymorphOriginal: { maxHp: 10, ac: 14, speed: { walk: 30 } },
          beastName: 'Wolf',
          maxHp: 13,
          ac: 11,
          speed: { walk: 40 },
        }],
      };
      getCombatSummary.mockReturnValue(cs);
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        if (key === casterName && subKey === 'pendingExpirations') return [existingExp];
        return undefined;
      });
      setRuntimeValue.mockClear();
      addEntry.mockClear();
      storage.set.mockClear();

      revertAnimalShapes(targetName, campaignName);

      const expCalls = setRuntimeValue.mock.calls.filter(
        call => call[0] === casterName && call[1] === 'pendingExpirations'
      );
      expect(expCalls.length).toBeGreaterThan(0);
      const filtered = expCalls[0][2];
      expect(filtered).toHaveLength(0);
    });
  });

  describe('getActiveAnimalShapes', () => {
    it('should return only animal_shapes effects', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'polymorph', target: 'Goblin' },
        { effect: 'animal_shapes', target: targetName },
        { effect: 'haste', target: 'Wizard' },
        { effect: 'animal_shapes', target: 'Barbarian' },
      ]);

      const result = getActiveAnimalShapes(campaignName);
      expect(result).toHaveLength(2);
      expect(result.every(te => te.effect === 'animal_shapes')).toBe(true);
    });
  });

  describe('getAnimalShapesCaster', () => {
    it('should return the source of the animal_shapes effect', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'animal_shapes', target: targetName, source: casterName },
      ]);

      const result = getAnimalShapesCaster(targetName, campaignName);
      expect(result).toBe(casterName);
    });

    it('should return null when no animal_shapes effect found', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'polymorph', target: targetName, source: 'OtherCaster' },
      ]);

      const result = getAnimalShapesCaster(targetName, campaignName);
      expect(result).toBeNull();
    });
  });
});
