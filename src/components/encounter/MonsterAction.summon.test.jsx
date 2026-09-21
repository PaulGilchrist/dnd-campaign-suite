// MA-0648: Drow Mage "Summon Demon" chip — automation:{type:"monster_summon"}
// arms a clickable .mc-dice-link-summon affordance on the formerly inert row,
// routing the modal's coin-flip summon adjudication. The 1/Day counter rides
// the MA-0020 monsterSpellUses gate; exhausted chips keep the spent class and
// stay clickable so the click routes the honest refusal (zone-aura precedent).
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const drowMage = monsters.find(m => m.index === 'drow-mage');
const SUMMON_ROW = drowMage.actions.find(a => a.name === 'Summon Demon');

function renderRow(action, overrides = {}) {
  const onSummonRow = vi.fn();
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
      onSummonRow={onSummonRow}
      {...overrides}
    />
  );
  return { ...utils, onSummonRow };
}

describe('MA-0648 Summon Demon chip', () => {
  it('arms a clickable summon chip with the 1/Day counter', () => {
    const { container, onSummonRow } = renderRow(SUMMON_ROW);
    const chip = container.querySelector('.mc-dice-link-summon');
    expect(chip).toBeTruthy();
    expect(chip.getAttribute('role')).toBe('button');
    expect(chip.textContent).toContain('Summon');
    expect(chip.textContent).toContain('(1/Day · 1 left)');
    fireEvent.click(chip);
    expect(onSummonRow).toHaveBeenCalledTimes(1);
    expect(onSummonRow.mock.calls[0][0]).toBe(SUMMON_ROW);
  });

  it('spent row shows 0 left + spent class and stays clickable for honest refusal', () => {
    const { container, onSummonRow } = renderRow(SUMMON_ROW, { spellUsesUsed: { 'Summon Demon': 1 } });
    const chip = container.querySelector('.mc-dice-link-summon');
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    expect(chip.textContent).toContain('0 left');
    fireEvent.click(chip);
    expect(onSummonRow).toHaveBeenCalledTimes(1);
  });

  it('incapacitated attacker: chip inert', () => {
    const { container, onSummonRow } = renderRow(SUMMON_ROW, { attackerCannotAct: true });
    const chip = container.querySelector('.mc-dice-link-summon');
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(onSummonRow).not.toHaveBeenCalled();
  });

  it('non-summon rows arm no summon chip (Staff row byte-inert)', () => {
    const staff = drowMage.actions.find(a => a.name === 'Staff');
    const { container } = renderRow(staff);
    expect(container.querySelector('.mc-dice-link-summon')).toBeNull();
  });
});
