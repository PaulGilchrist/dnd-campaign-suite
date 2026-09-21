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
import { isMonsterSelfBuffRow, selfBuffRounds } from '../../services/encounters/monsterSelfBuff.js';

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

  it('STR weapon rows arm no self-buff chip', () => {
    const { container } = renderRow(WAR_PICK);
    expect(container.querySelector('.mc-dice-link-selfbuff')).toBeNull();
  });
});

// MA-0658: Duergar "Invisibility" rides the SAME self-buff chip seam —
// automation:{type:"monster_self_buff", effect:"invisible", rounds:600}
// arms .mc-dice-link-selfbuff with the eye-slash icon + uses counter,
// routing the modal's resolveMonsterSelfBuffRow (te invisible on self +
// ONE merged rounds:600 clock + spend; §70 invisibility adjudication).
describe('MA-0658 Invisibility self-buff chip', () => {
  const INVIS_ROW = duergar.actions.find(a => a.name === 'Invisibility');

  it('row authors the monster_self_buff automation (no parallel type)', () => {
    expect(INVIS_ROW.automation).toEqual({ type: 'monster_self_buff', effect: 'invisible', rounds: 600 });
    expect(INVIS_ROW.uses).toBe(1);
    expect(INVIS_ROW.maxUses).toBe(1);
    expect(isMonsterSelfBuffRow(INVIS_ROW)).toBe(true);
    expect(selfBuffRounds(INVIS_ROW)).toBe(600);
    expect(INVIS_ROW.usage).toEqual({ type: 'recharge after rest', rest_types: ['short', 'long'] });
  });

  it('arms a clickable self-buff chip with eye-slash icon + uses counter', () => {
    const { container, onSelfBuffRow } = renderRow(INVIS_ROW);
    const chip = container.querySelector('.mc-dice-link-selfbuff');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('Invisibility');
    expect(chip.textContent).toContain('(1/Day · 1 left)');
    expect(chip.querySelector('i').className).toContain('fa-eye-slash');
    expect(chip.getAttribute('title')).toContain('te invisible on self, 600 rounds');
    fireEvent.click(chip);
    expect(onSelfBuffRow).toHaveBeenCalledTimes(1);
    expect(onSelfBuffRow.mock.calls[0][0]).toBe(INVIS_ROW);
  });

  it('spent row shows 0 left + spent class and stays clickable for honest refusal', () => {
    const { container, onSelfBuffRow } = renderRow(INVIS_ROW, { spellUsesUsed: { Invisibility: 1 } });
    const chip = container.querySelector('.mc-dice-link-selfbuff');
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    expect(chip.textContent).toContain('0 left');
    fireEvent.click(chip);
    expect(onSelfBuffRow).toHaveBeenCalledTimes(1);
  });
});
