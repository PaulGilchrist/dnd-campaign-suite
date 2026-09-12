// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

import { applyMultiTarget } from './multiTargetHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { rangeToFeet, getDistanceFeet } from '../../../rules/combat/rangeValidation.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { endInvisibilityOnHostileAction } from '../../../rules/features/invisibilityService.js';

import { campaignName, mapName, makePlayerStats, makeAction, makeCombatSummary, makeDamageSpell, makeHealSpell } from './multiTargetHandler.test-utils.js';

describe('multiTargetHandler.applyMultiTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockReturnValue(Promise.resolve());
    isWithinRange.mockResolvedValue(true);
    getCombatSummary.mockImplementation((_name) => {
      return { creatures: [], players: [], placedItems: [] };
    });
  });

  describe('early returns', () => {
    it('should return null when secondTargetName is empty string', async () => {
      const result = await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: '',
          spell: null,
          metaCtx: null,
      });
      expect(result).toBeNull();
    });

    it('should return null when secondTargetName is null', async () => {
      const result = await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: null,
          spell: null,
          metaCtx: null,
      });
      expect(result).toBeNull();
    });

    it('should return null when no combat context exists', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell: null,
          metaCtx: null,
      });
      expect(result).toBeNull();
    });

    it('should return null when first target not found in combat summary', async () => {
      getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Orc' }]));
      const result = await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell: null,
          metaCtx: null,
      });
      expect(result).toBeNull();
    });

    it('should return null when second target not found in combat summary', async () => {
      getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin' }]));
      const result = await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell: null,
          metaCtx: null,
      });
      expect(result).toBeNull();
    });
  });

  describe('range validation', () => {
    function makeBaseCombatSummary() {
      return makeCombatSummary(
        [
          { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
          { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
        ],
        [{ name: 'TestHero', gridX: 1, gridY: 1 }]
      );
    }

    it('should return out-of-range popup when first target is out of range', async () => {
      getCombatContext.mockResolvedValue(makeBaseCombatSummary());
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 1 } });
      getDistanceFeet.mockReturnValue(50);
      isWithinRange.mockResolvedValue(false);

      const result = await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell: null,
          metaCtx: null,
      });

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('out of range');
    });

    it('should return out-of-range popup when second target is out of range', async () => {
      getCombatContext.mockResolvedValue(makeBaseCombatSummary());
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 1 } });
      getDistanceFeet.mockReturnValueOnce(10).mockReturnValueOnce(50);
      isWithinRange.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      const result = await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell: null,
          metaCtx: null,
      });

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('out of range');
    });

    it('should skip range check when mapName is null', async () => {
      getCombatContext.mockResolvedValue(makeBaseCombatSummary());
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue(null);

      const result = await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: null,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell: null,
          metaCtx: null,
      });

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should skip range check when attackerPos is null', async () => {
      getCombatContext.mockResolvedValue(makeBaseCombatSummary());
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue({ attackerPos: null });

      const result = await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell: null,
          metaCtx: null,
      });

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should not check range when rangeFt is null', async () => {
      getCombatContext.mockResolvedValue(makeBaseCombatSummary());
      rangeToFeet.mockReturnValue(null);
      resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 1 } });

      const result = await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell: null,
          metaCtx: null,
      });

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });
  });

  describe('damage application', () => {
    it('should apply damage to second target when spell has damage and rawDamage > 0', async () => {
      const spell = makeDamageSpell('Cone of Cold', 'cold');
      const metaCtx = { totalDamage: 20 };
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      applyDamageToTarget.mockReturnValue({ newHp: 5, finalDamage: 10 });

      const result = await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(applyDamageToTarget).toHaveBeenCalledWith(cs, 'Orc', 20, ['cold'], campaignName, null, { ignoreResistance: false, attackerName: 'TestHero' });
      expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestHero', campaignName);
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        targetName: 'Orc',
        delta: -10,
        currentHp: 5,
        maxHp: 22,
        isHealing: false,
        sourceName: 'TestHero',
        note: 'Cone of Cold (multi-target spread)',
      });
      expect(result.payload.description).toContain('Orc');
    });

    it('should skip damage application when rawDamage is 0', async () => {
      const spell = makeDamageSpell('Cone of Cold', 'cold');
      const metaCtx = { totalDamage: 0 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));

      await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
    });

    it('should skip damage application when spell has no damage property', async () => {
      const spell = { name: 'Some Spell' };
      const metaCtx = { totalDamage: 20 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));

      await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('should use action.payload.spellName when spell.name is missing', async () => {
      const action = {
        name: 'Word of Creation',
        automation: { range: '30 ft' },
        payload: { spellName: 'Misty Step' },
      };
      const spell = { damage: { damage_type: 'fire' }, name: undefined };
      const metaCtx = { totalDamage: 10 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 5, finalDamage: 10 });

      const result = await applyMultiTarget({
          action,
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(result.payload.description).toContain('Misty Step');
    });

    it('should use rawDamage from metaCtx when totalDamage is missing', async () => {
      const spell = makeDamageSpell('Fireball', 'fire');
      const metaCtx = { rawDamage: 15 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 5, finalDamage: 10 });

      await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Orc', 15, ['fire'], campaignName, null, { ignoreResistance: false, attackerName: 'TestHero' });
    });

    it('should not apply damage when applyDamageToTarget returns null', async () => {
      const spell = makeDamageSpell('Fireball', 'fire');
      const metaCtx = { totalDamage: 10 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue(null);

      await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Word of Creation',
        description: expect.stringContaining('Orc'),
      }));
    });

    it('should not call endInvisibility when finalDamage is 0', async () => {
      const spell = makeDamageSpell('Fireball', 'fire');
      const metaCtx = { totalDamage: 10 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 15, finalDamage: 0 });

      await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
    });

    it('should use empty string for damageType when spell.damage exists but damage_type is missing', async () => {
      const spell = { damage: {} };
      const metaCtx = { totalDamage: 10 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 15, finalDamage: 5 });

      await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Orc', 10, [''], campaignName, null, { ignoreResistance: false, attackerName: 'TestHero' });
    });
  });

  describe('power word heal application', () => {
    it('should apply healing when spellName is "power word heal"', async () => {
      const spell = makeHealSpell({ maxHp: 30 });
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 7 });

      await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Orc', 7, campaignName);
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        targetName: 'Orc',
        delta: 7,
        currentHp: 22,
        maxHp: 22,
        isHealing: true,
        sourceName: 'TestHero',
        note: 'Power Word Heal (multi-target spread)',
      });
    });

    it('should use getRuntimeValue for current HP when target.currentHp is missing', async () => {
      const spell = makeHealSpell();
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      getRuntimeValue.mockReturnValue(10);
      applyHealingToTarget.mockReturnValue({ newHp: 18, actualHeal: 8 });

      await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(getRuntimeValue).toHaveBeenCalledWith('Orc', 'currentHitPoints', campaignName);
    });

    it('should use maxHp from playerStats when target has no maxHp and runtimeValue is null', async () => {
      const spell = makeHealSpell();
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 10 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      getRuntimeValue.mockReturnValue(null);
      applyHealingToTarget.mockReturnValue({ newHp: 25, actualHeal: 15 });

      await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats({ hitPoints: 25 }),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Orc', 15, campaignName);
    });

    it('should skip healing when healAmount is 0 (target already full HP)', async () => {
      const spell = makeHealSpell();
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 22, maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      getRuntimeValue.mockReturnValue(22);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 0 });

      await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(applyHealingToTarget).not.toHaveBeenCalled();
    });

    it('should skip healing when applyHealingToTarget returns null', async () => {
      const spell = makeHealSpell();
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 10, maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      getRuntimeValue.mockReturnValue(10);
      applyHealingToTarget.mockReturnValue(null);

      await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Word of Creation',
        description: expect.stringContaining('Orc'),
      }));
    });

    it('should remove conditions when spell has status_effects', async () => {
      const spell = makeHealSpell({ status_effects: ['poisoned', 'blinded'] });
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 10, maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 12 });
      getRuntimeValue.mockImplementation((targetName, key, _camp) => {
        if (key === 'activeConditions') return ['poisoned', 'blinded', 'frightened'];
        return null;
      });

      await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Orc', 'activeConditions', ['frightened'], campaignName
      );
    });

    it('should log condition removals', async () => {
      const spell = makeHealSpell({ status_effects: ['poisoned'] });
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 10, maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 12 });
      getRuntimeValue.mockImplementation((targetName, key, _camp) => {
        if (key === 'activeConditions') return ['poisoned', 'frightened'];
        return null;
      });

      await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: 'Orc',
        condition: 'Poisoned',
        reason: 'Power Word Heal (multi-target spread)',
        timestamp: expect.any(Number),
      });
    });

    it('should not set powerWordHealStandPermission when target has no prone condition', async () => {
      const spell = makeHealSpell({ status_effects: ['poisoned'] });
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 10, maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 12 });
      getRuntimeValue.mockImplementation((targetName, key, _camp) => {
        if (key === 'activeConditions') return ['blinded', 'frightened'];
        return null;
      });

      await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      const setCalls = setRuntimeValue.mock.calls.filter(
        call => call[1] === 'powerWordHealStandPermission'
      );
      expect(setCalls).toHaveLength(0);
    });

    it('should handle status_effects with case-insensitive condition matching', async () => {
      const spell = makeHealSpell({ status_effects: ['Poisoned'] });
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 10, maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 12 });
      getRuntimeValue.mockImplementation((targetName, key, _camp) => {
        if (key === 'activeConditions') return ['poisoned', 'frightened'];
        return null;
      });

      await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Orc', 'activeConditions', ['frightened'], campaignName
      );
    });
  });

  describe('ability log entry', () => {
    it('should call addEntry with correct ability_use log', async () => {
      const spell = makeDamageSpell('Cone of Cold', 'cold');
      const metaCtx = { totalDamage: 10 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 5, finalDamage: 10 });

      await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Word of Creation',
        description: expect.stringContaining('Cone of Cold'),
        targetName: 'Orc',
        timestamp: expect.any(Number),
      });
    });

    it('should include spell name from payload when spell.name is missing', async () => {
      const action = {
        name: 'Word of Creation',
        automation: { range: '30 ft' },
        payload: { spellName: 'Misty Step' },
      };
      const spell = { damage: { damage_type: 'force' }, name: undefined };
      const metaCtx = { totalDamage: 5 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 15, finalDamage: 5 });

      await applyMultiTarget({
          action,
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: expect.stringContaining('Misty Step'),
      }));
    });
  });

  describe('success popup', () => {
    it('should return automation_info popup on successful application', async () => {
      const spell = makeDamageSpell('Cone of Cold', 'cold');
      const metaCtx = { totalDamage: 10 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 5, finalDamage: 5 });

      const result = await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Word of Creation');
      expect(result.payload.description).toContain('Cone of Cold');
      expect(result.payload.description).toContain('Orc');
    });

    it('should include range in success description', async () => {
      const spell = makeDamageSpell('Cone of Cold', 'cold');
      const metaCtx = { totalDamage: 10 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 5, finalDamage: 5 });

      const result = await applyMultiTarget({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(result.payload.description).toContain('30 ft');
    });

    it('should use default range in description when automation.range is missing', async () => {
      const action = {
        name: 'Word of Creation',
        automation: {},
        payload: { targetName: 'Goblin' },
      };
      const spell = makeDamageSpell('Cone of Cold', 'cold');
      const metaCtx = { totalDamage: 10 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 5, finalDamage: 5 });

      const result = await applyMultiTarget({
          action,
          playerStats: makePlayerStats(),
          campaignName,
          _mapName: mapName,
          firstTargetName: 'Goblin',
          secondTargetName: 'Orc',
          spell,
          metaCtx,
      });

      expect(result.payload.description).toContain('10 ft');
    });
  });
});
