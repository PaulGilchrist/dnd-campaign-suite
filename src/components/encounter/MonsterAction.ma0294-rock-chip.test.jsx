// @maintained-by-ai
// MA-0294 (component unit lane): recharge-spent styling on the ATTACK-roll
// chip. The attack chip was ungated (rechargeOut previously consumed only by
// ActionSaveRoll/RechargeNote). A spent Rock (Recharge 6) row must style its
// +5 chip byte-exact 'mc-dice-link mc-dice-link-spell-spent' (save-chip
// precedent), read "(Recharge 6 — unavailable)", and stay clickable — spent ≠
// disabled: the click routes the exact onAttack payload downstream, where
// handleAttack's honest refusal popup/log lives (integration + economy owned
// by MonsterCardModal.ma0294-rock-attack-recharge.test.jsx; gated-reaction
// spent≠disabled precedent #417; auto-hit damage-chip suppression boundary
// owned by MonsterAction.ma0286-slam-suppression.test.jsx). Exactly one
// press surface per row: the row's authored 2d6 + 3 never becomes a second
// (auto-hit) damage chip because attack_bonus is present.
import { readFileSync } from 'node:fs';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';

// Disk row located by name — verbatim data (Ape "Rock (Recharge 6)").
const ROCK = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'))
  .find(m => m.index === 'ape').actions.find(a => a.name === 'Rock (Recharge 6)');

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

describe('MA-0294 attack-chip recharge spent styling (Rock, disk verbatim)', () => {
  it('spent row: chip className byte-exact spent, row reads "(Recharge 6 — unavailable)", sole press surface stays live and routes the exact attack payload once', () => {
    expect(ROCK.attack_bonus).toBe(5);
    expect(ROCK.recharge).toBe('6');
    expect(ROCK.damage_dice_primary).toBe('2d6 + 3');
    const { container, onAttack } = renderRock({ 'Rock': { recharged: false, threshold: 6 } });
    const chips = screen.getAllByRole('button');
    expect(chips).toHaveLength(1);
    expect(chips[0].className).toBe('mc-dice-link mc-dice-link-spell-spent');
    expect(chips[0].textContent).toContain('+5');
    expect(container.textContent).toContain('(Recharge 6 — unavailable)');
    fireEvent.click(chips[0]);
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Rock (Recharge 6)', 5, ROCK);
  });

  it.each([
    ['fresh — no stored map', {}],
    ['recharged — map says true', { 'Rock': { recharged: true, threshold: 6 } }],
  ])('available (%s): chip className byte-exact plain, label stays "(Recharge 6)", click routes the exact attack payload once', (_leg, rechargeState) => {
    const { container, onAttack } = renderRock(rechargeState);
    const chips = screen.getAllByRole('button');
    expect(chips).toHaveLength(1);
    expect(chips[0].className).toBe('mc-dice-link');
    expect(container.textContent).toContain('(Recharge 6)');
    expect(container.textContent).not.toContain('unavailable');
    fireEvent.click(chips[0]);
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Rock (Recharge 6)', 5, ROCK);
  });
});
