// @maintained-by-ai
// MA-1113: Lizardfolk Shaman "Change Shape (Recharges after a Short or Long
// Rest)" chip — COMPONENT lane delta for this monster only: ShapeShiftLink
// (MonsterAction.jsx:321) arms ONE .mc-dice-link-shapeshift chip off the
// disk row's automation and its title renders this monster's formsText
// "Crocodile / True Form"; click routes exact onShapeShiftRow(SHAPE_ROW)
// byte identity into the modal's chooser seam. Formerly-dead prose row
// (pre-fix audit: 0 interactive elements) re-armed by the DATA fix per the
// MA-1020 imp byte-shape. Owned elsewhere — NOT restated here:
// - predicate true/false (incl. Bite rejection), forms list, disk data,
//   Speed dict, apply/refusals: services/encounters/monsterShapeShift.ma1113-lizardfolk.test.js
//   (:99-100 predicate+forms, :113 Bite inert, apply §118, refusals)
// - chip affordance mechanics, clickable guard (MonsterAction.jsx:323)
//   incapacitated + missing-handler, At Will no-counter/no-spent pattern,
//   sibling-row mount gates: MonsterAction.ma1020-shape-shift-chip.test.js (#451)
// - chooser UI: ShapeShiftModal.test.jsx
// Recharge-name row renders NO uses counter / spent class (rest-rearm text
// stays cosmetic, §70). No timers.
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const shaman = monsters.find(m => m.index === 'lizardfolk-shaman');
const SHAPE_ROW = shaman.actions.find(a => a.name === 'Change Shape (Recharges after a Short or Long Rest)');
const BITE_ROW = shaman.actions.find(a => a.name === 'Bite');

describe('MA-1113 Lizardfolk Shaman Change Shape chip', () => {
  it('arms one chip with Crocodile / True Form formsText; click routes exact SHAPE_ROW; recharge-name row has no counter/spent class; Bite zero chips', () => {
    const onShapeShiftRow = vi.fn();
    const { container } = render(
      <MonsterAction
        action={SHAPE_ROW}
        index={3}
        attackerCannotAct={false}
        onAttack={vi.fn()}
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
    expect(chips[0].textContent.trim()).toBe('Shape-Shift');
    expect(chips[0].getAttribute('role')).toBe('button');
    expect(chips[0].getAttribute('title')).toContain('Crocodile / True Form');
    // prose stays rendered beside the chip; no uses counter, no spent class
    // despite the "(Recharges after a Short or Long Rest)" name (§70)
    expect(container.textContent).toContain('polymorphs into a crocodile');
    expect(container.textContent).not.toContain('left)');
    expect(chips[0].className).not.toContain('mc-dice-link-spell-spent');
    fireEvent.click(chips[0]);
    expect(onShapeShiftRow).toHaveBeenCalledTimes(1);
    expect(onShapeShiftRow.mock.calls[0]).toEqual([SHAPE_ROW]);
    // Bite byte-inert sibling renders zero chips (predicate internals owned
    // by monsterShapeShift.ma1113-lizardfolk.test.js:113 — mount gate only)
    const bite = render(
      <MonsterAction
        action={BITE_ROW}
        index={1}
        attackerCannotAct={false}
        onAttack={vi.fn()}
        onDamage={vi.fn()}
        onSaveRoll={vi.fn()}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
        rechargeState={{}}
        onShapeShiftRow={onShapeShiftRow}
      />
    );
    expect(bite.container.querySelectorAll('.mc-dice-link-shapeshift').length).toBe(0);
  });
});
