// MA-0882: Gnoll Pack Lord "Incite Rampage" chip — automation:{type:
// "monster_grant_reaction", effect:"incite_rampage", range_ft:60} arms a
// clickable .mc-dice-link-grantreaction affordance on the formerly inert row
// (text + cosmetic <em> (5-6)</em> only), routing the modal's recharge-gated
// grant-reaction adjudication. A spent recharge row gets the existing
// mc-dice-link-spell-spent class and stays clickable so the click routes the
// honest "Not Recharged" refusal (MA-0031/MA-0648 precedents).
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const packLord = monsters.find(m => m.index === 'gnoll-pack-lord');
const INCITE_ROW = packLord.actions[3];

function renderRow(action, overrides = {}) {
  const onGrantReactionRow = vi.fn();
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
      onGrantReactionRow={onGrantReactionRow}
      {...overrides}
    />
  );
  return { ...utils, onGrantReactionRow };
}

describe('MA-0882 Incite Rampage chip', () => {
  it('arms a clickable grant-reaction chip on the row', () => {
    const { container, onGrantReactionRow } = renderRow(INCITE_ROW);
    const chip = container.querySelector('.mc-dice-link-grantreaction');
    expect(chip).toBeTruthy();
    expect(chip.getAttribute('role')).toBe('button');
    expect(chip.textContent).toContain('Incite');
    expect(chip.getAttribute('title')).toContain('incite_rampage');
    expect(chip.getAttribute('title')).toContain('60');
    fireEvent.click(chip);
    expect(onGrantReactionRow).toHaveBeenCalledTimes(1);
    expect(onGrantReactionRow.mock.calls[0][0]).toBe(INCITE_ROW);
  });

  it('spent recharge: spent class, still clickable for honest refusal', () => {
    const { container, onGrantReactionRow } = renderRow(INCITE_ROW, { rechargeState: { 'Incite Rampage': { recharged: false, threshold: 5 } } });
    const chip = container.querySelector('.mc-dice-link-grantreaction');
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    fireEvent.click(chip);
    expect(onGrantReactionRow).toHaveBeenCalledTimes(1);
  });

  it('incapacitated attacker: chip inert', () => {
    const { container, onGrantReactionRow } = renderRow(INCITE_ROW, { attackerCannotAct: true });
    const chip = container.querySelector('.mc-dice-link-grantreaction');
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(onGrantReactionRow).not.toHaveBeenCalled();
  });

  it('attack rows arm no grant-reaction chip (Bone Whip byte-inert)', () => {
    const whip = packLord.actions.find(a => a.name === 'Bone Whip');
    const { container } = renderRow(whip);
    expect(container.querySelector('.mc-dice-link-grantreaction')).toBeNull();
  });
});
