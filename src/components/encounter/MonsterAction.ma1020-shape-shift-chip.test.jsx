// MA-1020: Imp "Shape-Shift" chip — the formerly-dead prose row (MA-1020
// audit: 0 buttons / 0 mc-dice-link / 0 pointer-cursor children in the open
// stat modal) now arms ShapeShiftLink off automation.type ===
// "monster_shape_shift" (MonsterAction.jsx), mirroring the MA-0655
// SelfBuffLink mount pattern at :224+. SelfBuffLink stays gated to
// monster_self_buff (byte-verified below); no other chip lane arms the row
// (no attack_bonus / save_dc / dice / Spellcasting name / zone / rays —
// every pre-existing gate stays byte-inert). At Will: no uses counter, no
// spent class. Click routes onShapeShiftRow(action) → the modal's
// ShapeShiftModal chooser → monsterShapeShift resolver (cs Speed stamp).
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import { isMonsterShapeShiftRow } from '../../services/encounters/monsterShapeShift.js';
import { isMonsterSelfBuffRow } from '../../services/encounters/monsterSelfBuff.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const imp = monsters.find(m => m.index === 'imp');
const SHAPE_ROW = imp.actions[2];
const STING_ROW = imp.actions[0];
const INVIS_ROW = imp.actions[1];

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
  it('arms one chip "Shape-Shift" (mc-dice-link-shapeshift); click routes onShapeShiftRow(action)', () => {
    const { container, onShapeShiftRow } = renderRow(SHAPE_ROW);
    const chips = [...container.querySelectorAll('.mc-dice-link-shapeshift')];
    expect(chips.length).toBe(1);
    expect(chips[0].textContent.trim()).toBe('Shape-Shift');
    expect(chips[0].getAttribute('role')).toBe('button');
    expect(chips[0].getAttribute('title')).toContain('Rat / Raven / Spider / True Form');
    fireEvent.click(chips[0]);
    expect(onShapeShiftRow).toHaveBeenCalledTimes(1);
    expect(onShapeShiftRow.mock.calls[0]).toEqual([SHAPE_ROW]);
  });

  it('prose stays rendered beside the chip; At Will — no uses counter, no spent class', () => {
    const { container } = renderRow(SHAPE_ROW);
    expect(container.textContent).toContain('shape-shifts');
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

  it('no handler: chip visible, click inert (no throw — clickable guard matches SelfBuffLink)', () => {
    const { container } = renderRow(SHAPE_ROW, { onShapeShiftRow: undefined });
    const chip = container.querySelector('.mc-dice-link-shapeshift');
    expect(chip).toBeTruthy();
    expect(() => fireEvent.click(chip)).not.toThrow();
  });

  it('SelfBuffLink stays gated to monster_self_buff — imp Invisibility row never arms the shape-shift chip', () => {
    expect(isMonsterSelfBuffRow(INVIS_ROW)).toBe(true);
    expect(isMonsterShapeShiftRow(INVIS_ROW)).toBe(false);
    const { container } = renderRow(INVIS_ROW);
    expect(container.querySelectorAll('.mc-dice-link-shapeshift').length).toBe(0);
    expect(container.querySelectorAll('.mc-dice-link-selfbuff').length).toBe(1);
  });

  it('byte-inert siblings: Sting and other-automation rows render zero shape-shift chips', () => {
    expect(renderRow(STING_ROW).container.querySelectorAll('.mc-dice-link-shapeshift').length).toBe(0);
    const summon = monsters.find(m => m.index === 'drow-mage').actions.find(a => a.name === 'Summon Demon');
    expect(renderRow(summon).container.querySelectorAll('.mc-dice-link-shapeshift').length).toBe(0);
  });
});
