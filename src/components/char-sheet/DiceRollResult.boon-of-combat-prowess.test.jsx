// FT-007: Boon of Combat Prowess — once a miss is converted, the popup must
// flip to a hit state: offer button hides, the conversion row appears, and the
// Done button renders (computedHit authoritative flip) so auto-damage dispatches.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiceRollResult from './DiceRollResult.jsx';

const autoDamage = {
    name: 'Shortsword',
    formula: '1d6+5',
    damageType: 'Piercing',
    targetName: 'Knight 1',
    attackerName: 'Disciplined_Monk',
    sneakAttackDice: 0,
    d20Roll: 4,
};

function renderBoonPopup(props = {}) {
    return render(
        <DiceRollResult
            name="Shortsword"
            type="d20"
            rollType="attack"
            rolls={[4]}
            bonus={8}
            autoRerollForAttack={true}
            targetName="Knight 1"
            targetAc={18}
            hit={false}
            autoDamage={autoDamage}
            {...props}
        />
    );
}

describe('FT-007 Boon of Combat Prowess miss-to-hit resolution', () => {
    it('offers the boon on a miss and shows the MISS line before accepting', () => {
        renderBoonPopup();
        expect(screen.getByRole('button', { name: /Boon of Combat Prowess/i })).toBeInTheDocument();
        expect(screen.getByText(/✗ MISS/i)).toBeInTheDocument();
        expect(screen.queryByText(/✓ HIT/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Miss converted to Hit/i)).not.toBeInTheDocument();
    });

    it('after accepting, flips to HIT, hides the offer, shows the conversion row, and renders Done', () => {
        renderBoonPopup();
        fireEvent.click(screen.getByRole('button', { name: /Boon of Combat Prowess/i }));
        expect(screen.queryByRole('button', { name: /Boon of Combat Prowess/i })).not.toBeInTheDocument();
        expect(screen.getByText(/Miss converted to Hit/i)).toBeInTheDocument();
        expect(screen.getByText(/✓ HIT/i)).toBeInTheDocument();
        expect(screen.queryByText(/✗ MISS/i)).not.toBeInTheDocument();
    });

    it('renders the Done button after conversion so auto-damage can dispatch', () => {
        renderBoonPopup();
        const boonBtn = screen.getByRole('button', { name: /Boon of Combat Prowess/i });
        fireEvent.click(boonBtn);
        // Done button uses the reroll-btn class in this component
        const done = document.querySelector('.dice-roll-reroll-btn');
        expect(done).not.toBeNull();
    });

    it('invokes onStrokeOfLuck with boonOfCombatProwess when clicked', () => {
        const onStrokeOfLuck = vi.fn();
        renderBoonPopup({ onStrokeOfLuck });
        fireEvent.click(screen.getByRole('button', { name: /Boon of Combat Prowess/i }));
        expect(onStrokeOfLuck).toHaveBeenCalledWith('boonOfCombatProwess');
    });
});
