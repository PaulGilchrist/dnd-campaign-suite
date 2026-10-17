// MA-0436: Bugbear Javelin melee-or-ranged dual-mode variant — GM-adjudicated
// damage-dice CHOICE on the monster attack HIT popup (monsters.json
// damage_dice_ranged; MA-0325 two-handed mirror, MA-0007 offer-on-result
// shape). ALTERNATIVE primary dice, offered on HIT only; non-variant rows
// never render the chooser (byte-inert guardrail).
// Lane notes: onRangedVariant has no payload coverage in handlers.test.js, so
// the click→payload path stays here. Auto-miss is asserted OVER hit:true — a
// stale hit flag must never offer the choice (computeComputedHit hard-codes
// isAutoMiss → false before consulting hit). Charge offer gate →
// charge-bonus.test.jsx; two-handed mirror → two-handed.test.jsx.
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
  it('offers the exact melee-vs-ranged buttons on a HIT, with no resolved notice', () => {
    renderAttackPopup({ hit: true });
    expect(screen.getByRole('button', { name: 'Melee: 2d6 + 2 Piercing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ranged: 1d6 + 2 Piercing' })).toBeInTheDocument();
    expect(screen.queryByText(/applied \(/)).not.toBeInTheDocument();
  });

  // Gate table: the chooser is offered HIT-only and only when the row carries
  // a damage_dice_ranged offer. Auto-miss is asserted over hit:true so the
  // isAutoMiss suppression itself is what fails the gate, not the hit flag.
  it.each([
    ['a MISS', { hit: false }],
    ['an auto-miss overriding hit:true', { hit: true, isAutoMiss: true }],
    ['a row with no damage_dice_ranged offer', { hit: true, rangedVariantOffer: null }],
  ])('does NOT offer the choice on %s', (_case, props) => {
    renderAttackPopup(props);
    expect(screen.queryByRole('button', { name: /ranged: |melee: /i })).not.toBeInTheDocument();
    expect(screen.queryByText(/applied \(/)).not.toBeInTheDocument();
  });

  // Resolved state replaces both buttons with a single notice quoting the exact
  // formula + damage type of the mode picked (ranged swaps the Done auto-damage
  // formula upstream; the popup must echo the same raw offer fields).
  it.each([
    ['ranged', 'Ranged applied (1d6 + 2 Piercing).'],
    ['melee', 'Melee applied (2d6 + 2 Piercing).'],
  ])('replaces both buttons with the exact resolved notice once %s is picked', (resolved, notice) => {
    renderAttackPopup({ hit: true, rangedVariantResolved: resolved });
    expect(screen.queryByRole('button', { name: /ranged: |melee: /i })).not.toBeInTheDocument();
    expect(screen.getByText(notice)).toBeInTheDocument();
  });

  // Click contract: raw lowercase variant id (not the displayed label) is
  // forwarded so the modal can swap the Done auto-damage formula exactly.
  it.each([
    ['Ranged: 1d6 + 2 Piercing', 'ranged'],
    ['Melee: 2d6 + 2 Piercing', 'melee'],
  ])('invokes onRangedVariant with the raw id when the %s button is clicked', (label, payload) => {
    const onRangedVariant = vi.fn();
    renderAttackPopup({ hit: true, onRangedVariant });
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(onRangedVariant).toHaveBeenCalledWith(payload);
  });
});

// MA-0529 twin: Cult Fanatic Dagger — dice-identical chooser (1d4 + 2 in
// both modes); the band/choice is still adjudicated on the HIT popup even
// though both buttons quote the same formula.
describe('MA-0529 identical-dice chooser (DiceRollResult)', () => {
  const IDENTICAL_OFFER = { ...OFFER, formula: '1d4 + 2', baseFormula: '1d4 + 2', label: 'Ranged: 1d4 + 2 Piercing?', attackName: 'Dagger', range: '20/60', normalFt: 20, longFt: 60 };

  function renderDaggerPopup(props = {}) {
    return render(
      <DiceRollResult
        name="Dagger"
        type="d20"
        rollType="attack"
        rolls={[15]}
        bonus={4}
        hit
        targetName="Bandit 1"
        rangedVariantOffer={IDENTICAL_OFFER}
        {...props}
      />
    );
  }

  it('offers Melee/Ranged both at exactly 1d4 + 2 Piercing on a HIT', () => {
    renderDaggerPopup();
    expect(screen.getByRole('button', { name: 'Melee: 1d4 + 2 Piercing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ranged: 1d4 + 2 Piercing' })).toBeInTheDocument();
    expect(screen.queryByText(/applied \(/)).not.toBeInTheDocument();
  });

  it('replaces both buttons with the exact ranged notice once ranged is picked', () => {
    renderDaggerPopup({ rangedVariantResolved: 'ranged' });
    expect(screen.queryByRole('button', { name: /ranged: |melee: /i })).not.toBeInTheDocument();
    expect(screen.getByText('Ranged applied (1d4 + 2 Piercing).')).toBeInTheDocument();
  });
});
