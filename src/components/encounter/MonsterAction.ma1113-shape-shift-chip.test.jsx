// MA-1113: Lizardfolk Shaman "Change Shape" chip — the formerly-dead prose
// row (pre-fix audit: plain <div class="mc-action"> with 0 interactive
// elements, 0 popups on fresh-rect clicks) now arms ShapeShiftLink off the
// MA-1020 monster_shape_shift automation byte-shape added by the DATA fix.
// Chip press routes onShapeShiftRow(action) → ShapeShiftModal chooser →
// resolveMonsterShapeShiftRow cs Speed stamp. At Will: no uses counter, no
// spent class.
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import { isMonsterShapeShiftRow } from '../../services/encounters/monsterShapeShift.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const shaman = monsters.find(m => m.index === 'lizardfolk-shaman');
const SHAPE_ROW = shaman.actions[3];
const BITE_ROW = shaman.actions[1];

function renderRow(action, overrides = {}) {
  const onShapeShiftRow = vi.fn();
  const utils = render(
    <MonsterAction
      action={action}
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
      {...overrides}
    />
  );
  return { ...utils, onShapeShiftRow };
}

describe('MA-1113 Change Shape chip', () => {
  it('arms one chip "Shape-Shift" (mc-dice-link-shapeshift); click routes onShapeShiftRow(action)', () => {
    const { container, onShapeShiftRow } = renderRow(SHAPE_ROW);
    const chips = [...container.querySelectorAll('.mc-dice-link-shapeshift')];
    expect(chips.length).toBe(1);
    expect(chips[0].textContent.trim()).toBe('Shape-Shift');
    expect(chips[0].getAttribute('role')).toBe('button');
    expect(chips[0].getAttribute('title')).toContain('Crocodile / True Form');
    fireEvent.click(chips[0]);
    expect(onShapeShiftRow).toHaveBeenCalledTimes(1);
    expect(onShapeShiftRow.mock.calls[0]).toEqual([SHAPE_ROW]);
  });

  it('prose stays rendered beside the chip; At Will — no uses counter, no spent class', () => {
    const { container } = renderRow(SHAPE_ROW);
    expect(container.textContent).toContain('polymorphs into a crocodile');
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

  it('byte-inert sibling: Bite renders zero shape-shift chips', () => {
    expect(isMonsterShapeShiftRow(BITE_ROW)).toBe(false);
    expect(renderRow(BITE_ROW).container.querySelectorAll('.mc-dice-link-shapeshift').length).toBe(0);
  });
});
