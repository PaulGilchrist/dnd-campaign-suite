// MA-0855: Githzerai Psion Psychic Warp — GM-adjudicated CONDITION CHOICE on
// the monster attack HIT popup (monsters.json hit_choice — Charmed-or-Prone).
// MA-0325 two-handed chooser mirror: one button per option, HIT-only, resolved
// notice once picked. Byte-inert when there is no hitChoiceOffer, and never
// rendered on a miss/auto-miss (over-granting both is RAW-wrong).
// Lane notes: handler payload contracts live in handlers.test.js for the
// reroll/bardic/empowered seams — onHitChoice has no coverage there, so the
// click→payload path stays here. Charge offer gate → charge-bonus.test.jsx;
// display lines → combatDisplay.test.jsx.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiceRollResult from './DiceRollResult.jsx';

const OFFER = {
  options: ['charmed', 'prone'],
  label: 'Condition Choice: Charmed or Prone',
  note: 'Prone requires Large or smaller',
  attackName: 'Psychic Warp',
};

function renderAttackPopup(props = {}) {
  return render(
    <DiceRollResult
      name="Psychic Warp"
      type="d20"
      rollType="attack"
      rolls={[17]}
      bonus={8}
      targetName="Bandit 1"
      hitChoiceOffer={OFFER}
      {...props}
    />
  );
}

describe('MA-0855 condition-choice chooser gate (DiceRollResult)', () => {
  it('offers one exact-name button per option on a HIT, with no resolved notice', () => {
    renderAttackPopup({ hit: true });
    expect(screen.getByRole('button', { name: 'Charmed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prone' })).toBeInTheDocument();
    expect(screen.queryByText(/applied \(Psychic Warp GM choice\)\./)).not.toBeInTheDocument();
  });

  // Gate table: the chooser is offered HIT-only and only when the row carries
  // a hit_choice offer. Auto-miss is asserted over hit:true — a natural 1
  // must never offer the choice even if a stale hit flag arrives.
  it.each([
    ['a MISS', { hit: false }],
    ['an auto-miss overriding hit:true', { hit: true, isAutoMiss: true }],
    ['a row with no hit_choice offer', { hit: true, hitChoiceOffer: null }],
  ])('does NOT offer the choice on %s', (_case, props) => {
    renderAttackPopup(props);
    expect(screen.queryByRole('button', { name: /charmed|prone/i })).not.toBeInTheDocument();
  });

  // Resolved state replaces the buttons with a single notice naming the one
  // granted condition (auto-grant of both is suppressed upstream — RAW).
  it.each([
    ['charmed', 'Charmed applied (Psychic Warp GM choice).'],
    ['prone', 'Prone applied (Psychic Warp GM choice).'],
  ])('replaces both buttons with the exact resolved notice once %s is picked', (resolved, notice) => {
    renderAttackPopup({ hit: true, hitChoiceResolved: resolved });
    expect(screen.queryByRole('button', { name: /charmed|prone/i })).not.toBeInTheDocument();
    expect(screen.getByText(notice)).toBeInTheDocument();
  });

  // Click contract: raw lowercase option id (not the capitalized label) is
  // forwarded so the modal can resolve exactly that condition.
  it.each([
    ['Charmed', 'charmed'],
    ['Prone', 'prone'],
  ])('invokes onHitChoice with the raw id when the %s button is clicked', (label, payload) => {
    const onHitChoice = vi.fn();
    renderAttackPopup({ hit: true, onHitChoice });
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(onHitChoice).toHaveBeenCalledWith(payload);
  });
});
