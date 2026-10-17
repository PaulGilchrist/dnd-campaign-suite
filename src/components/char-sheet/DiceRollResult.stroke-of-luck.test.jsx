// @maintained-by-ai
// CLA-339: Stroke of Luck (Rogue lv20) — offer must be gated to FAILED d20 tests only.
//
// Seam ownership map:
//   - THIS file (callback-identity owner for onStrokeOfLuck, per the
//     boon-of-combat-prowess lane note): exact-arg identity of the single
//     shared onStrokeOfLuck callback ('strokeOfLuck' vs 'boonOfCombatProwess')
//     and the CLA-339 failure-only offer gate — hidden on successes, pending
//     saves, and auto-misses; offered on failed attacks/saves and on
//     adjudicated checks with no outcome flag; closed once the boon flips the
//     miss to an authoritative hit.
//   - Stroke-of-luck result-row text and deterministic reroll totals after a
//     click: DiceRollResult.interactive.test.jsx.
//   - Post-trigger reroll result-row text (Empowered / Puncture / Savage):
//     DiceRollResult.rerollResults.test.jsx.
//   - Boon miss→hit flip sequence + Done auto-damage dispatch:
//     DiceRollResult.boon-of-combat-prowess.test.jsx.
//   - Floor-notice coexistence with stroke of luck: DiceRollResult.flooring.test.jsx.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DiceRollResult from './DiceRollResult.jsx';

// Deterministic dice (0.999 → max face) guards the click lane against any
// incidental roll. Restored in afterEach — no resetAllMocks.
let randomSpy;
beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999);
});
afterEach(() => {
    randomSpy.mockRestore();
});

// Default state: failed attack roll (6 + 8 = 14 vs AC 18) with the Stroke of
// Luck offer live — the baseline every case overrides toward gate on/off.
function renderStrokePopup(props = {}) {
    return render(
        <DiceRollResult
            name="Shortsword"
            type="d20"
            rollType="attack"
            rolls={[6]}
            bonus={8}
            strokeOfLuck={true}
            {...props}
        />
    );
}

describe('CLA-339 Stroke of Luck offer gate', () => {
    it.each([
        ['a successful attack roll', { targetName: 'Knight 1', targetAc: 18, rolls: [15], hit: true }],
        ['a natural-20 critical hit', { targetName: 'Knight 1', targetAc: 18, rolls: [20], hit: true, isCrit: true }],
        ['a save success', { rollType: 'save', saveResult: { success: true, total: 21, roll: 13, bonus: 8 }, saveDc: 15 }],
        ['while waiting for a player save', { rollType: 'save', waitingForPlayerSave: true, targetName: 'Knight 1', saveDc: 15 }],
        ['a full-cover auto-miss (mirrors Boon of Combat Prowess gate)', { targetName: 'Knight 1', targetAc: 18, hit: false, isAutoMiss: true }],
    ])('does NOT offer Stroke of Luck on %s', (_label, props) => {
        renderStrokePopup(props);
        expect(screen.queryByRole('button', { name: 'Stroke of Luck' })).not.toBeInTheDocument();
        // No ghost state either: the feature must not surface anywhere on a resolved success.
        expect(screen.queryByText(/Stroke of Luck/i)).not.toBeInTheDocument();
    });

    it.each([
        ['a failed attack roll', { targetName: 'Knight 1', targetAc: 18, hit: false }],
        ['a failed saving throw', { rollType: 'save', saveResult: { success: false, total: 9, roll: 1, bonus: 8 }, saveDc: 15 }],
        ['an adjudicated check with no outcome flag', { rollType: 'check' }],
    ])('offers Stroke of Luck on %s', (_label, props) => {
        renderStrokePopup(props);
        expect(screen.getByRole('button', { name: 'Stroke of Luck' })).toBeInTheDocument();
    });
});

describe('CLA-339 onStrokeOfLuck callback identity (exact args)', () => {
    // Both failure-only offers are live on the shared failing-attack baseline.
    const failingAttackBothOffers = { targetName: 'Knight 1', targetAc: 18, hit: false, autoRerollForAttack: true };

    it('Stroke of Luck click notifies the host with exactly "strokeOfLuck", consumes only its own offer', () => {
        const onStrokeOfLuck = vi.fn();
        renderStrokePopup({ ...failingAttackBothOffers, onStrokeOfLuck });
        expect(screen.getByRole('button', { name: 'Stroke of Luck' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Stroke of Luck' }));

        expect(onStrokeOfLuck).toHaveBeenCalledTimes(1);
        expect(onStrokeOfLuck).toHaveBeenCalledWith('strokeOfLuck');
        expect(screen.queryByRole('button', { name: 'Stroke of Luck' })).not.toBeInTheDocument();
        // No boon collateral: the boon offer stays live and its conversion row never appears.
        expect(screen.getByRole('button', { name: 'Boon of Combat Prowess' })).toBeInTheDocument();
        expect(screen.queryByText(/Miss converted to Hit/)).not.toBeInTheDocument();
    });

    it('Boon of Combat Prowess click notifies separately with exactly "boonOfCombatProwess"', () => {
        const onStrokeOfLuck = vi.fn();
        renderStrokePopup({ ...failingAttackBothOffers, onStrokeOfLuck });
        expect(screen.getByRole('button', { name: 'Stroke of Luck' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Boon of Combat Prowess' }));

        expect(onStrokeOfLuck).toHaveBeenCalledTimes(1);
        expect(onStrokeOfLuck).toHaveBeenCalledWith('boonOfCombatProwess');
        // CLA-339 gate: the boon flip resolves the d20 test as a hit — the
        // stroke offer must close with it (flip sequence owned elsewhere).
        expect(screen.queryByRole('button', { name: 'Stroke of Luck' })).not.toBeInTheDocument();
    });
});
