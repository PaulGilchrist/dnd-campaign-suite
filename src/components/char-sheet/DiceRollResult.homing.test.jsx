// @maintained-by-ai
// CLA-320: Homing Strikes (Soul Blades) popup seam — the popup must mirror the
// authoritative resolver's miss→hit conversion folded with the psionic die:
// flipped HIT line at the folded total, one exact homing add line, and a Done
// button that applies damage via onDone(true).
// Gates: folding requires rollType 'attack' with a positive homingStrikesBonus
// and never applies on an auto-miss — asserted over a stale hit:true so a
// natural-1 / out-of-range attack can never be converted (hit-choice lane's
// upgraded fixture pattern). autoDamage is present in the gate cases too, so a
// missing Done proves the computedHit gate, not a missing autoDamage prop.
// Lanes: reroll/bardic handler payload contracts → handlers.test.js; generic
// hit/miss display lines → combatDisplay.test.jsx; hit chooser → hit-choice.test.jsx.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiceRollResult from './DiceRollResult.jsx';

// d20 8 + mod 8 = 16 vs AC 18 → miss; psionic +5 folds to 21 → converted hit.
const AUTO_DAMAGE = { name: 'Psychic Blade', formula: '8d8+2', damageType: 'Psychic', targetName: 'Knight 1', attackerName: 'AasimarTest', sneakAttackDice: 0, d20Roll: 8 };
const HOMING_LINE = 'Soul Blades (Homing Strikes): psionic die +5 → 21 vs AC 18 — miss converted into a hit, 1 Psionic Energy expended';

function renderHomingPopup(props = {}) {
    return render(
        <DiceRollResult
            name="Psychic Blade"
            type="d20"
            rollType="attack"
            rolls={[8]}
            bonus={8}
            targetName="Knight 1"
            targetAc={18}
            hit={true}
            autoDamage={{ ...AUTO_DAMAGE }}
            onDone={vi.fn()}
            {...props}
        />
    );
}

describe('DiceRollResult — Homing Strikes popup (CLA-320)', () => {
    it('mirrors the converted hit: folded total 21, flipped HIT line, exact homing add line', () => {
        const { container } = renderHomingPopup({ homingStrikesUsed: true, homingStrikesBonus: 5 });
        // finalTotal folds the bonus (21) while the breakdown keeps the original d20 roll.
        expect(container.querySelector('.dice-roll-total').textContent).toBe('21');
        expect(screen.getByText('✓ HIT (21 vs AC 18)')).toBeInTheDocument();
        expect(screen.getByText(HOMING_LINE)).toBeInTheDocument();
        expect(screen.queryByText(/MISS/)).not.toBeInTheDocument();
    });

    it('clicking Done applies damage via onDone with the exact converted-hit arg', () => {
        const onDone = vi.fn();
        renderHomingPopup({ homingStrikesUsed: true, homingStrikesBonus: 5, onDone });
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onDone).toHaveBeenCalledWith(true);
    });

    // Gate table: no fold, no add line, no Done. The auto-miss row is asserted
    // over hit:true — a stale hit flag must never let homing convert an auto-miss.
    it.each([
        ['a plain MISS with no homing', { hit: false }, '✗ MISS (16 vs AC 18)'],
        ['an auto-miss overriding hit:true despite a live homing bonus', { hit: true, isAutoMiss: true, homingStrikesUsed: true, homingStrikesBonus: 5 }, '✗ AUTO-MISS (out of range)'],
        ['an attack flagged homing but with a zero psionic die value', { hit: false, homingStrikesUsed: true, homingStrikesBonus: 0 }, '✗ MISS (16 vs AC 18)'],
    ])('shows no homing conversion on %s', (_case, props, outcome) => {
        const { container } = renderHomingPopup(props);
        expect(screen.getByText(outcome)).toBeInTheDocument();
        expect(container.textContent).not.toContain('Homing Strikes');
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
});
