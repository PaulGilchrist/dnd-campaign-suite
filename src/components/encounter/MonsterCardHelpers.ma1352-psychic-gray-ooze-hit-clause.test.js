// @maintained-by-ai
// MA-1352: Psychic Gray Ooze Pseudopod — "the target has Disadvantage on
// Intelligence saving throws until the end of the ooze's next turn" was a
// prose-only rider (no structured keys, zero te) and stayed inert. The fix is
// DATA (hit_target_effect:"ability_save_disadvantage" +
// hit_target_effect_ability:"int") riding the MA-0016 hit-clause seam.
// Lane scope: row is NOT in the handlePlainDamage.hitClause.test.js
// HIT_CLAUSE_ROWS mega tuple, so this lane keeps the by-name disk fingerprint
// plus the unowned parseHitTargetEffectAbility arms (six-ability whitelist via
// toAbbr, inert otherwise) and the targetEffectAbility clause-payload branch.
// Generic clause shapes + byte-inert no-ability rows are mega-owned (:183-216);
// the resolved-hit press leg lives in handlePlainDamage.ma1352-pseudopod-*.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildHitConditionClause,
  parseHitTargetEffectAbility,
} from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const OOZE = monsters.find((m) => m.name === 'Psychic Gray Ooze');
const PSEUDOPOD = OOZE.actions.find((a) => a.name === 'Pseudopod');

describe('MA-1352 Psychic Gray Ooze Pseudopod hit-clause', () => {
  it('disk fingerprint: Pseudopod row carries the te+ability keys verbatim, te-only (no condition spray)', () => {
    expect(PSEUDOPOD.attack_bonus).toBe(3);
    expect(PSEUDOPOD.damage_dice_primary).toBe('3d6 + 1');
    expect(PSEUDOPOD.damage_type_primary).toBe('Acid');
    expect(PSEUDOPOD.description).toMatch(/Disadvantage on Intelligence saving throws until the end of the ooze's next turn/);
    expect(PSEUDOPOD.hit_target_effect).toBe('ability_save_disadvantage');
    expect(PSEUDOPOD.hit_target_effect_ability).toBe('int');
    const keys = Object.keys(PSEUDOPOD);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('hit_target_effect_ability')).toBe(keys.indexOf('hit_target_effect') + 1);
    expect(PSEUDOPOD.hit_conditions).toBeUndefined();
    expect(PSEUDOPOD.hit_condition_roll).toBeUndefined();
    expect(PSEUDOPOD.escape_dc).toBeUndefined();
  });

  it('parseHitTargetEffectAbility arms ONLY on the structured key (six-ability whitelist, inert otherwise)', () => {
    expect(parseHitTargetEffectAbility({ hit_target_effect_ability: 'int' })).toBe('int');
    expect(parseHitTargetEffectAbility({ hit_target_effect_ability: 'Intelligence' })).toBe('int');
    expect(parseHitTargetEffectAbility({ hit_target_effect_ability: 'DEX' })).toBe('dex');
    expect(parseHitTargetEffectAbility({ hit_target_effect: 'ability_save_disadvantage' })).toBeNull();
    expect(parseHitTargetEffectAbility({ hit_target_effect_ability: '' })).toBeNull();
    expect(parseHitTargetEffectAbility({ hit_target_effect_ability: 12 })).toBeNull();
    expect(parseHitTargetEffectAbility({ hit_target_effect_ability: 'carisma' })).toBeNull();
    expect(parseHitTargetEffectAbility(undefined)).toBeNull();
  });

  it('buildHitConditionClause carries targetEffectAbility through, and a junk ability never drops the te', () => {
    expect(buildHitConditionClause(PSEUDOPOD)).toEqual({
      conditions: [],
      escapeDc: null,
      attackName: 'Pseudopod',
      targetEffect: 'ability_save_disadvantage',
      targetEffectAbility: 'int',
    });
    expect(buildHitConditionClause({
      name: 'Junk',
      hit_target_effect: 'ability_save_disadvantage',
      hit_target_effect_ability: 'xyz',
    })).toEqual({
      conditions: [],
      escapeDc: null,
      attackName: 'Junk',
      targetEffect: 'ability_save_disadvantage',
    });
  });
});
