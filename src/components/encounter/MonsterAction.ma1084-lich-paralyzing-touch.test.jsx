// @maintained-by-ai
// MA-1084: Lich "Paralyzing Touch" — prose carries "Hit: ... the target has
// the Paralyzed condition until the start of the lich's next turn" but the
// row shipped WITHOUT hit_conditions, so the condition rider was structurally
// inert (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). One-field DATA fix:
// hit_conditions:["paralyzed"] (MA-0775 ghast Claw byte-shape, placed after
// damage_type_primary). Grants ride the STANDARD until-next-turn latch
// (MA-0775/MA-0763 precedent — no explicit clock; the RAW "until the start
// of the lich's next turn" anchor is GM-enforced badge removal).
// ABSORBED by owner lanes — do NOT re-add here: row numerics/dice/type/
// hit_conditions/clause shape + end-to-end grant are data-locked by the
// mega table handlePlainDamage.hitClause.test.js:265 exact tuple
// ['lich','Paralyzing Touch',12,'3d6 + 5','Cold',['paralyzed'],null,null];
// ghast Claw twin byte-shape is owned by MA-0775
// (MonsterAction.ma0775-ghast-gravecaller-claw.test.jsx).
// Kept here (unowned): disk fingerprint deltas the mega tuple MISSES —
// hit_conditions key placement after damage_type_primary, reach, prose
// duration anchor byte-kept, noise fields (MA-1071: save_dc:0 decoy is
// code-gated Number(save_dc)>0 — inert, do NOT strip) — plus the component
// chip-press identity leg: "+12" attack chip live with ZERO save chip.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const LICH = monsters.find((m) => m.index === 'lich');
const TOUCH = LICH.actions.find((a) => a.name === 'Paralyzing Touch');

describe('MA-1084 Lich Paralyzing Touch — unowned fingerprint deltas + chip press', () => {
  it('disk row keeps hit_conditions after damage_type_primary, reach, prose anchor, inert noise fields', () => {
    const keys = Object.keys(TOUCH);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(TOUCH.reach).toBe('5 ft.');
    expect(TOUCH.description).toContain('<strong>Paralyzed</strong> condition until the start of the lich\'s next turn');
    expect(TOUCH.save_dc).toBe(0);
    expect(TOUCH.save_type).toBe('');
    expect(TOUCH.save_effect).toBe('');
    expect(TOUCH.escape_dc).toBeUndefined();
    expect(TOUCH.hit_target_effect).toBeUndefined();
  });

  it('component: one "+12" attack chip, no DC0 save chip (MA-1071 gate), attack payload intact', () => {
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TOUCH}
        index={2}
        attackerCannotAct={false}
        onAttack={onAttack}
        onDamage={vi.fn()}
        onSaveRoll={vi.fn()}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
      />
    );
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+12']);
    expect(container.querySelectorAll('.mc-dice-link-save-clickable')).toHaveLength(0);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Paralyzing Touch', 12, expect.objectContaining({ name: 'Paralyzing Touch' }));
  });
});
