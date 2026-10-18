// @maintained-by-ai
// MA-1371: Quasit Shape-Shift — row-specific unowned legs only, shape-shift
// chips only: the by-name disk row arms ONE mc-dice-link-shapeshift that is
// the SOLE mc-dice-link (pre-fix junk attack_bonus:0 "+0" chip never again)
// and click routes exact SHAPE_ROW into the chooser seam; its byte-inert Rend
// sibling mount-gate renders zero chips. Owned elsewhere — NOT restated here:
// - chip render pattern, clickable guard fork (MonsterAction.jsx:323) incl.
//   incapacitated + missing-handler, prose/At Will no-counter/no-spent:
//   #451 MonsterAction.ma1020-shape-shift-chip.test.jsx
// - formsText title pattern: #455
//   MonsterAction.ma1113-shape-shift-chip.test.jsx
// - "+0" suppression pattern precedent: #469
//   MonsterAction.ma1260-shape-shift-chip.test.jsx
// - predicate true/false (incl. Rend inert :132), disk data, forms,
//   attack_bonus key-absence, apply/refusals: services/encounters/
//   monsterShapeShift.ma1371-quasit.test.js
// - chooser UI: ShapeShiftModal.test.jsx
// No timers.
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const quasit = monsters.find(m => m.index === 'quasit');
const SHAPE_ROW = quasit.actions.find(a => a.name === 'Shape-Shift');
const REND_ROW = quasit.actions.find(a => a.name === 'Rend');

describe('MA-1371 Quasit Shape-Shift chip', () => {
  it('Shape-Shift row arms one shapeshift chip routed to the chooser; Rend sibling mount-gate renders zero chips', () => {
    const onShapeShiftRow = vi.fn();
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={SHAPE_ROW}
        index={3}
        attackerCannotAct={false}
        onAttack={onAttack}
        onDamage={vi.fn()}
        onSaveRoll={vi.fn()}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
        rechargeState={{}}
        onShapeShiftRow={onShapeShiftRow}
      />
    );
    const chips = [...container.querySelectorAll('.mc-dice-link-shapeshift')];
    expect(chips.length).toBe(1);
    // junk "+0" attack chip never again: the one mc-dice-link IS the chip
    const links = [...container.querySelectorAll('.mc-dice-link')];
    expect(links.length).toBe(1);
    expect(links[0]).toBe(chips[0]);
    expect(container.textContent).not.toContain('+0');
    expect(onAttack).not.toHaveBeenCalled();
    fireEvent.click(chips[0]);
    expect(onShapeShiftRow).toHaveBeenCalledTimes(1);
    expect(onShapeShiftRow.mock.calls[0][0]).toBe(SHAPE_ROW);

    // byte-inert sibling mount gate — predicate internals owned by
    // monsterShapeShift.ma1371-quasit.test.js:132
    const rend = render(
      <MonsterAction
        action={REND_ROW}
        index={0}
        attackerCannotAct={false}
        onAttack={onAttack}
        onDamage={vi.fn()}
        onSaveRoll={vi.fn()}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
        rechargeState={{}}
        onShapeShiftRow={onShapeShiftRow}
      />
    );
    expect(rend.container.querySelectorAll('.mc-dice-link-shapeshift').length).toBe(0);
  });
});
