// @maintained-by-ai
// MA-0812: Giant Octopus "Tentacles" grapple-rider fix — hit_conditions
// ["grappled","restrained"] + escape_dc 13 after damage_type_primary
// (DC 13 = 8 + STR 3 + PB 2, description authority).
// ABSORBED by handlePlainDamage.hitClause.test.js HIT_CLAUSE_ROWS :261
// (exact-row data-lock + buildHitConditionClause shape + resolveHit lane
// granting grappled/restrained with dc 13 / ability str) — disk bytes,
// key-placement indexOf, clause direct-call, and attackRowMissingToHit
// helper calls pruned here. UNIQUE delta: no other component-side lane
// renders this row (grep 'giant-octopus' test-side lands only here;
// grell MA-0927 / grick MA-0930 are distinct rows) — chip identity for
// this row's onAttack dispatch is owned solely by this file.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TENTACLES = monsters.find((m) => m.index === 'giant-octopus').actions[0];

describe('MA-0812 giant-octopus Tentacles — component chip dispatch (row bytes owned by hitClause :261)', () => {
  it('renders exactly one live "+5" attack chip (no save leg) and dispatches onAttack with the exact disk row', () => {
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TENTACLES}
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
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+5']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Tentacles', 5, TENTACLES);
  });
});
