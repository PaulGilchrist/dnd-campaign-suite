// @improved-by-ai
// MA-0436: Bugbear Javelin melee-or-ranged dual-mode variant — GM-adjudicated
// damage-dice CHOICE on the monster attack HIT popup (monsters.json
// damage_dice_ranged; MA-0325 two-handed mirror, MA-0007 offer-on-result
// shape). ALTERNATIVE primary dice, offered on HIT only; non-variant rows
// never render the chooser (byte-inert guardrail).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiceRollResult from './DiceRollResult.jsx';

const OFFER = {
  formula: '1d6 + 2',
  baseFormula: '2d6 + 2',
  damageType: 'Piercing',
  label: 'Ranged: 1d6 + 2 Piercing?',
  attackName: 'Javelin',
  range: '30/120',
  normalFt: 30,
  longFt: 120,
};

function renderAttackPopup(props = {}) {
  return render(
    <DiceRollResult
      name="Javelin"
      type="d20"
      rollType="attack"
      rolls={[19]}
      bonus={4}
      targetName="AasimarTest"
      rangedVariantOffer={OFFER}
      {...props}
    />
  );
}

describe('MA-0436 ranged variant chooser gate (DiceRollResult)', () => {
  it('offers the melee-vs-ranged choice on a HIT', () => {
    renderAttackPopup({ hit: true });
    expect(screen.getByRole('button', { name: /Ranged: 1d6 \+ 2 Piercing/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Melee: 2d6 \+ 2 Piercing/ })).toBeInTheDocument();
  });

  it('does NOT offer the choice on a MISS', () => {
    renderAttackPopup({ hit: false });
    expect(screen.queryByRole('button', { name: /Ranged: |Melee: /i })).not.toBeInTheDocument();
  });

  it('does NOT offer the choice on an auto-miss', () => {
    renderAttackPopup({ hit: false, isAutoMiss: true });
    expect(screen.queryByRole('button', { name: /Ranged: |Melee: /i })).not.toBeInTheDocument();
  });

  it('does NOT offer the choice when the row has no damage_dice_ranged', () => {
    renderAttackPopup({ hit: true, rangedVariantOffer: null });
    expect(screen.queryByRole('button', { name: /Ranged: |Melee: /i })).not.toBeInTheDocument();
  });

  it('hides both buttons and shows a ranged notice once picked', () => {
    renderAttackPopup({ hit: true, rangedVariantResolved: 'ranged' });
    expect(screen.queryByRole('button', { name: /Ranged: |Melee: /i })).not.toBeInTheDocument();
    expect(screen.getByText(/Ranged applied \(1d6 \+ 2 Piercing\)\./)).toBeInTheDocument();
  });

  it('hides both buttons and shows a melee notice once picked', () => {
    renderAttackPopup({ hit: true, rangedVariantResolved: 'melee' });
    expect(screen.queryByRole('button', { name: /Ranged: |Melee: /i })).not.toBeInTheDocument();
    expect(screen.getByText(/Melee applied \(2d6 \+ 2 Piercing\)\./)).toBeInTheDocument();
  });

  it('invokes onRangedVariant(\'ranged\') when the ranged button is clicked', () => {
    const onRangedVariant = vi.fn();
    renderAttackPopup({ hit: true, onRangedVariant });
    fireEvent.click(screen.getByRole('button', { name: /Ranged: 1d6 \+ 2/i }));
    expect(onRangedVariant).toHaveBeenCalledTimes(1);
    expect(onRangedVariant).toHaveBeenCalledWith('ranged');
  });

  it('invokes onRangedVariant(\'melee\') when the melee button is clicked', () => {
    const onRangedVariant = vi.fn();
    renderAttackPopup({ hit: true, onRangedVariant });
    fireEvent.click(screen.getByRole('button', { name: /Melee: 2d6 \+ 2/i }));
    expect(onRangedVariant).toHaveBeenCalledTimes(1);
    expect(onRangedVariant).toHaveBeenCalledWith('melee');
  });
});
