// @maintained-by-ai
// MA-0325: Azer Warhammer two-handed variant — GM-adjudicated damage-dice
// CHOICE on the monster attack HIT popup (MA-0007 offer-on-result shape,
// monsters.json damage_dice_two_handed). ALTERNATIVE primary dice, offered on
// HIT only; one-handed rows never render the chooser (byte-inert guardrail).
// Lane notes: onTwoHandedVariant has no payload coverage in handlers.test.js,
// so the click→payload path stays here. Auto-miss is asserted OVER hit:true —
// a stale hit flag must never offer the choice (computeComputedHit hard-codes
// isAutoMiss → false before consulting hit). Charge offer gate →
// charge-bonus.test.jsx; ranged mirror → ranged-variant.test.jsx; condition
// choice → hit-choice.test.jsx.
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
  it('offers the exact two-handed-vs-one-handed buttons on a HIT, with no resolved notice', () => {
    renderAttackPopup({ hit: true });
    expect(screen.getByRole('button', { name: 'Two-Handed: 1d10 + 3 bludgeoning' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'One-Handed: 1d8 + 3 bludgeoning' })).toBeInTheDocument();
    expect(screen.queryByText(/applied \(/)).not.toBeInTheDocument();
  });

  // Gate table: the chooser is offered HIT-only and only when the row carries
  // a damage_dice_two_handed offer. Auto-miss is asserted over hit:true so the
  // isAutoMiss suppression itself is what fails the gate, not the hit flag.
  it.each([
    ['a MISS', { hit: false }],
    ['an auto-miss overriding hit:true', { hit: true, isAutoMiss: true }],
    ['a row with no damage_dice_two_handed offer', { hit: true, twoHandedVariantOffer: null }],
  ])('does NOT offer the choice on %s', (_case, props) => {
    renderAttackPopup(props);
    expect(screen.queryByRole('button', { name: /two-handed: |one-handed: /i })).not.toBeInTheDocument();
    expect(screen.queryByText(/applied \(/)).not.toBeInTheDocument();
  });

  // Resolved state replaces both buttons with a single notice quoting the exact
  // formula + damage type of the variant picked (two-handed swaps the Done
  // auto-damage formula upstream; the popup must echo the same raw offer fields).
  it.each([
    ['two-handed', 'Two-Handed applied (1d10 + 3 bludgeoning).'],
    ['one-handed', 'One-Handed applied (1d8 + 3 bludgeoning).'],
  ])('replaces both buttons with the exact resolved notice once %s is picked', (resolved, notice) => {
    renderAttackPopup({ hit: true, twoHandedVariantResolved: resolved });
    expect(screen.queryByRole('button', { name: /two-handed: |one-handed: /i })).not.toBeInTheDocument();
    expect(screen.getByText(notice)).toBeInTheDocument();
  });

  // Click contract: raw lowercase variant id (not the displayed label) is
  // forwarded so the modal can swap the Done auto-damage formula exactly.
  it.each([
    ['Two-Handed: 1d10 + 3 bludgeoning', 'two-handed'],
    ['One-Handed: 1d8 + 3 bludgeoning', 'one-handed'],
  ])('invokes onTwoHandedVariant with the raw id when the %s button is clicked', (label, payload) => {
    const onTwoHandedVariant = vi.fn();
    renderAttackPopup({ hit: true, onTwoHandedVariant });
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(onTwoHandedVariant).toHaveBeenCalledWith(payload);
  });
});
