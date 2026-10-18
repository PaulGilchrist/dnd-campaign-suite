// MA-0006 component lane: the Feather Fall gated-reaction row's press surface on the
// monster card (previously inert — no affordance, zero consumers). Pins ONLY the
// GatedReactionSlot/GatedReactionLink props path: registry arming (getGatedMonsterReaction),
// live counter + spent class from the reactionUsesUsed prop, and the attackerCannotAct
// click-armed leg (closed gate: chip renders, click dispatches NOTHING — #289).
// Trigger identity, round latch, spend arithmetic and refusal logging live in
// MonsterCardHelpers.gated-reaction.test.js — never restated here. Consumed→closed
// is prop-derived at campaign seams; no wall-clock anywhere (strictly turn-based).
// @maintained-by-ai
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import { getGatedMonsterReaction } from './MonsterCardHelpers.js';

const FEATHER_FALL_ACTION = {
  name: 'Feather Fall (1/Day)',
  description: 'The aarakocra casts <strong>Feather Fall</strong> in response to that spell\'s trigger.',
  usage: '1/Day',
  uses: 1,
  maxUses: 1,
  automation: { type: 'reaction', trigger: 'falling', effect: 'feather_fall' },
};

// Registry constants (label/icon) read verbatim via the same helper the component uses —
// never hand-authored (#387).
const def = getGatedMonsterReaction(FEATHER_FALL_ACTION);

function renderRow(action = FEATHER_FALL_ACTION, overrides = {}) {
  const onGatedReaction = vi.fn();
  render(
    <MonsterAction
      action={action}
      index={0}
      attackerCannotAct={false}
      onAttack={vi.fn()}
      onDamage={vi.fn()}
      onSaveRoll={vi.fn()}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={onGatedReaction}
      {...overrides}
    />
  );
  return { onGatedReaction };
}

describe('MA-0006 MonsterAction gated reaction row — press truth-table', () => {
  it.each([
    ['gate open (fresh 1/Day) dispatches the exact action once', {}, { dispatches: true, spent: false, counter: '(1 left)' }],
    ['consumed (1/Day spent) stays clickable — spent class reads 0 left, honest refusal lives downstream', { reactionUsesUsed: { feather_fall: 1 } }, { dispatches: true, spent: true, counter: '(0 left)' }],
    ['gate closed (attackerCannotAct) renders the chip but clicks dispatch nothing', { attackerCannotAct: true }, { dispatches: false, spent: false, counter: '(1 left)' }],
  ])('%s', (_case, overrides, { dispatches, spent, counter }) => {
    const { onGatedReaction } = renderRow(FEATHER_FALL_ACTION, overrides);
    const chip = screen.getByRole('button', { name: new RegExp(def.label) });
    expect(chip.textContent).toContain(counter);
    expect(chip.querySelector(`.${def.icon}`)).toBeTruthy();
    expect(chip.className.includes('mc-dice-link-spell-spent')).toBe(spent);
    fireEvent.click(chip);
    if (dispatches) {
      expect(onGatedReaction).toHaveBeenCalledTimes(1);
      expect(onGatedReaction).toHaveBeenCalledWith(FEATHER_FALL_ACTION);
    } else {
      expect(onGatedReaction).not.toHaveBeenCalled();
    }
  });

  it('non-gated rows arm no reaction affordance', () => {
    const { onGatedReaction } = renderRow({ name: 'Talon', description: 'Melee Weapon Attack.' });
    expect(screen.queryByRole('button', { name: new RegExp(def.label) })).toBeNull();
    expect(onGatedReaction).not.toHaveBeenCalled();
  });
});
