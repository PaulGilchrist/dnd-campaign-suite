// MA-0838: Gibbering Mouther "Bite" — prose carries "If the target is a
// Medium or smaller creature, it has the Prone condition" but the row shipped
// WITHOUT hit_conditions, so the prone rider was structurally inert
// (buildHitConditionClause reads hit_conditions/escape_dc keys only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions
// incl. the Large-or-smaller victim gate).
// One-field DATA fix mirroring the MA-0791/MA-0802 byte-shape twin and the
// ma0807/ma0819/ma0834 template (MA-0010 seam): hit_conditions:["prone"]
// placed after damage_type_primary. gibbering-mouther is deliberately NOT in
// the mega HIT_CLAUSE_ROWS table (handlePlainDamage.hitClause.test.js:224-282),
// so this file is the row's only lane — disk fingerprint + chip press, exact
// bytes, nothing else. No escape_dc, no save fields, no escape clause. The
// row save_effect is a DECOY (attack row, no save_dc — §115) and stays
// byte-preserved inside the exact-row toEqual. Instant-death/body-absorb
// clause stays GM-advisory (§70 — zero instant-death consumer on attack rows
// app-wide). Clause arming (escapeDc:null), chip suppression
// (attackRowMissingToHit), and clause class of this exact row are owned
// generically by the mega lane (handlePlainDamage.hitClause.test.js:183-334)
// and the ma0286 truth table — not re-derived here.
// @maintained-by-ai
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const BITE = monsters.find((m) => m.index === 'gibbering-mouther').actions[0];

describe('MA-0838 gibbering-mouther Bite prone rider', () => {
  it('disk fingerprint: exact row bytes, exact key order, hit_conditions ["prone"] after damage_type_primary, decoy save_effect untouched, no escape/save fields', () => {
    expect(BITE).toEqual({
      name: 'Bite',
      description: 'Melee Attack Roll: +2, reach 5 ft. Hit: 7 (2d6) Piercing damage. If the target is a Medium or smaller creature, it has the <strong>Prone</strong> condition. The target dies if it is reduced to 0 Hit Points by this attack. Its body is then absorbed into the mouther, leaving only equipment behind.',
      attack_bonus: 2,
      reach: '5 ft.',
      save_effect: 'If the target is a Medium or smaller creature, it has the Prone condition. The target dies if it is reduced to 0 Hit Points by this attack. Its body is then absorbed into the mouther, leaving only equipment behind.',
      damage_dice_primary: '2d6',
      damage_type_primary: 'Piercing',
      hit_conditions: ['prone'],
    });
    expect(Object.keys(BITE)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'save_effect',
      'damage_dice_primary',
      'damage_type_primary',
      'hit_conditions',
    ]);
  });

  it('chip press: one "+2" chip routes the exact disk row through onAttack by identity', () => {
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BITE}
        index={0}
        attackerCannotAct={false}
        onAttack={onAttack}
        onDamage={vi.fn()}
        onSaveRoll={vi.fn()}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
      />
    );
    const chips = [...container.querySelectorAll('.mc-dice-link')];
    expect(chips.map((c) => c.textContent.trim())).toEqual(['+2']);
    fireEvent.click(chips[0]);
    expect(onAttack).toHaveBeenCalledTimes(1);
    const [name, bonus, row] = onAttack.mock.calls[0];
    expect(name).toBe('Bite');
    expect(bonus).toBe(2);
    expect(row).toBe(BITE);
  });
});
