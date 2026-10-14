// CLA-320: popup must mirror the authoritative miss→hit conversion folded with
// the Homing Strikes psionic die — flipped HIT line, homing add line, and a
// working Done button so damage rolls/applies.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiceRollResult from './DiceRollResult.jsx';

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
            autoDamage={{ name: 'Psychic Blade', formula: '8d8+2', damageType: 'Psychic', targetName: 'Knight 1', attackerName: 'AasimarTest', sneakAttackDice: 0, d20Roll: 8 }}
            onDone={vi.fn()}
            {...props}
        />
    );
}

describe('DiceRollResult — Homing Strikes popup (CLA-320)', () => {
    it('shows converted HIT with the homing total when homingStrikesBonus is folded in', () => {
        const { container } = renderHomingPopup({ homingStrikesUsed: true, homingStrikesBonus: 5 });
        const hitMiss = container.querySelector('.dice-roll-hit-miss.hit');
        expect(hitMiss).not.toBeNull();
        expect(hitMiss.textContent).toContain('✓ HIT (21 vs AC 18)');
    });

    it('prints the Homing Strikes add line', () => {
        const { container } = renderHomingPopup({ homingStrikesUsed: true, homingStrikesBonus: 5 });
        expect(container.textContent).toContain('Soul Blades (Homing Strikes): psionic die +5');
        expect(container.textContent).toContain('21 vs AC 18');
        expect(container.textContent).toContain('miss converted into a hit');
    });

    it('renders Done on the converted hit and clicking it applies damage via onDone(true)', () => {
        const onDone = vi.fn();
        const { container } = renderHomingPopup({ homingStrikesUsed: true, homingStrikesBonus: 5, onDone });
        const done = [...container.querySelectorAll('.dice-roll-reroll-btn')].find(b => b.textContent.includes('Done'));
        expect(done).toBeTruthy();
        fireEvent.click(done);
        expect(onDone).toHaveBeenCalledWith(true);
    });

    it('control: plain miss (no homing) still shows MISS with no Done', () => {
        const { container } = renderHomingPopup({
            hit: false,
            autoDamage: undefined,
        });
        const miss = container.querySelector('.dice-roll-hit-miss.miss');
        expect(miss).not.toBeNull();
        expect(miss.textContent).toContain('✗ MISS (16 vs AC 18)');
        expect(container.textContent).not.toContain('Homing Strikes');
        const done = [...container.querySelectorAll('.dice-roll-reroll-btn')].find(b => b.textContent.includes('Done'));
        expect(done).toBeFalsy();
    });

    it('useDiceRollState folds the homing bonus into finalTotal/computedHit', () => {
        renderHomingPopup({ homingStrikesUsed: true, homingStrikesBonus: 5 });
        expect(screen.getByText('21')).toBeInTheDocument();
    });
});
