// @maintained-by-ai
// MA-1344: Primal Companion (Beast of the Sea) "Beast's Strike" — prose
// carries "the target has the Grappled condition (escape DC = 8 +
// Proficiency Bonus + WIS modifier)" but the disk row shipped WITHOUT
// hit_conditions, so the grapple rider was structurally inert
// (buildHitConditionClause reads hit_conditions/escape_dc keys only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions).
// Fix split: disk authors hit_conditions ["grappled"] ONLY — escape_dc is
// caster-dependent (8 + PB + WIS) and is folded per-caster by
// primalCompanionHandler.resolveMonsterActions (fold + caster numerics owned
// there, :320-323; byte-inert negative :290-292). Row NOT absorbed: absent
// from HIT_CLAUSE_ROWS (handlePlainDamage.hitClause.test.js:224-282 — no
// static escape_dc to table-lock); clause truth-table owned there :183-215
// and MA-0286 census. Owned here: disk bytes (exact-key-list toEqual proves
// hit_conditions lands after damage_type_primary and NO escape_dc/save_dc/
// save_type/hit_target_effect may ever be baked) + this row's live clause
// arm with escapeDc null until the summon fold stamps it. Prose tokens stay
// unfolded on disk (fold happens per-caster at summon). No static attack_bonus
// (spell attack) — no numeric chip lane.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SEA = monsters.find((m) => m.index === 'primal-companion-beast-of-the-sea');
const STRIKE = SEA.actions[0];

describe('MA-1344 disk fingerprint: Beast of the Sea grapple rider fix', () => {
  it('disk bytes arm the Grappled rider with NO baked escape_dc (folded per-caster at summon)', () => {
    // fingerprint: exact key spell/order — absence of escape_dc/save fields
    // is enforced by the exact list, not individual undefined checks
    expect(SEA.name).toBe('Primal Companion (Beast of the Sea)');
    expect(Object.keys(STRIKE)).toEqual(['name', 'description', 'attack_bonus', 'reach', 'damage_dice_primary', 'damage_type_primary', 'hit_conditions']);
    expect(STRIKE.name).toBe("Beast's Strike");
    expect(STRIKE.attack_bonus).toBeNull();
    expect(STRIKE.reach).toBe('5 ft.');
    expect(STRIKE.damage_dice_primary).toBe('1d6+2+WIS modifier');
    expect(STRIKE.damage_type_primary).toBe('Bludgeoning');
    expect(STRIKE.hit_conditions).toEqual(['grappled']);
    // prose stays unfolded on disk — "escape DC = 8 + Proficiency Bonus + WIS modifier"
    expect(STRIKE.description).toContain('escape DC = 8 + Proficiency Bonus + WIS modifier');
    // live clause arm from disk alone: rider non-inert, escapeDc null until the caster fold
    expect(buildHitConditionClause(STRIKE)).toEqual({
      conditions: ['grappled'],
      escapeDc: null,
      attackName: "Beast's Strike",
      targetEffect: null,
    });
  });
});
