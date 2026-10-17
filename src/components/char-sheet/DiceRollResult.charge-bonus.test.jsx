// @maintained-by-ai
// MA-0007: Aarakocra Skirmisher Talons charge-damage clause — the GM-adjudication
// offer ("30+ ft Charge: +3d4+2 Slashing?") rides the monster attack result popup
// (CLA-325 advisory + CLA-352 offer-on-result pattern). Offer on HIT only.
// lane-owner: chargeBonusOffer gate/resolve/callbacks in DiceRollResult.
// Sibling mirrors own their own seams: two-handed → two-handed.test.jsx,
// ranged-variant → ranged-variant.test.jsx, hit_choice → hit-choice.test.jsx.
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

const GRANT_NAME = '30+ ft Charge: +3d4+2 Slashing?';
const DECLINE_NAME = 'No charge (base damage only)';
// Matches BOTH offer buttons ("Charge" and "No charge") — one negative query suffices.
const ANY_OFFER = /charge/i;

// Roll 14 + 4 = 18 vs AC 18 — default renders the exact-AC-boundary HIT so the
// gate is exercised behaviourally (recomputed total vs AC), not just on the
// forwarded `hit` flag (computeComputedHit falls back to `hit` only sans AC).
function renderAttackPopup(props = {}) {
  return render(
    <DiceRollResult
      name="Talons"
      type="d20"
      rollType="attack"
      rolls={[14]}
      bonus={4}
      targetName="AasimarTest"
      targetAc={18}
      hit={true}
      chargeBonusOffer={OFFER}
      {...props}
    />
  );
}

describe('MA-0007 charge bonus offer gate (DiceRollResult)', () => {
  it('offers both buttons on a hit at the exact AC boundary (18 vs AC 18)', () => {
    renderAttackPopup();
    expect(screen.getByRole('button', { name: GRANT_NAME })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: DECLINE_NAME })).toBeInTheDocument();
  });

  it.each([
    ['a recomputed miss (18 vs AC 19)', { targetAc: 19, hit: false }],
    ['a forwarded miss flag without AC', { targetAc: undefined, hit: false }],
    ['an auto-miss despite a numerically winning total', { targetAc: 12, isAutoMiss: true }],
    ['a stale hit flag contradicted by recomputed total', { targetAc: 19, hit: true }],
    ['an action with no conditional_damage offer', { chargeBonusOffer: null }],
  ])('does NOT offer the charge bonus on %s', (_case, props) => {
    renderAttackPopup(props);
    expect(screen.queryByRole('button', { name: ANY_OFFER })).not.toBeInTheDocument();
  });

  it.each([
    ['granted', /Charge bonus applied \(\+3d4 \+ 2 Slashing\)\./],
    ['declined', /Charge bonus declined — base damage only\./],
  ])('replaces both buttons with the %s notice once resolved', (resolved, notice) => {
    renderAttackPopup({ chargeBonusResolved: resolved });
    expect(screen.queryByRole('button', { name: ANY_OFFER })).not.toBeInTheDocument();
    expect(screen.getByText(notice)).toBeInTheDocument();
  });

  it.each([
    ['grant', GRANT_NAME, 'onChargeBonus', 'onChargeBonusDecline'],
    ['decline', DECLINE_NAME, 'onChargeBonusDecline', 'onChargeBonus'],
  ])('clicking %s invokes only %s with no args', (button, name, firedKey, silentKey) => {
    const onChargeBonus = vi.fn();
    const onChargeBonusDecline = vi.fn();
    const callbacks = { onChargeBonus, onChargeBonusDecline };
    renderAttackPopup(callbacks);
    fireEvent.click(screen.getByRole('button', { name }));
    expect(callbacks[firedKey]).toHaveBeenCalledTimes(1);
    expect(callbacks[firedKey]).toHaveBeenCalledWith();
    expect(callbacks[silentKey]).not.toHaveBeenCalled();
  });
});
