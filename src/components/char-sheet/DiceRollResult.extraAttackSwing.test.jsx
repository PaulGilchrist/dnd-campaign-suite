// @maintained-by-ai
// ZB 2026-11-23 affordance pins: during an Extra Attack chain each swing's
// `.popup-modal` face carries an in-chain ordinal ("Swing N of N") so the GM
// can tell which swing a Done commits. The ordinal renders ONLY when the
// chain threaded `extraAttackSwing` on the popup payload — a single-swing
// attack face (no field) must stay byte-identical to the pre-ordinal ship.
// Affordance only: the Done/Cancel commit contract is owned by
// AttackResultPopup.close-behavior/footer-button-names tests, re-asserted
// here unchanged over an ordinal-bearing face.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiceRollResult from './DiceRollResult.jsx';

const AUTO_DAMAGE = { name: 'Longsword', formula: '1d8+3', damageType: 'Slashing', targetName: 'Goblin', attackerName: 'FixtureFighter5e', sneakAttackDice: 0 };

function renderSwingPopup(props = {}) {
    return render(
        <DiceRollResult
            name="Longsword"
            type="d20"
            rollType="attack"
            rolls={[12]}
            bonus={6}
            targetName="Goblin"
            targetAc={15}
            hit={true}
            autoDamage={{ ...AUTO_DAMAGE }}
            onDone={vi.fn()}
            {...props}
        />
    );
}

describe('DiceRollResult — Extra Attack chain swing ordinal (ZB affordance)', () => {
    it('renders the in-chain ordinal on a staged HIT popup ("Swing 2 of 2")', () => {
        const { container } = renderSwingPopup({ extraAttackSwing: { swing: 2, of: 2 } });
        const notice = container.querySelector('.dice-roll-extra-attack-swing');
        expect(notice).toBeInTheDocument();
        expect(notice.textContent).toContain('Swing 2 of 2');
        // Observable in the whole rendered popup text, distinct per swing.
        expect(container.textContent).toContain('Swing 2 of 2');
    });

    it('the first swing carries its own ordinal ("Swing 1 of 2")', () => {
        const { container } = renderSwingPopup({ extraAttackSwing: { swing: 1, of: 2 } });
        expect(container.textContent).toContain('Swing 1 of 2');
        expect(container.textContent).not.toContain('Swing 2 of 2');
    });

    it('resolves N>2 chains honestly ("Swing 3 of 3")', () => {
        const { container } = renderSwingPopup({ extraAttackSwing: { swing: 3, of: 3 } });
        expect(container.textContent).toContain('Swing 3 of 3');
    });

    it('a single-swing attack (no chain context) renders NO ordinal', () => {
        const { container } = renderSwingPopup();
        expect(container.querySelector('.dice-roll-extra-attack-swing')).not.toBeInTheDocument();
        expect(container.textContent).not.toMatch(/Swing \d+ of \d+/);
    });

    it('the ordinal never disturbs the commit contract: Done still commits the staged hit', () => {
        const onDone = vi.fn();
        renderSwingPopup({ extraAttackSwing: { swing: 2, of: 2 }, onDone });
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onDone).toHaveBeenCalledWith(true);
    });

    it('a MISS swing face shows its ordinal and no Done commit button', () => {
        // d20 8 + 6 = 14 vs AC 15 → the face computes a genuine MISS.
        const { container } = renderSwingPopup({ rolls: [8], hit: false, extraAttackSwing: { swing: 1, of: 2 }, onDone: undefined });
        expect(container.textContent).toContain('Swing 1 of 2');
        expect(container.textContent).toContain('✗ MISS (14 vs AC 15)');
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
});
