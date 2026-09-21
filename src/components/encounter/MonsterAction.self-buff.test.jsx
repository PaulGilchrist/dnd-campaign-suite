// MA-0655: Duergar "Enlarge" chip — automation:{type:"monster_self_buff"}
// arms a clickable .mc-dice-link-selfbuff self-grant affordance on the
// formerly inert row, routing the modal's resolveMonsterSelfBuffRow
// (te enlarged on self + spend + one merged clock). The uses counter rides
// the MA-0020 monsterSpellUses gate; exhausted chips keep the spent class
// and stay clickable so the click routes the honest refusal (summon twin).
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const duergar = monsters.find(m => m.index === 'duergar');
const ENLARGE_ROW = duergar.actions[0];
const WAR_PICK = duergar.actions.find(a => a.name === 'War Pick');

function renderRow(action, overrides = {}) {
  const onSelfBuffRow = vi.fn();
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
      onSelfBuffRow={onSelfBuffRow}
      {...overrides}
    />
  );
  return { ...utils, onSelfBuffRow };
}

describe('MA-0655 Enlarge self-buff chip', () => {
  it('arms a clickable self-buff chip with the uses counter', () => {
    const { container, onSelfBuffRow } = renderRow(ENLARGE_ROW);
    const chip = container.querySelector('.mc-dice-link-selfbuff');
    expect(chip).toBeTruthy();
    expect(chip.getAttribute('role')).toBe('button');
    expect(chip.textContent).toContain('Enlarge');
    expect(chip.textContent).toContain('(1/Day · 1 left)');
    fireEvent.click(chip);
    expect(onSelfBuffRow).toHaveBeenCalledTimes(1);
    expect(onSelfBuffRow.mock.calls[0][0]).toBe(ENLARGE_ROW);
  });

  it('spent row shows 0 left + spent class and stays clickable for honest refusal', () => {
    const { container, onSelfBuffRow } = renderRow(ENLARGE_ROW, { spellUsesUsed: { Enlarge: 1 } });
    const chip = container.querySelector('.mc-dice-link-selfbuff');
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    expect(chip.textContent).toContain('0 left');
    fireEvent.click(chip);
    expect(onSelfBuffRow).toHaveBeenCalledTimes(1);
  });

  it('incapacitated attacker: chip inert', () => {
    const { container, onSelfBuffRow } = renderRow(ENLARGE_ROW, { attackerCannotAct: true });
    const chip = container.querySelector('.mc-dice-link-selfbuff');
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(onSelfBuffRow).not.toHaveBeenCalled();
  });

  it('STR weapon + other rows arm no self-buff chip', () => {
    const { container } = renderRow(WAR_PICK);
    expect(container.querySelector('.mc-dice-link-selfbuff')).toBeNull();
    const invis = duergar.actions.find(a => a.name === 'Invisibility');
    expect(renderRow(invis).container.querySelector('.mc-dice-link-selfbuff')).toBeNull();
  });
});
