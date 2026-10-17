import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import DiceRollResult from './DiceRollResult.jsx';

// Ownership of the Savage Attacker seam:
//  - DiceRollResult.handlers.savageAttacker.test.js — handler seam: reroll/keep
//    payload contracts and inertness. It is the source of truth for the full
//    choice payload asserted here: { keep, originalRolls, newRolls, originalTotal,
//    newTotal, rawDamage, modifier, targetName, damageTypes }.
//  - rerollResults — SavageAttackerResult row text copy ('Original kept',
//    'Reroll kept (+N)'); the row copy is not re-asserted in this lane.
//  - This file — the rendered chooser UI: trigger consumption, chooser buttons
//    labelled with the exact totals, click wiring with the exact payload, and the
//    chooser disappearing once a decision is made.

// Deterministic dice: a constant Math.random makes every d6 roll the same face.
const rollMax = () => vi.spyOn(Math, 'random').mockReturnValue(0.999); // d6 → 6
const rollMin = () => vi.spyOn(Math, 'random').mockReturnValue(0.001); // d6 → 1

function renderSavageRoll() {
    const props = {
        name: 'Greatsword',
        type: 'damage',
        rolls: [2, 3],
        bonus: 0,
        total: 5,
        formula: '2d6',
        savageAttacker: true,
        targetName: 'Orc',
        damageType: 'Slashing',
        modifier: 0,
        onSavageAttacker: vi.fn().mockResolvedValue(undefined),
        onSavageAttackerChoice: vi.fn().mockResolvedValue(undefined),
    };
    render(<DiceRollResult {...props} />);
    return props;
}

describe('DiceRollResult savage attacker chooser', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        ['original', 'Keep First (5)'],
        ['reroll', 'Keep Reroll (12)'],
    ])('higher reroll offers a chooser, Keep %s forwards the exact payload and closes it', (keep, buttonName) => {
        rollMax();
        const props = renderSavageRoll();

        fireEvent.click(screen.getByRole('button', { name: 'Savage Attacker' }));

        // Chooser visible while the decision is pending, each option labelled
        // with its exact total.
        expect(screen.getByRole('button', { name: 'Keep First (5)' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Keep Reroll (12)' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: buttonName }));

        // Exact payload per the handlers-lane contract — no objectContaining.
        expect(props.onSavageAttackerChoice).toHaveBeenCalledWith({
            keep,
            originalRolls: [2, 3],
            newRolls: [6, 6],
            originalTotal: 5,
            newTotal: 12,
            rawDamage: 5,
            modifier: 0,
            targetName: 'Orc',
            damageTypes: ['Slashing'],
        });
        expect(props.onSavageAttackerChoice).toHaveBeenCalledTimes(1);

        // Chooser UI and trigger are gone once the decision is made.
        expect(screen.queryByRole('button', { name: /Keep First/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Keep Reroll/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Savage Attacker' })).not.toBeInTheDocument();
    });

    it('lower reroll auto-keeps the original: no chooser offered, trigger consumed', () => {
        rollMin();
        const props = renderSavageRoll();

        fireEvent.click(screen.getByRole('button', { name: 'Savage Attacker' }));

        expect(screen.queryByRole('button', { name: /Keep First/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Keep Reroll/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Savage Attacker' })).not.toBeInTheDocument();
        expect(props.onSavageAttackerChoice).not.toHaveBeenCalled();
    });
});
