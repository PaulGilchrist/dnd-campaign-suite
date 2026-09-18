// @improved-by-ai
// MA-0325: Azer Warhammer two-handed variant — GM-adjudicated damage-dice
// CHOICE on the monster attack HIT popup (MA-0007 offer-on-result shape,
// monsters.json damage_dice_two_handed). ALTERNATIVE primary dice, offered on
// HIT only; one-handed rows never render the chooser (byte-inert guardrail).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiceRollResult from './DiceRollResult.jsx';

const OFFER = {
  formula: '1d10 + 3',
  baseFormula: '1d8 + 3',
  damageType: 'bludgeoning',
  label: 'Two-Handed: 1d10 + 3 bludgeoning?',
  attackName: 'Warhammer',
};

function renderAttackPopup(props = {}) {
  return render(
    <DiceRollResult
      name="Warhammer"
      type="d20"
      rollType="attack"
      rolls={[16]}
      bonus={5}
      targetName="AberrantSorcerer"
      twoHandedVariantOffer={OFFER}
      {...props}
    />
  );
}

describe('MA-0325 two-handed variant chooser gate (DiceRollResult)', () => {
  it('offers the two-handed choice on a HIT', () => {
    renderAttackPopup({ hit: true });
    expect(screen.getByRole('button', { name: /Two-Handed: 1d10 \+ 3 bludgeoning/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /One-Handed: 1d8 \+ 3 bludgeoning/ })).toBeInTheDocument();
  });

  it('does NOT offer the choice on a MISS', () => {
    renderAttackPopup({ hit: false });
    expect(screen.queryByRole('button', { name: /Handed/i })).not.toBeInTheDocument();
  });

  it('does NOT offer the choice on an auto-miss', () => {
    renderAttackPopup({ hit: false, isAutoMiss: true });
    expect(screen.queryByRole('button', { name: /Handed/i })).not.toBeInTheDocument();
  });

  it('does NOT offer the choice when the row has no damage_dice_two_handed', () => {
    renderAttackPopup({ hit: true, twoHandedVariantOffer: null });
    expect(screen.queryByRole('button', { name: /Handed/i })).not.toBeInTheDocument();
  });

  it('hides both buttons and shows a two-handed notice once picked', () => {
    renderAttackPopup({ hit: true, twoHandedVariantResolved: 'two-handed' });
    expect(screen.queryByRole('button', { name: /Handed: /i })).not.toBeInTheDocument();
    expect(screen.getByText(/Two-Handed applied \(1d10 \+ 3 bludgeoning\)\./)).toBeInTheDocument();
  });

  it('hides both buttons and shows a one-handed notice once picked', () => {
    renderAttackPopup({ hit: true, twoHandedVariantResolved: 'one-handed' });
    expect(screen.queryByRole('button', { name: /Handed: /i })).not.toBeInTheDocument();
    expect(screen.getByText(/One-Handed applied \(1d8 \+ 3 bludgeoning\)\./)).toBeInTheDocument();
  });

  it('invokes onTwoHandedVariant(\'two-handed\') when the two-handed button is clicked', () => {
    const onTwoHandedVariant = vi.fn();
    renderAttackPopup({ hit: true, onTwoHandedVariant });
    fireEvent.click(screen.getByRole('button', { name: /Two-Handed: 1d10 \+ 3/i }));
    expect(onTwoHandedVariant).toHaveBeenCalledTimes(1);
    expect(onTwoHandedVariant).toHaveBeenCalledWith('two-handed');
  });

  it('invokes onTwoHandedVariant(\'one-handed\') when the one-handed button is clicked', () => {
    const onTwoHandedVariant = vi.fn();
    renderAttackPopup({ hit: true, onTwoHandedVariant });
    fireEvent.click(screen.getByRole('button', { name: /One-Handed: 1d8 \+ 3/i }));
    expect(onTwoHandedVariant).toHaveBeenCalledTimes(1);
    expect(onTwoHandedVariant).toHaveBeenCalledWith('one-handed');
  });
});
