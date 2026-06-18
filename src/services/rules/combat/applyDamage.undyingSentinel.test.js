import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
    processTashasLaughterRepeatSave: vi.fn(),
    handle: vi.fn(),
}));

vi.mock('./rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(() => 30),
}));

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

global.fetch = vi.fn(() => new Promise(() => {}));

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createPlayerCreature(name, extra = {}) {
  return {
    name,
    type: 'player',
    maxHp: 30,
    currentHp: 30,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
       ...extra,
       };
}

function createPlayerCharacterWithComputed(name, computedExtra = {}) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      level: computedExtra.level || 1,
      hitPoints: computedExtra.hitPoints || { max: 10 },
      class: computedExtra.class || { name: 'Fighter', class_levels: [{ level: 1 }] },
      allFeatures: computedExtra.allFeatures || [],
      equipment: [],
      ...computedExtra,
    },
    ...computedExtra,
  };
}

function createMinimalCharacter(name) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
    },
  };
}

describe('applyDamageToTarget — Undying Sentinel', () => {
    function createPaladinWithUndyingSentinel(name, level) {
      return createPlayerCreature(name, {
        level: level || 15,
        computedStats: {
          name: name,
          level: level || 15,
          hitPoints: { max: 150 },
          class: {
            name: 'Paladin',
            class_levels: [{ level: level || 15 }],
          },
          allFeatures: [
            { name: 'Undying Sentinel' },
            { name: 'Other Feature' },
          ],
          equipment: [],
        },
      });
    }

    beforeEach(() => {
       getRuntimeValue.mockClear();
       getRuntimeValue.mockImplementation((charName, key) => {
         if (key === 'activeConditions') return [];
         if (key === 'activeBuffs') return [];
         if (key === 'arcaneWardActive') return undefined;
         return undefined;
       });
       setRuntimeValue.mockClear();
     });

    it('triggers Undying Sentinel when player drops to 0 HP', () => {
      const paladin = createPaladinWithUndyingSentinel('GloryPaladin', 15);
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation((charName, key) => {
        if (charName === 'GloryPaladin' && key === 'currentHitPoints') return 10;
        if (charName === 'GloryPaladin' && key === 'hitPoints') return 150;
        if (key === 'activeConditions') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'arcaneWardActive') return undefined;
        return undefined;
      });

      const result = applyDamageToTarget(cs, 'GloryPaladin', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('GloryPaladin', {
        level: 15,
        hitPoints: { max: 150 },
        class: { name: 'Paladin', class_levels: [{ level: 15 }] },
        allFeatures: [{ name: 'Undying Sentinel' }, { name: 'Other Feature' }],
      })]);

      expect(result.newHp).toBe(46);
      expect(result.finalDamage).toBe(0);
      expect(result.intercepted).toBe(true);
    });

    it('does not trigger if feature not present', () => {
      const fighter = createPlayerCreature('Fighter', {
        level: 15,
        computedStats: {
          name: 'Fighter',
          level: 15,
          hitPoints: { max: 120 },
          class: { name: 'Fighter', class_levels: [{ level: 15 }] },
          allFeatures: [{ name: 'Extra Attack' }],
        },
      });
      const cs = makeCombatSummary([fighter]);

      getRuntimeValue.mockImplementation((charName, key) => {
        if (charName === 'Fighter' && key === 'currentHitPoints') return 5;
        if (charName === 'Fighter' && key === 'hitPoints') return 120;
        if (key === 'activeConditions') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'arcaneWardActive') return undefined;
        return undefined;
      });

      const result = applyDamageToTarget(cs, 'Fighter', 5, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('Fighter', {
        level: 15,
        hitPoints: { max: 120 },
        class: { name: 'Fighter', class_levels: [{ level: 15 }] },
        allFeatures: [{ name: 'Extra Attack' }],
      })]);

      expect(result.finalDamage).toBe(5);
      expect(result.newHp).toBe(0);
    });

    it('does not trigger if already used this long rest', () => {
      const paladin = createPaladinWithUndyingSentinel('GloryPaladin', 15);
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation((charName, key, _campaignName) => {
        if (charName === 'GloryPaladin' && key === 'currentHitPoints') return 10;
        if (charName === 'GloryPaladin' && key === 'hitPoints') return 150;
        if (charName === 'GloryPaladin' && key === 'undyingSentinelUsed') return true;
        if (key === 'activeConditions') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'arcaneWardActive') return undefined;
        return undefined;
      });

      const result = applyDamageToTarget(cs, 'GloryPaladin', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('GloryPaladin', {
        level: 15,
        hitPoints: { max: 150 },
        class: { name: 'Paladin', class_levels: [{ level: 15 }] },
        allFeatures: [{ name: 'Undying Sentinel' }, { name: 'Other Feature' }],
      })]);

      expect(result.finalDamage).toBe(10);
      expect(result.newHp).toBe(0);
    });

    it('scales healing with paladin level', () => {
      const paladin = createPaladinWithUndyingSentinel('GloryPaladin', 20);
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation((charName, key) => {
        if (charName === 'GloryPaladin' && key === 'currentHitPoints') return 5;
        if (charName === 'GloryPaladin' && key === 'hitPoints') return 200;
        if (key === 'activeConditions') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'arcaneWardActive') return undefined;
        return undefined;
      });

      const result = applyDamageToTarget(cs, 'GloryPaladin', 5, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('GloryPaladin', {
        level: 20,
        hitPoints: { max: 200 },
        class: { name: 'Paladin', class_levels: [{ level: 20 }] },
        allFeatures: [{ name: 'Undying Sentinel' }, { name: 'Other Feature' }],
      })]);

      expect(result.newHp).toBe(61);
      expect(result.finalDamage).toBe(0);
    });

    it('resets death saves when triggering', () => {
      const paladin = createPaladinWithUndyingSentinel('GloryPaladin', 15);
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation((charName, key) => {
        if (charName === 'GloryPaladin' && key === 'currentHitPoints') return 10;
        if (charName === 'GloryPaladin' && key === 'hitPoints') return 150;
        if (key === 'activeConditions') return [];
        return undefined;
      });

      applyDamageToTarget(cs, 'GloryPaladin', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('GloryPaladin', {
        level: 15,
        hitPoints: { max: 150 },
        class: { name: 'Paladin', class_levels: [{ level: 15 }] },
        allFeatures: [{ name: 'Undying Sentinel' }, { name: 'Other Feature' }],
      })]);

      expect(setRuntimeValue).toHaveBeenCalledWith('GloryPaladin', 'deathSaves', [false, false, false], 'TestCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('GloryPaladin', 'deathFailures', [false, false, false], 'TestCampaign');
    });

    it('marks feature as used', () => {
      const paladin = createPaladinWithUndyingSentinel('GloryPaladin', 15);
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation((charName, key) => {
        if (charName === 'GloryPaladin' && key === 'currentHitPoints') return 10;
        if (charName === 'GloryPaladin' && key === 'hitPoints') return 150;
        if (key === 'activeConditions') return [];
        return undefined;
      });

      applyDamageToTarget(cs, 'GloryPaladin', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('GloryPaladin', {
        level: 15,
        hitPoints: { max: 150 },
        class: { name: 'Paladin', class_levels: [{ level: 15 }] },
        allFeatures: [{ name: 'Undying Sentinel' }, { name: 'Other Feature' }],
      })]);

      expect(setRuntimeValue).toHaveBeenCalledWith('GloryPaladin', 'undyingSentinelUsed', true, 'TestCampaign');
    });

    describe('Relentless Endurance (Orc race trait)', () => {
      it('triggers when orc is reduced to 0 HP and sets HP to 1', () => {
        const orc = createPlayerCreature('OrcPlayer');
        const cs = makeCombatSummary([orc]);

      getRuntimeValue.mockImplementation((charName, key) => {
        if (charName === 'OrcPlayer' && key === 'currentHitPoints') return 10;
        if (charName === 'OrcPlayer' && key === 'hitPoints') return 100;
        if (key === 'activeConditions') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'arcaneWardActive') return undefined;
        return undefined;
      });

        const result = applyDamageToTarget(cs, 'OrcPlayer', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('OrcPlayer', {
          level: 1,
          hitPoints: { max: 100 },
          allFeatures: [{ name: 'Relentless Endurance' }, { name: 'Darkvision' }],
        })]);

        expect(result.intercepted).toBe(true);
        expect(result.finalDamage).toBe(0);
        expect(result.newHp).toBe(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('OrcPlayer', 'currentHitPoints', 1, 'TestCampaign');
      });

      it('does not trigger if already used this long rest', () => {
        const orc = createPlayerCreature('OrcPlayer2');
        const cs = makeCombatSummary([orc]);

        getRuntimeValue.mockImplementation((charName, key) => {
          if (charName === 'OrcPlayer2' && key === 'currentHitPoints') return 10;
          if (charName === 'OrcPlayer2' && key === 'hitPoints') return 100;
          if (charName === 'OrcPlayer2' && key === 'relentlessEnduranceUsed') return true;
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [];
          if (key === 'arcaneWardActive') return undefined;
          return undefined;
        });

        const result = applyDamageToTarget(cs, 'OrcPlayer2', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('OrcPlayer2', {
          level: 1,
          hitPoints: { max: 100 },
          allFeatures: [{ name: 'Relentless Endurance' }],
        })]);

        expect(result.finalDamage).toBe(10);
        expect(result.newHp).toBe(0);
      });

      it('does not trigger if orc does not have the trait', () => {
        const elf = createPlayerCreature('ElfPlayer');
        const cs = makeCombatSummary([elf]);

        getRuntimeValue.mockImplementation((charName, key) => {
          if (charName === 'ElfPlayer' && key === 'currentHitPoints') return 10;
          if (charName === 'ElfPlayer' && key === 'hitPoints') return 80;
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [];
          if (key === 'arcaneWardActive') return undefined;
          return undefined;
        });

        const result = applyDamageToTarget(cs, 'ElfPlayer', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('ElfPlayer', {
          level: 1,
          hitPoints: { max: 80 },
          allFeatures: [{ name: 'Darkvision' }, { name: 'Fey Ancestry' }],
        })]);

        expect(result.finalDamage).toBe(10);
        expect(result.newHp).toBe(0);
      });

      it('resets death saves when triggering', () => {
        const orc = createPlayerCreature('OrcPlayer3');
        const cs = makeCombatSummary([orc]);

        getRuntimeValue.mockImplementation((charName, key) => {
          if (charName === 'OrcPlayer3' && key === 'currentHitPoints') return 10;
          if (charName === 'OrcPlayer3' && key === 'hitPoints') return 100;
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [];
          if (key === 'arcaneWardActive') return undefined;
          return undefined;
        });

        applyDamageToTarget(cs, 'OrcPlayer3', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('OrcPlayer3', {
          level: 1,
          hitPoints: { max: 100 },
          allFeatures: [{ name: 'Relentless Endurance' }],
        })]);

        expect(setRuntimeValue).toHaveBeenCalledWith('OrcPlayer3', 'deathSaves', [false, false, false], 'TestCampaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('OrcPlayer3', 'deathFailures', [false, false, false], 'TestCampaign');
      });

      it('marks feature as used', () => {
        const orc = createPlayerCreature('OrcPlayer4');
        const cs = makeCombatSummary([orc]);

        getRuntimeValue.mockImplementation((charName, key) => {
          if (charName === 'OrcPlayer4' && key === 'currentHitPoints') return 10;
          if (charName === 'OrcPlayer4' && key === 'hitPoints') return 100;
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [];
          if (key === 'arcaneWardActive') return undefined;
          return undefined;
        });

        applyDamageToTarget(cs, 'OrcPlayer4', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('OrcPlayer4', {
          level: 1,
          hitPoints: { max: 100 },
          allFeatures: [{ name: 'Relentless Endurance' }],
        })]);

        expect(setRuntimeValue).toHaveBeenCalledWith('OrcPlayer4', 'relentlessEnduranceUsed', true, 'TestCampaign');
      });

      it('removes unconscious condition when triggering', () => {
        const orc = createPlayerCreature('OrcPlayer5');
        const cs = makeCombatSummary([orc]);

        getRuntimeValue.mockImplementation((charName, key, campaignName) => {
          if (charName === 'OrcPlayer5' && key === 'currentHitPoints') return 10;
          if (charName === 'OrcPlayer5' && key === 'hitPoints') return 100;
          if (charName === 'OrcPlayer5' && key === 'activeConditions') return ['unconscious', 'blinded'];
          if (key === 'activeBuffs') return [];
          if (key === 'arcaneWardActive') return undefined;
          return undefined;
        });

        applyDamageToTarget(cs, 'OrcPlayer5', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('OrcPlayer5', {
          level: 1,
          hitPoints: { max: 100 },
          allFeatures: [{ name: 'Relentless Endurance' }],
        })]);

        expect(setRuntimeValue).toHaveBeenCalledWith('OrcPlayer5', 'activeConditions', ['blinded'], 'TestCampaign');
      });
    });
});
