// @maintained-by-ai
// MA-0863: Glabrezu "Pincer" — prose carries "If the target is a Medium or
// smaller creature, it has the Grappled condition (escape DC 15) from one of
// two pincers" (DC 15 = 8 + STR 7 + PB 0, description authority) but the row
// shipped WITHOUT hit_conditions/escape_dc, so the grapple rider was
// structurally inert. Two-field DATA fix mirroring the giant-squid/
// giant-octopus twins (MA-0829/MA-0812, MA-0010 seam): hit_conditions:
// ["grappled"] + escape_dc:15 placed after damage_type_primary. This row is
// NOT in the HIT_CLAUSE_ROWS mega table, so this is its sole byte-lock:
// Object.keys exact (pins placement AND proves no save fields can creep in —
// old no-save it pruned) + verbatim toEqual. Clause arming and the
// consumer lane (buildHitConditionClause → handlePlainDamage
// .applyHitClauseConditions) are generic mega-locks (hitClause
// .test.js:183-334) — direct helper calls pruned. "one of two pincers"
// limb-stack sustained-grapple state-machine is §70 advisory
// (MA-0287/0288/0354 precedent) — single grappled grant is the ceiling.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const PINCER = monsters.find((m) => m.index === 'glabrezu').actions[1];

describe('MA-0863 glabrezu Pincer grapple rider', () => {
  it('fused lock: exact disk-row bytes arm the clause; "+9" chip live, click payloads the row', () => {
    expect(Object.keys(PINCER)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'damage_dice_primary',
      'damage_type_primary',
      'hit_conditions',
      'escape_dc',
    ]);
    expect(PINCER).toEqual({
      name: 'Pincer',
      description: 'Melee Attack Roll: +9, reach 10 ft. Hit: 16 (2d10 + 5) Slashing damage. If the target is a Medium or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 15) from one of two pincers.',
      attack_bonus: 9,
      reach: '10 ft.',
      damage_dice_primary: '2d10 + 5',
      damage_type_primary: 'Slashing',
      hit_conditions: ['grappled'],
      escape_dc: 15,
    });
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={PINCER}
        index={1}
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
    expect(chips).toEqual(['+9']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Pincer', 9, PINCER);
    expect(onAttack.mock.calls[0][2]).toBe(PINCER);
  });
});
