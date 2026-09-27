// MA-1344: Primal Companion (Beast of the Sea) "Beast's Strike" — prose
// carries "the target has the Grappled condition (escape DC = 8 +
// Proficiency Bonus + WIS modifier)" but the disk row shipped WITHOUT
// hit_conditions, so the grapple rider was structurally inert
// (buildHitConditionClause reads hit_conditions/escape_dc keys only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions).
// Fix split: disk authors hit_conditions:["grappled"] ONLY — escape_dc is
// caster-dependent (8 + PB + WIS) and is folded per-caster in
// primalCompanionHandler.resolveMonsterActions (this row is merged per-
// caster, so NO static escape_dc may be baked here). Locks: disk row shape,
// absence of escape_dc, clause arms grappled from disk alone with escapeDc
// null until the fold stamps it, disk prose tokens stay unfolded.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SEA = monsters.find((m) => m.index === 'primal-companion-beast-of-the-sea');
const STRIKE = SEA.actions[0];

describe('MA-1344 disk fingerprint: Beast of the Sea grapple rider fix', () => {
  it('disk row carries hit_conditions ["grappled"] after damage_type_primary, NO static escape_dc', () => {
    expect(SEA.name).toBe('Primal Companion (Beast of the Sea)');
    expect(STRIKE.name).toBe("Beast's Strike");
    expect(STRIKE.hit_conditions).toEqual(['grappled']);
    expect(STRIKE.escape_dc).toBeUndefined();
    const keys = Object.keys(STRIKE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(STRIKE.attack_bonus).toBeNull();
    expect(STRIKE.reach).toBe('5 ft.');
    expect(STRIKE.damage_dice_primary).toBe('1d6+2+WIS modifier');
    expect(STRIKE.damage_type_primary).toBe('Bludgeoning');
  });

  it('row carries NO save fields and no baked caster numbers (escape DC is folded at summon)', () => {
    expect(STRIKE.save_dc).toBeUndefined();
    expect(STRIKE.save_type).toBeUndefined();
    expect(STRIKE.hit_target_effect).toBeUndefined();
    expect(STRIKE.description).toContain('escape DC = 8 + Proficiency Bonus + WIS modifier');
  });

  it('buildHitConditionClause arms the Grappled rider from disk (escapeDc null until the caster fold)', () => {
    const clause = buildHitConditionClause(STRIKE);
    expect(clause).toEqual({
      conditions: ['grappled'],
      escapeDc: null,
      attackName: "Beast's Strike",
      targetEffect: null,
    });
  });

  it('folded row (escape_dc stamped by primalCompanionHandler) feeds the MA-0010 seam with the caster DC', () => {
    const folded = { ...STRIKE, escape_dc: 17 };
    const clause = buildHitConditionClause(folded);
    expect(clause.conditions).toEqual(['grappled']);
    expect(clause.escapeDc).toBe(17);
  });
});
