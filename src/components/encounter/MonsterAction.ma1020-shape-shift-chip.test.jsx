// @maintained-by-ai
// MA-1020: Imp "Shape-Shift" chip — COMPONENT lane only. ShapeShiftLink
// (MonsterAction.jsx:321) arms one .mc-dice-link-shapeshift chip off the
// disk row's automation; this lane pins chip render, the clickable guard
// (:323), and exact onShapeShiftRow(action) payload identity into the
// modal's chooser seam. Owned elsewhere — NOT restated here:
// - predicate gate + disk data + Speed dict + apply/refusals/modal seam:
//   services/encounters/monsterShapeShift.ma1020-imp.test.js
//   (isMonsterShapeShiftRow :114/:126-129, apply §163, refusals §224)
// - self-buff lane discrimination (imp Invisibility, isMonsterSelfBuffRow):
//   services/encounters/monsterSelfBuff.imp-invisibility.test.js :96/:113
//   and its chip affordance in MonsterAction.self-buff.test.jsx
// - chooser UI: ShapeShiftModal.test.jsx
// At Will: no uses counter, no spent class. No timers.
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const imp = monsters.find(m => m.index === 'imp');
const SHAPE_ROW = imp.actions.find(a => a.name === 'Shape-Shift');
const INVIS_ROW = imp.actions.find(a => a.name === 'Invisibility');
const STING_ROW = imp.actions.find(a => a.name === 'Sting');

function renderRow(action, overrides = {}) {
  const onShapeShiftRow = vi.fn();
  const utils = render(
    <MonsterAction
      action={action}
      index={0}
      attackerCannotAct={false}
      onAttack={vi.fn()}
      onDamage={vi.fn()}
      onSaveRoll={vi.fn()}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={vi.fn()}
      rechargeState={{}}
      onShapeShiftRow={onShapeShiftRow}
      {...overrides}
    />
  );
  return { ...utils, onShapeShiftRow };
}

describe('MA-1020 Shape-Shift chip', () => {
  it('arms one chip "Shape-Shift" beside the prose, At Will; click routes onShapeShiftRow(SHAPE_ROW)', () => {
    const { container, onShapeShiftRow } = renderRow(SHAPE_ROW);
    const chips = [...container.querySelectorAll('.mc-dice-link-shapeshift')];
    expect(chips.length).toBe(1);
    expect(chips[0].textContent.trim()).toBe('Shape-Shift');
    expect(chips[0].getAttribute('role')).toBe('button');
    expect(chips[0].getAttribute('title')).toContain('Rat / Raven / Spider / True Form');
    // prose stays rendered beside the chip; At Will — no uses counter, no spent class
    expect(container.textContent).toContain('shape-shifts');
    expect(container.textContent).not.toContain('left)');
    expect(chips[0].className).not.toContain('mc-dice-link-spell-spent');
    fireEvent.click(chips[0]);
    expect(onShapeShiftRow).toHaveBeenCalledTimes(1);
    expect(onShapeShiftRow.mock.calls[0][0]).toBe(SHAPE_ROW);
  });

  it('clickable guard (:323): incapacitated or missing handler — chip visible, click inert, no throw', () => {
    const { container, onShapeShiftRow } = renderRow(SHAPE_ROW, { attackerCannotAct: true });
    const chip = container.querySelector('.mc-dice-link-shapeshift');
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(onShapeShiftRow).not.toHaveBeenCalled();

    const unhandled = renderRow(SHAPE_ROW, { onShapeShiftRow: undefined });
    const chip2 = unhandled.container.querySelector('.mc-dice-link-shapeshift');
    expect(chip2).toBeTruthy();
    expect(() => fireEvent.click(chip2)).not.toThrow();
  });

  it('other lanes never arm the chip: Invisibility self-buff row, Sting prose row — zero shape-shift chips', () => {
    // predicate discrimination owned by monsterShapeShift.ma1020-imp.test.js:126-129
    // and monsterSelfBuff.imp-invisibility.test.js:96 — here only the mount gate.
    const invis = renderRow(INVIS_ROW);
    expect(invis.container.querySelectorAll('.mc-dice-link-shapeshift').length).toBe(0);
    expect(invis.container.querySelectorAll('.mc-dice-link-selfbuff').length).toBe(1);
    expect(renderRow(STING_ROW).container.querySelectorAll('.mc-dice-link-shapeshift').length).toBe(0);
  });
});
