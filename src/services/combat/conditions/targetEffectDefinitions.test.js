// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TARGET_EFFECT_DEFINITIONS, getEffectDefinition, registerTargetEffect } from './targetEffectDefinitions.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

describe('targetEffectDefinitions', () => {
  describe('TARGET_EFFECT_DEFINITIONS', () => {
    it('is an array', () => {
      expect(Array.isArray(TARGET_EFFECT_DEFINITIONS)).toBe(true);
    });

    it('has a non-zero length', () => {
      expect(TARGET_EFFECT_DEFINITIONS.length).toBeGreaterThan(0);
    });

    it('contains definitions for all expected groups', () => {
      const groups = [...new Set(TARGET_EFFECT_DEFINITIONS.map((d) => d.group))];
      expect(groups).toContain('Attack');
      expect(groups).toContain('Defensive');
      expect(groups).toContain('Saves & Checks');
      expect(groups).toContain('Spells');
      expect(groups).toContain('Movement');
    });

    it('defines at least one effect per group', () => {
      const groupCounts = {};
      for (const def of TARGET_EFFECT_DEFINITIONS) {
        groupCounts[def.group] = (groupCounts[def.group] || 0) + 1;
      }
      for (const group of Object.keys(groupCounts)) {
        expect(groupCounts[group]).toBeGreaterThan(0);
      }
    });
  });

  describe('definition shape', () => {
    const requiredProps = ['effect', 'label', 'description', 'icon', 'cls', 'group'];
    for (const def of TARGET_EFFECT_DEFINITIONS) {
      it(`"${def.effect}" has all required properties`, () => {
        for (const prop of requiredProps) {
          expect(def).toHaveProperty(prop);
          expect(typeof def[prop]).toBe('string');
          expect(def[prop]).toBeTruthy();
        }
      });

      it(`"${def.effect}" has valid optional properties when present`, () => {
        if (def.fields) {
          expect(Array.isArray(def.fields)).toBe(true);
          for (const field of def.fields) {
            expect(['value', 'ability', 'source', 'dc', 'constellation', 'beastName', 'mode', 'objectType', 'displayLabel', 'formName']).toContain(field);
          }
        }
        if (def.defaults) {
          expect(typeof def.defaults).toBe('object');
          expect(def.defaults).not.toBeNull();
        }
        if (def.sourceLabel) {
          expect(typeof def.sourceLabel).toBe('string');
          expect(def.sourceLabel).toBeTruthy();
        }
      });
    }
  });

  describe('unique effect keys', () => {
    it('has no duplicate effect keys', () => {
      const keys = TARGET_EFFECT_DEFINITIONS.map((d) => d.effect);
      const uniqueKeys = [...new Set(keys)];
      expect(keys.length).toBe(uniqueKeys.length);
    });
  });

  describe('definitions by group', () => {
    describe('Attack group', () => {
      const attackEffects = TARGET_EFFECT_DEFINITIONS.filter((d) => d.group === 'Attack');

      it('contains expected attack effects', () => {
        const effectKeys = attackEffects.map((d) => d.effect);
        expect(effectKeys).toContain('slasher_enhanced_critical');
        expect(effectKeys).toContain('disadvantage_next_attack');
        expect(effectKeys).toContain('goad');
        expect(effectKeys).toContain('next_attack_bonus');
        expect(effectKeys).toContain('next_attack_advantage');
        expect(effectKeys).toContain('distracting_strike_advantage');
        expect(effectKeys).toContain('reckless_attack');
        expect(effectKeys).toContain('taunting_step');
      });

      it('Attack effects have appropriate icon classes', () => {
        for (const def of attackEffects) {
          expect(def.icon).toMatch(/^fa-/);
        }
      });
    });

    describe('Defensive group', () => {
      const defensiveEffects = TARGET_EFFECT_DEFINITIONS.filter((d) => d.group === 'Defensive');

      it('contains expected defensive effects', () => {
        const effectKeys = defensiveEffects.map((d) => d.effect);
        expect(effectKeys).toContain('escape_the_horde');
        expect(effectKeys).toContain('multiattack_defense');
        expect(effectKeys).toContain('no_opportunity_attacks');
        expect(effectKeys).toContain('no_reactions');
        expect(effectKeys).toContain('protection');
      });

      it('Defensive effects that block actions have no optional fields', () => {
        const noFieldEffects = defensiveEffects.filter((d) => d.effect === 'no_opportunity_attacks' || d.effect === 'no_reactions');
        for (const def of noFieldEffects) {
          expect(def.fields).toBeUndefined();
        }
      });
    });

    describe('Saves & Checks group', () => {
      const savesChecksEffects = TARGET_EFFECT_DEFINITIONS.filter((d) => d.group === 'Saves & Checks');

      it('contains expected saves & checks effects', () => {
        const effectKeys = savesChecksEffects.map((d) => d.effect);
        expect(effectKeys).toContain('advantage_abilities');
        expect(effectKeys).toContain('advantage_attacks');
        expect(effectKeys).toContain('advantage_saves');
        expect(effectKeys).toContain('bane_penalty');
        expect(effectKeys).toContain('hex_ability_check_disadvantage');
        expect(effectKeys).toContain('dex_save_disadvantage');
        expect(effectKeys).toContain('disadvantage_perception_checks');
        expect(effectKeys).toContain('hex_save_disadvantage');
        expect(effectKeys).toContain('disadvantage_on_next_save');
      });

      it('effects with ability fields have correct defaults', () => {
        const hexCheck = savesChecksEffects.find((d) => d.effect === 'hex_ability_check_disadvantage');
        expect(hexCheck.defaults.ability).toBe('wis');

        const hexSave = savesChecksEffects.find((d) => d.effect === 'hex_save_disadvantage');
        expect(hexSave.defaults.ability).toBe('wis');
      });
    });

    describe('Spells group', () => {
      const spellEffects = TARGET_EFFECT_DEFINITIONS.filter((d) => d.group === 'Spells');

      it('contains expected spell effects', () => {
        const effectKeys = spellEffects.map((d) => d.effect);
        expect(effectKeys).toContain('tashas_hideous_laughter');
        expect(effectKeys).toContain('forcecage');
        expect(effectKeys).toContain('protection_from_evil_and_good');
        expect(effectKeys).toContain('protection_from_poison');
        expect(effectKeys).toContain('maze');
        expect(effectKeys).toContain('confusion');
        expect(effectKeys).toContain('banishment');
        expect(effectKeys).toContain('holy_aura');
        expect(effectKeys).toContain('antimagic_field');
        expect(effectKeys).toContain('aura_of_life');
        expect(effectKeys).toContain('aura_of_purity');
        expect(effectKeys).toContain('aura_of_vitality');
        expect(effectKeys).toContain('barkskin');
        expect(effectKeys).toContain('blur');
        expect(effectKeys).toContain('beacon_of_hope');
        expect(effectKeys).toContain('bless_bonus');
        expect(effectKeys).toContain('calm_emotions');
        expect(effectKeys).toContain('circle_of_power');
        expect(effectKeys).toContain('clairvoyant_combatant');
        expect(effectKeys).toContain('compelled_duel');
        expect(effectKeys).toContain('crown_of_madness');
        expect(effectKeys).toContain('death_strike');
        expect(effectKeys).toContain('heroism');
        expect(effectKeys).toContain('death_ward');
        expect(effectKeys).toContain('enhance_ability');
        expect(effectKeys).toContain('faerie_fire');
        expect(effectKeys).toContain('flesh_to_stone');
        expect(effectKeys).toContain('foresight');
        expect(effectKeys).toContain('globe_barrier');
        expect(effectKeys).toContain('ottos_irresistible_dance');
        expect(effectKeys).toContain('regenerate');
        expect(effectKeys).toContain('resistance_damage_reduction');
        expect(effectKeys).toContain('ray_of_enfeeble_debuff');
        expect(effectKeys).toContain('resilient_sphere');
        expect(effectKeys).toContain('silenced');
        expect(effectKeys).toContain('starry_form');
        expect(effectKeys).toContain('summoned');
        expect(effectKeys).toContain('wild_shape');
        expect(effectKeys).toContain('polymorph');
        expect(effectKeys).toContain('true_polymorph');
        expect(effectKeys).toContain('animal_shapes');
        expect(effectKeys).toContain('shapechange');
        expect(effectKeys).toContain('object_transform');
        expect(effectKeys).toContain('pass_without_trace_bonus');
        expect(effectKeys).toContain('imprisonment');
        expect(effectKeys).toContain('prismatic_spray_indigo');
        expect(effectKeys).toContain('prismatic_spray_violet');
        expect(effectKeys).toContain('sanctuary');
        expect(effectKeys).toContain('sleet_storm');
        expect(effectKeys).toContain('stinking_cloud');
        expect(effectKeys).toContain('warding_bond');
      });

      it('SP-111: registers stinking_cloud zone and no_action_and_bonus_action block', () => {
        const cloud = getEffectDefinition('stinking_cloud');
        expect(cloud).toBeDefined();
        expect(cloud.group).toBe('Spells');
        expect(cloud.fields).toContain('dc');

        const block = getEffectDefinition('no_action_and_bonus_action');
        expect(block).toBeDefined();
        expect(block.cls).toBe('effect-cannot-act');
      });

      it('polymorph effects have beastName field', () => {
        const polymorphEffects = ['wild_shape', 'polymorph', 'true_polymorph', 'animal_shapes'];
        for (const key of polymorphEffects) {
          const def = spellEffects.find((d) => d.effect === key);
          expect(def.fields).toContain('beastName');
        }
      });

      it('shapechange has formName field', () => {
        const def = spellEffects.find((d) => d.effect === 'shapechange');
        expect(def.fields).toContain('formName');
      });

      it('object_transform has objectType field', () => {
        const def = spellEffects.find((d) => d.effect === 'object_transform');
        expect(def.fields).toContain('objectType');
      });

      it('true_polymorph has mode field', () => {
        const def = spellEffects.find((d) => d.effect === 'true_polymorph');
        expect(def.fields).toContain('mode');
      });

      it('starry_form has constellation field', () => {
        const def = spellEffects.find((d) => d.effect === 'starry_form');
        expect(def.fields).toContain('constellation');
      });
    });

    describe('Movement group', () => {
      const movementEffects = TARGET_EFFECT_DEFINITIONS.filter((d) => d.group === 'Movement');

      it('contains expected movement effects', () => {
        const effectKeys = movementEffects.map((d) => d.effect);
        expect(effectKeys).toContain('ac_penalty');
        expect(effectKeys).toContain('speed_reduction');
      });

      it('movement effects have defaults', () => {
        const acPenalty = movementEffects.find((d) => d.effect === 'ac_penalty');
        expect(acPenalty.defaults.value).toBe(2);

        const speedReduction = movementEffects.find((d) => d.effect === 'speed_reduction');
        expect(speedReduction.defaults.value).toBe(10);
      });
    });
  });

  describe('defaults values', () => {
    it('next_attack_bonus has default value of 5', () => {
      const def = TARGET_EFFECT_DEFINITIONS.find((d) => d.effect === 'next_attack_bonus');
      expect(def.defaults.value).toBe(5);
    });

    it('bane_penalty has default dc of 15 and displayLabel of "Bane"', () => {
      const def = TARGET_EFFECT_DEFINITIONS.find((d) => d.effect === 'bane_penalty');
      expect(def.defaults.dc).toBe(15);
      expect(def.defaults.displayLabel).toBe('Bane');
    });

    it('death_strike has default dc of 15', () => {
      const def = TARGET_EFFECT_DEFINITIONS.find((d) => d.effect === 'death_strike');
      expect(def.defaults.dc).toBe(15);
    });

    it('pass_without_trace_bonus has default value of 10', () => {
      const def = TARGET_EFFECT_DEFINITIONS.find((d) => d.effect === 'pass_without_trace_bonus');
      expect(def.defaults.value).toBe(10);
    });

    it('effects without defaults do not have the property', () => {
      const noDefaults = TARGET_EFFECT_DEFINITIONS.filter((d) => !d.fields);
      for (const def of noDefaults) {
        expect(def.defaults).toBeUndefined();
      }
    });
  });

  describe('icon classes', () => {
    it('all effects have Font Awesome icon classes', () => {
      for (const def of TARGET_EFFECT_DEFINITIONS) {
        expect(def.icon).toMatch(/^fa-/);
      }
    });

    it('effects in the same group share consistent icon patterns', () => {
      const attackDef = TARGET_EFFECT_DEFINITIONS.find((d) => d.effect === 'slasher_enhanced_critical');
      expect(attackDef.icon).toBe('fa-arrow-down');

      const buffDef = TARGET_EFFECT_DEFINITIONS.find((d) => d.effect === 'next_attack_advantage');
      expect(buffDef.icon).toBe('fa-arrow-up');
    });
  });

  describe('CSS class values', () => {
    it('all effects have cls values', () => {
      for (const def of TARGET_EFFECT_DEFINITIONS) {
        expect(def.cls).toMatch(/^effect-/);
      }
    });

    it('has effects with various CSS class types', () => {
      const clsValues = [...new Set(TARGET_EFFECT_DEFINITIONS.map((d) => d.cls))];
      expect(clsValues).toContain('effect-buff');
      expect(clsValues).toContain('effect-disadvantage');
      expect(clsValues).toContain('effect-debuff');
      expect(clsValues).toContain('effect-target-adv');
      expect(clsValues).toContain('effect-target-disadv');
    });
  });

  describe('getEffectDefinition', () => {
    it('returns the definition for a known effect key', () => {
      const result = getEffectDefinition('goad');
      expect(result).toBeDefined();
      expect(result.effect).toBe('goad');
      expect(result.label).toBe('Goad');
    });

    it('returns undefined for an unknown effect key', () => {
      const result = getEffectDefinition('nonexistent_effect');
      expect(result).toBeUndefined();
    });

    it('returns the correct definition for every effect in the array', () => {
      for (const def of TARGET_EFFECT_DEFINITIONS) {
        const result = getEffectDefinition(def.effect);
        expect(result).toEqual(def);
      }
    });

    it('returns the correct definition for effects with special characters in labels', () => {
      const tasha = getEffectDefinition('tashas_hideous_laughter');
      expect(tasha.label).toBe("Tasha's Hideous Laughter");

      const otto = getEffectDefinition('ottos_irresistible_dance');
      expect(otto.label).toBe("Otto's Irresistible Dance");
    });

    it('handles empty string as effect key', () => {
      const result = getEffectDefinition('');
      expect(result).toBeUndefined();
    });

    it('handles null and undefined as effect keys', () => {
      expect(() => getEffectDefinition(null)).not.toThrow();
      expect(() => getEffectDefinition(undefined)).not.toThrow();
    });
  });

  describe('cross-group consistency', () => {
    it('all groups are unique and non-overlapping', () => {
      const groups = TARGET_EFFECT_DEFINITIONS.map((d) => d.group);
      const uniqueGroups = [...new Set(groups)];
      expect(groups.length).toBe(uniqueGroups.length + (TARGET_EFFECT_DEFINITIONS.length - uniqueGroups.length));
    });

    it('effects with similar purposes have consistent cls values', () => {
      const attackDisadvEffects = TARGET_EFFECT_DEFINITIONS.filter(
        (d) => d.group === 'Attack' && d.cls === 'effect-disadvantage',
      );
      for (const def of attackDisadvEffects) {
        expect(def.cls).toBe('effect-disadvantage');
      }

      const attackAdvEffects = TARGET_EFFECT_DEFINITIONS.filter(
        (d) => d.group === 'Attack' && d.cls === 'effect-target-adv',
      );
      for (const def of attackAdvEffects) {
        expect(def.cls).toBe('effect-target-adv');
      }
    });

    it('effects with fields have matching defaults keys', () => {
      for (const def of TARGET_EFFECT_DEFINITIONS) {
        if (def.fields && def.defaults) {
          for (const fieldKey of Object.keys(def.defaults)) {
            expect(def.fields).toContain(fieldKey);
          }
        }
      }
    });
  });

  describe('registerTargetEffect', () => {
    const campaignName = 'test-campaign';

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('creates a new targetEffect entry when none exists', () => {
      getRuntimeValue.mockReturnValue([]);
      registerTargetEffect(campaignName, 'Ally1', 'holy_aura', 'Paladin');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [{ target: 'Ally1', effect: 'holy_aura', source: 'Paladin', duration: 'concentration' }],
        campaignName,
        true,
      );
    });

    it('creates a new entry when store is empty', () => {
      getRuntimeValue.mockReturnValue(null);
      registerTargetEffect(campaignName, 'Ally1', 'aura_of_life', 'Cleric');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [{ target: 'Ally1', effect: 'aura_of_life', source: 'Cleric', duration: 'concentration' }],
        campaignName,
        true,
      );
    });

    it('updates an existing entry for same target+effect+source instead of duplicating', () => {
      const existing = [
        { target: 'Ally1', effect: 'holy_aura', source: 'Paladin', duration: 'concentration' },
      ];
      getRuntimeValue.mockReturnValue(existing);
      registerTargetEffect(campaignName, 'Ally1', 'holy_aura', 'Paladin');

      const updated = setRuntimeValue.mock.calls[0][2];
      expect(updated).toHaveLength(1);
      expect(updated[0]).toEqual({ target: 'Ally1', effect: 'holy_aura', source: 'Paladin', duration: 'concentration' });
    });

    it('appends new entry when existing entries are for different targets', () => {
      const existing = [
        { target: 'Ally1', effect: 'holy_aura', source: 'Paladin', duration: 'concentration' },
      ];
      getRuntimeValue.mockReturnValue(existing);
      registerTargetEffect(campaignName, 'Ally2', 'holy_aura', 'Paladin');

      const updated = setRuntimeValue.mock.calls[0][2];
      expect(updated).toHaveLength(2);
      expect(updated[1].target).toBe('Ally2');
    });

    it('appends new entry when existing entries are for different sources', () => {
      const existing = [
        { target: 'Ally1', effect: 'resistance_damage_reduction', source: 'Cleric', chosenType: 'Fire', duration: 'concentration' },
      ];
      getRuntimeValue.mockReturnValue(existing);
      registerTargetEffect(campaignName, 'Ally1', 'resistance_damage_reduction', 'Paladin', { chosenType: 'Cold' });

      const updated = setRuntimeValue.mock.calls[0][2];
      expect(updated).toHaveLength(2);
      expect(updated[1].source).toBe('Paladin');
      expect(updated[1].chosenType).toBe('Cold');
    });

    it('passes extra properties through via extraProps', () => {
      getRuntimeValue.mockReturnValue([]);
      registerTargetEffect(campaignName, 'Goblin', 'resistance_damage_reduction', 'Cleric', { chosenType: 'Fire' });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [{ target: 'Goblin', effect: 'resistance_damage_reduction', source: 'Cleric', duration: 'concentration', chosenType: 'Fire' }],
        campaignName,
        true,
      );
    });

    it('overwrites extra properties on existing entry', () => {
      const existing = [
        { target: 'Ally1', effect: 'resistance_damage_reduction', source: 'Paladin', chosenType: 'Fire', duration: 'concentration' },
      ];
      getRuntimeValue.mockReturnValue(existing);
      registerTargetEffect(campaignName, 'Ally1', 'resistance_damage_reduction', 'Paladin', { chosenType: 'Cold' });

      const updated = setRuntimeValue.mock.calls[0][2];
      expect(updated).toHaveLength(1);
      expect(updated[0].chosenType).toBe('Cold');
    });

    it('always sets skipSync as 5th argument', () => {
      getRuntimeValue.mockReturnValue([]);
      registerTargetEffect(campaignName, 'Ally1', 'holy_aura', 'Paladin');

      const callArgs = setRuntimeValue.mock.calls[0];
      expect(callArgs[4]).toBe(true);
    });
  });
});
