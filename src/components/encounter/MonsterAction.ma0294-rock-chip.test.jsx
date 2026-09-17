// MA-0294: recharge spent styling on ATTACK-roll chips. The attack chip was
// ungated (rechargeOut consumed only by ActionSaveRoll/RechargeNote). A spent
// Rock (Recharge 6) row must style its +5 attack chip with the existing
// mc-dice-link-spell-spent class (save-chip precedent), keep the
// "(Recharge 6 — unavailable)" note, and stay clickable so the click routes
// to handleAttack's honest refusal popup/log. Fresh/recharged rows are
// byte-unchanged (no spent class).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';

const ROCK = {
  name: 'Rock (Recharge 6)',
  description: 'Ranged Weapon Attack: +5 to hit, range 50/250 ft., one target. Hit: 7 (2d6) bludgeoning damage.',
  attack_bonus: 5,
  damage_dice_primary: '2d6',
  damage_type_primary: 'Bludgeoning',
  recharge: '6',
};

function renderRock(rechargeState) {
  const onAttack = vi.fn();
  const utils = render(
    <MonsterAction
      action={ROCK}
      index={0}
      attackerCannotAct={false}
      onAttack={onAttack}
      onDamage={vi.fn()}
      onSaveRoll={vi.fn()}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={vi.fn()}
      rechargeState={rechargeState}
    />
  );
  return { ...utils, onAttack };
}

function attackChip(container) {
  return container.querySelector('.mc-dice-link .fa-dice-d20')?.closest('.mc-dice-link') || null;
}

describe('MA-0294 attack-chip recharge spent styling', () => {
  it('spent row: attack chip carries mc-dice-link-spell-spent + unavailable note, click still routes to handleAttack', () => {
    const { container, onAttack } = renderRock({ 'Rock': { recharged: false, threshold: 6 } });
    const chip = attackChip(container);
    expect(chip).toBeTruthy();
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    expect(container.textContent).toContain('(Recharge 6 — unavailable)');
    fireEvent.click(chip);
    expect(onAttack).toHaveBeenCalledWith('Rock (Recharge 6)', 5, ROCK);
  });

  it('recharged row: no spent class, label stays "(Recharge 6)", click fires', () => {
    const { container, onAttack } = renderRock({ 'Rock': { recharged: true, threshold: 6 } });
    const chip = attackChip(container);
    expect(chip.className).not.toContain('mc-dice-link-spell-spent');
    expect(container.textContent).toContain('(Recharge 6)');
    expect(container.textContent).not.toContain('unavailable');
    fireEvent.click(chip);
    expect(onAttack).toHaveBeenCalledTimes(1);
  });

  it('fresh row (no stored map): chip byte-unchanged plain mc-dice-link', () => {
    const { container } = renderRock({});
    const chip = attackChip(container);
    expect(chip.className).toBe('mc-dice-link');
    expect(container.textContent).toContain('(Recharge 6)');
    expect(container.textContent).not.toContain('unavailable');
  });
});
