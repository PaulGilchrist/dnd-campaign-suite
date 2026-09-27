// MA-1352: Psychic Gray Ooze Pseudopod — "the target has Disadvantage on
// Intelligence saving throws until the end of the ooze's next turn" was a
// prose-only rider (no structured keys, zero te) and stayed inert. The fix is
// DATA (hit_target_effect:"ability_save_disadvantage" +
// hit_target_effect_ability:"int") riding the MA-0016 hit-clause seam.
// Locks: disk row shape + placement, parseHitTargetEffectAbility structured-key
// arms (six-ability whitelist, inert otherwise), clause ability payload, and
// byte-inert clause shape for rows without hit_target_effect_ability.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildHitConditionClause,
  parseHitTargetEffectAbility,
} from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const OOZE = monsters.find((m) => m.index === 'psychic-gray-ooze');
const PSEUDOPOD = OOZE.actions[0];

describe('MA-1352 data lock (monsters.json Psychic Gray Ooze Pseudopod)', () => {
  it('actions[0] is the Pseudopod attack with the INT-save-disadv rider prose', () => {
    expect(PSEUDOPOD.name).toBe('Pseudopod');
    expect(PSEUDOPOD.attack_bonus).toBe(3);
    expect(PSEUDOPOD.damage_dice_primary).toBe('3d6 + 1');
    expect(PSEUDOPOD.damage_type_primary).toBe('Acid');
    expect(PSEUDOPOD.description).toMatch(/Disadvantage on Intelligence saving throws until the end of the ooze's next turn/);
  });

  it('authors hit_target_effect + hit_target_effect_ability after damage_type_primary', () => {
    const keys = Object.keys(PSEUDOPOD);
    expect(PSEUDOPOD.hit_target_effect).toBe('ability_save_disadvantage');
    expect(PSEUDOPOD.hit_target_effect_ability).toBe('int');
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('hit_target_effect_ability')).toBe(keys.indexOf('hit_target_effect') + 1);
  });

  it('carries no hit_conditions / hit_condition_roll (te-only rider, no condition spray)', () => {
    expect(PSEUDOPOD.hit_conditions).toBeUndefined();
    expect(PSEUDOPOD.hit_condition_roll).toBeUndefined();
    expect(PSEUDOPOD.escape_dc).toBeUndefined();
  });
});

describe('MA-1352 parseHitTargetEffectAbility arms ONLY on the structured key', () => {
  it('accepts the six abilities (abbrev or full word, case-insensitive)', () => {
    expect(parseHitTargetEffectAbility({ hit_target_effect_ability: 'int' })).toBe('int');
    expect(parseHitTargetEffectAbility({ hit_target_effect_ability: 'Intelligence' })).toBe('int');
    expect(parseHitTargetEffectAbility({ hit_target_effect_ability: 'DEX' })).toBe('dex');
    expect(parseHitTargetEffectAbility({ hit_target_effect_ability: 'wis' })).toBe('wis');
  });

  it('returns null when the key is absent, empty, non-string, or not an ability', () => {
    expect(parseHitTargetEffectAbility({ hit_target_effect: 'ability_save_disadvantage' })).toBeNull();
    expect(parseHitTargetEffectAbility({ hit_target_effect_ability: '' })).toBeNull();
    expect(parseHitTargetEffectAbility({ hit_target_effect_ability: 12 })).toBeNull();
    expect(parseHitTargetEffectAbility({ hit_target_effect_ability: 'carisma' })).toBeNull();
    expect(parseHitTargetEffectAbility(undefined)).toBeNull();
  });
});

describe('MA-1352 buildHitConditionClause ability payload', () => {
  it('builds the te-only clause carrying targetEffectAbility:"int"', () => {
    expect(buildHitConditionClause(PSEUDOPOD)).toEqual({
      conditions: [],
      escapeDc: null,
      attackName: 'Pseudopod',
      targetEffect: 'ability_save_disadvantage',
      targetEffectAbility: 'int',
    });
  });

  it('leaves no_ability rows byte-identical (no targetEffectAbility key — sibling inert)', () => {
    const slaad = {
      name: 'Claw',
      attack_bonus: 11,
      damage_dice_primary: '2d6+4',
      damage_type_primary: 'Slashing',
      hit_target_effect: 'no_healing',
    };
    const clause = buildHitConditionClause(slaad);
    expect(clause).toEqual({
      conditions: [],
      escapeDc: null,
      attackName: 'Claw',
      targetEffect: 'no_healing',
    });
    expect(clause).not.toHaveProperty('targetEffectAbility');
  });

  it('rejects a junk ability value without dropping the te itself', () => {
    const clause = buildHitConditionClause({
      name: 'Junk',
      hit_target_effect: 'ability_save_disadvantage',
      hit_target_effect_ability: 'xyz',
    });
    expect(clause.targetEffect).toBe('ability_save_disadvantage');
    expect(clause).not.toHaveProperty('targetEffectAbility');
  });
});
