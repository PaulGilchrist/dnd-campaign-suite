// MA-0855: Githzerai Psion Psychic Warp — GM-adjudicated CONDITION CHOICE on
// the monster attack HIT popup (monsters.json hit_choice — Charmed-or-Prone).
// MA-0325 two-handed chooser mirror: one button per option, HIT-only, resolved
// notice once picked. Byte-inert when there is no hitChoiceOffer, and never
// rendered on a miss/auto-miss (over-granting both is RAW-wrong).
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
  it('offers one button per option on a HIT', () => {
    renderAttackPopup({ hit: true });
    expect(screen.getByRole('button', { name: /Charmed/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Prone/ })).toBeInTheDocument();
  });

  it('does NOT offer the choice on a MISS', () => {
    renderAttackPopup({ hit: false });
    expect(screen.queryByRole('button', { name: /Charmed/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Prone/ })).not.toBeInTheDocument();
  });

  it('does NOT offer the choice on an auto-miss', () => {
    renderAttackPopup({ hit: false, isAutoMiss: true });
    expect(screen.queryByRole('button', { name: /Charmed/ })).not.toBeInTheDocument();
  });

  it('does NOT offer the choice when the row has no hit_choice offer', () => {
    renderAttackPopup({ hit: true, hitChoiceOffer: null });
    expect(screen.queryByRole('button', { name: /Charmed/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Prone/ })).not.toBeInTheDocument();
  });

  it('hides both buttons and shows a Charmed notice once picked', () => {
    renderAttackPopup({ hit: true, hitChoiceResolved: 'charmed' });
    expect(screen.queryByRole('button', { name: /Charmed|Prone/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Charmed applied \(Psychic Warp GM choice\)\./)).toBeInTheDocument();
  });

  it('hides both buttons and shows a Prone notice once picked', () => {
    renderAttackPopup({ hit: true, hitChoiceResolved: 'prone' });
    expect(screen.queryByRole('button', { name: /Charmed|Prone/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Prone applied \(Psychic Warp GM choice\)\./)).toBeInTheDocument();
  });

  it('invokes onHitChoice(\'charmed\') when the Charmed button is clicked', () => {
    const onHitChoice = vi.fn();
    renderAttackPopup({ hit: true, onHitChoice });
    fireEvent.click(screen.getByRole('button', { name: /Charmed/ }));
    expect(onHitChoice).toHaveBeenCalledTimes(1);
    expect(onHitChoice).toHaveBeenCalledWith('charmed');
  });

  it('invokes onHitChoice(\'prone\') when the Prone button is clicked', () => {
    const onHitChoice = vi.fn();
    renderAttackPopup({ hit: true, onHitChoice });
    fireEvent.click(screen.getByRole('button', { name: /Prone/ }));
    expect(onHitChoice).toHaveBeenCalledTimes(1);
    expect(onHitChoice).toHaveBeenCalledWith('prone');
  });
});
