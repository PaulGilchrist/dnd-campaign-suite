// MA-1260: Oni "Shape-Shift" chip — pre-fix the row carried junk
// attack_bonus:0 and rendered a SOLE "+0" mc-dice-link that rolled a bogus
// to-hit (live audit: roll/attack name:'Shape-Shift', lastAttack ABSENT).
// DATA fix removes attack_bonus (key absent — imp MA-1020 twin byte-shape)
// and authors monster_shape_shift automation → ShapeShiftLink arms ONE
// mc-dice-link-shapeshift chip; NO "+0" attack chip may ever render again.
// At Will: no uses counter, no spent class.
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import { isMonsterShapeShiftRow } from '../../services/encounters/monsterShapeShift.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const oni = monsters.find(m => m.index === 'oni');
const SHAPE_ROW = oni.actions[3];
const CLAW_ROW = oni.actions[1];

function renderRow(action, overrides = {}) {
  const onShapeShiftRow = vi.fn();
  const onAttack = vi.fn();
  const utils = render(
    <MonsterAction
      action={action}
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
      {...overrides}
    />
  );
  return { ...utils, onShapeShiftRow, onAttack };
}

describe('MA-1260 Oni Shape-Shift chip', () => {
  it('arms one chip "Shape-Shift" (mc-dice-link-shapeshift); click routes onShapeShiftRow(action)', () => {
    const { container, onShapeShiftRow } = renderRow(SHAPE_ROW);
    const chips = [...container.querySelectorAll('.mc-dice-link-shapeshift')];
    expect(chips.length).toBe(1);
    expect(chips[0].textContent.trim()).toBe('Shape-Shift');
    expect(chips[0].getAttribute('role')).toBe('button');
    expect(chips[0].getAttribute('title')).toContain('Humanoid / Giant / True Form');
    fireEvent.click(chips[0]);
    expect(onShapeShiftRow).toHaveBeenCalledTimes(1);
    expect(onShapeShiftRow.mock.calls[0]).toEqual([SHAPE_ROW]);
  });

  it('junk "+0" attack chip SUPPRESSED: no mc-dice-link outside the shapeshift chip, onAttack never armed', () => {
    const { container, onAttack } = renderRow(SHAPE_ROW);
    expect(isMonsterShapeShiftRow(SHAPE_ROW)).toBe(true);
    const links = [...container.querySelectorAll('.mc-dice-link')];
    expect(links.every(l => l.classList.contains('mc-dice-link-shapeshift'))).toBe(true);
    expect(container.textContent).not.toContain('+0');
    expect(links.find(l => l.textContent.trim() === '+0')).toBeUndefined();
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('prose stays rendered beside the chip; At Will — no uses counter, no spent class', () => {
    const { container } = renderRow(SHAPE_ROW);
    expect(container.textContent).toContain('shape-shifts into a Small or Medium Humanoid');
    expect(container.textContent).not.toContain('left)');
    expect(container.querySelector('.mc-dice-link-shapeshift').className).not.toContain('mc-dice-link-spell-spent');
  });

  it('incapacitated attacker: chip visible, click inert', () => {
    const { container, onShapeShiftRow } = renderRow(SHAPE_ROW, { attackerCannotAct: true });
    const chip = container.querySelector('.mc-dice-link-shapeshift');
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(onShapeShiftRow).not.toHaveBeenCalled();
  });

  it('byte-inert sibling: Claw renders zero shape-shift chips', () => {
    expect(isMonsterShapeShiftRow(CLAW_ROW)).toBe(false);
    expect(renderRow(CLAW_ROW).container.querySelectorAll('.mc-dice-link-shapeshift').length).toBe(0);
  });
});
