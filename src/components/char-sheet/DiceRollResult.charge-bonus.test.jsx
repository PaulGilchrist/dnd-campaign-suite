// @improved-by-ai
// MA-0007: Aarakocra Skirmisher Talons charge-damage clause — the GM-adjudication
// offer ("30+ ft Charge: +3d4+2 Slashing?") rides the monster attack result popup
// (CLA-325 advisory + CLA-352 offer-on-result pattern). Offer on HIT only.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiceRollResult from './DiceRollResult.jsx';

const OFFER = {
  dice: '3d4',
  modifier: 2,
  damageType: 'Slashing',
  condition: 'moved 30+ feet straight toward target immediately before the hit',
  formula: '3d4 + 2',
  label: '30+ ft Charge: +3d4+2 Slashing?',
  attackName: 'Talons',
};

function renderAttackPopup(props = {}) {
  return render(
    <DiceRollResult
      name="Talons"
      type="d20"
      rollType="attack"
      rolls={[14]}
      bonus={4}
      targetName="AasimarTest"
      chargeBonusOffer={OFFER}
      {...props}
    />
  );
}

describe('MA-0007 charge bonus offer gate (DiceRollResult)', () => {
  it('offers the charge bonus on a HIT', () => {
    renderAttackPopup({ hit: true });
    expect(screen.getByRole('button', { name: /30\+ ft Charge: \+3d4\+2 Slashing\?/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /No charge \(base damage only\)/ })).toBeInTheDocument();
  });

  it('does NOT offer the charge bonus on a MISS', () => {
    renderAttackPopup({ hit: false });
    expect(screen.queryByRole('button', { name: /Charge/i })).not.toBeInTheDocument();
  });

  it('does NOT offer the charge bonus on an auto-miss', () => {
    renderAttackPopup({ hit: false, isAutoMiss: true });
    expect(screen.queryByRole('button', { name: /Charge/i })).not.toBeInTheDocument();
  });

  it('does NOT offer the charge bonus when the action has no conditional_damage', () => {
    renderAttackPopup({ hit: true, chargeBonusOffer: null });
    expect(screen.queryByRole('button', { name: /Charge/i })).not.toBeInTheDocument();
  });

  it('hides both buttons and shows a grant notice once the charge is granted', () => {
    renderAttackPopup({ hit: true, chargeBonusResolved: 'granted' });
    expect(screen.queryByRole('button', { name: /Charge/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Charge bonus applied \(\+3d4 \+ 2 Slashing\)\./)).toBeInTheDocument();
  });

  it('hides both buttons and shows a decline notice once the charge is declined', () => {
    renderAttackPopup({ hit: true, chargeBonusResolved: 'declined' });
    expect(screen.queryByRole('button', { name: /Charge/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Charge bonus declined — base damage only\./)).toBeInTheDocument();
  });

  it('invokes onChargeBonus when the grant button is clicked', () => {
    const onChargeBonus = vi.fn();
    const onChargeBonusDecline = vi.fn();
    renderAttackPopup({ hit: true, onChargeBonus, onChargeBonusDecline });
    fireEvent.click(screen.getByRole('button', { name: /30\+ ft Charge/i }));
    expect(onChargeBonus).toHaveBeenCalledTimes(1);
    expect(onChargeBonusDecline).not.toHaveBeenCalled();
  });

  it('invokes onChargeBonusDecline when the decline button is clicked', () => {
    const onChargeBonus = vi.fn();
    const onChargeBonusDecline = vi.fn();
    renderAttackPopup({ hit: true, onChargeBonus, onChargeBonusDecline });
    fireEvent.click(screen.getByRole('button', { name: /No charge/i }));
    expect(onChargeBonusDecline).toHaveBeenCalledTimes(1);
    expect(onChargeBonus).not.toHaveBeenCalled();
  });
});
