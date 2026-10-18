// @maintained-by-ai
// MA-1260: Oni "Shape-Shift" — SUPPRESSION leg uniquely owned here per #419
// ("chip suppression owned by mega lane + ma1260/ma1450 chip lanes").
// Pre-fix the disk row carried junk attack_bonus:0 and rendered a SOLE "+0"
// mc-dice-link that rolled a bogus to-hit (live audit: roll/attack
// name:'Shape-Shift', lastAttack ABSENT). The DATA fix removed the key (imp
// MA-1020 twin byte-shape; key-absence pinned by services/encounters/
// monsterShapeShift.ma1260-oni.test.js:102-105), so MonsterAction.jsx:451/
// :479 attack lane stays un-armed: every mc-dice-link on the live disk row
// IS the shapeshift chip — a "+0" attack chip may never render again.
// Owned elsewhere — NOT restated here:
// - chip render/press payload, clickable guard (MonsterAction.jsx:323),
//   At Will no-counter/no-spent pattern, sibling mount gate: #451
//   MonsterAction.ma1020-shape-shift-chip.test.jsx
// - formsText title pattern: #455
//   MonsterAction.ma1113-shape-shift-chip.test.jsx
// - predicate true/false (incl. Claw inert :119), forms, disk data,
//   apply/refusals: services/encounters/monsterShapeShift.ma1260-oni.test.js
// - chooser UI: ShapeShiftModal.test.jsx
// No timers.
import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const oni = monsters.find(m => m.index === 'oni');
const SHAPE_ROW = oni.actions.find(a => a.name === 'Shape-Shift');

describe('MA-1260 Oni Shape-Shift chip', () => {
  it('junk "+0" attack chip SUPPRESSED: the one mc-dice-link on the disk row is mc-dice-link-shapeshift; onAttack never armed', () => {
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
        onShapeShiftRow={vi.fn()}
      />
    );
    const links = [...container.querySelectorAll('.mc-dice-link')];
    expect(links.length).toBe(1);
    expect(links[0].classList.contains('mc-dice-link-shapeshift')).toBe(true);
    expect(container.textContent).not.toContain('+0');
    expect(links.find(l => l.textContent.trim() === '+0')).toBeUndefined();
    expect(onAttack).not.toHaveBeenCalled();
  });
});
