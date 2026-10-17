// FT-007: Boon of Combat Prowess — once a miss is converted, the popup must
// flip to a hit state: offer button hides, the conversion row appears, and the
// Done button renders (computedHit authoritative flip) so auto-damage dispatches.
// Offer-gate coverage lives in rerollResults.test.jsx; callback-identity
// coverage lives in stroke-of-luck.test.jsx. This file owns the flip sequence.
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
    it('stays a MISS until accepted: offers the boon, no HIT, no conversion row, no Done for auto-damage', () => {
        renderBoonPopup();
        expect(screen.getByRole('button', { name: /Boon of Combat Prowess/i })).toBeInTheDocument();
        expect(screen.getByText('✗ MISS (12 vs AC 18)')).toBeInTheDocument();
        expect(screen.queryByText(/✓ HIT/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Miss converted to Hit/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Done/i })).not.toBeInTheDocument();
    });

    it('accepting notifies the host, flips the popup to a HIT despite 12 < AC 18, and Done dispatches auto-damage', () => {
        const onStrokeOfLuck = vi.fn();
        const onDone = vi.fn();
        renderBoonPopup({ onStrokeOfLuck, onDone });

        fireEvent.click(screen.getByRole('button', { name: /Boon of Combat Prowess/i }));

        expect(onStrokeOfLuck).toHaveBeenCalledWith('boonOfCombatProwess');
        expect(screen.queryByRole('button', { name: /Boon of Combat Prowess/i })).not.toBeInTheDocument();
        expect(screen.getByText(/Boon of Combat Prowess: Miss converted to Hit/)).toBeInTheDocument();
        // computedHit flips authoritatively — the original total still shows below AC.
        expect(screen.getByText('✓ HIT (12 vs AC 18)')).toBeInTheDocument();
        expect(screen.queryByText(/✗ MISS/i)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Done/i }));
        expect(onDone).toHaveBeenCalledWith(true);
    });
});
