// @maintained-by-ai
// DiceRollResult — reroll RESULTS display/transition seam.
//
// Seam ownership map:
//   - THIS file: post-trigger reroll-results display — clicking an offer consumes it
//     and renders exactly one .dice-roll-reroll-result row with the correct dice diff
//     for Empowered Spell, Piercer - Puncture, and Savage Attacker: diff-sign
//     formatting (+N / -N / no suffix), host-supplied messages, and the declined-reroll
//     guard (host resolves null → offer consumed, no phantom row).
//   - createDiceRollHandlers payload contracts (exact totals incl. autoRerollBonus):
//     DiceRollResult.handlers.test.js (handleSavageAttacker: handlers.savageAttacker.test.js).
//   - Boon of Combat Prowess offer gating + miss→hit flip sequence:
//     DiceRollResult.boon-of-combat-prowess.test.jsx.
//   - d20 reroll / stroke-of-luck / tactical / bardic / superiority click dispatch
//     with deterministic reroll totals: DiceRollResult.interactive.test.jsx.
//   - Savage Attacker Keep First / Keep Reroll chooser:
//     DiceRollResult.savageAttackerChoice.test.jsx.
//   - onStrokeOfLuck callback identity: DiceRollResult.stroke-of-luck.test.jsx.
//
// Clicks here are TRIGGERS, not payload assertions — full callback payloads are
// pinned at source in the payload lanes above. This file pins what the player
// SEES after the click. Callback dispatch is checked with the dice identity of
// the roll the row describes, not the full event shape.
import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

// Deterministic dice: 0.999 lands every die on its max face (d6 → 6).
// Restored in afterEach — no resetAllMocks.
let randomSpy;
beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999);
});
afterEach(() => {
    randomSpy.mockRestore();
});

const normalize = (text) => text.replace(/\s+/g, ' ').trim();

// The reroll seam must surface exactly one result row — return its text.
function singleResultRowText(container) {
    const rows = container.querySelectorAll('.dice-roll-reroll-result');
    expect(rows).toHaveLength(1);
    return normalize(rows[0].textContent);
}

describe('Empowered Spell result row', () => {
    it.each([
        ['higher reroll shows a +N diff suffix',
            { rerollCount: 2, originalDice: [3, 2], newDice: [6, 5], newTotal: 11, damageDifference: 1 },
            'Empowered Spell: rerolled 2 dice (3, 2 → 6, 5) → 11 (+1)'],
        ['lower reroll shows a -N diff suffix',
            { rerollCount: 1, originalDice: [5], newDice: [2], newTotal: 2, damageDifference: -3 },
            'Empowered Spell: rerolled 1 dice (5 → 2) → 2 (-3)'],
        ['zero diff renders no suffix and shows the host message',
            { rerollCount: 1, originalDice: [4], newDice: [4], newTotal: 4, damageDifference: 0, message: 'No change in damage' },
            'Empowered Spell: rerolled 1 dice (4 → 4) → 4 — No change in damage'],
        ['positive diff with host message shows both',
            { rerollCount: 1, originalDice: [1], newDice: [6], newTotal: 9, damageDifference: 5, message: 'Rerolled a natural 1' },
            'Empowered Spell: rerolled 1 dice (1 → 6) → 9 (+5) — Rerolled a natural 1'],
    ])('%s: click consumes the offer and renders the exact result row', async (_label, hostResult, expectedRow) => {
        const rolls = hostResult.originalDice;
        const formula = `${hostResult.rerollCount}d6`;
        const onEmpoweredSpell = vi.fn().mockResolvedValue(hostResult);
        const { container } = render(
            <DiceRollResult
                name="Fire Bolt"
                type="damage"
                rolls={rolls}
                bonus={0}
                total={rolls.reduce((sum, r) => sum + r, 0)}
                formula={formula}
                empoweredSpell={true}
                onEmpoweredSpell={onEmpoweredSpell}
            />
        );
        expect(container.querySelector('.dice-roll-reroll-result')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Empowered Spell/ }));

        await vi.waitFor(() => {
            expect(onEmpoweredSpell).toHaveBeenCalledWith(expect.objectContaining({ damageFormula: formula, rolls }));
            expect(singleResultRowText(container)).toBe(expectedRow);
            // Offer consumption lands with the result row (same post-await batch).
            expect(screen.queryByRole('button', { name: /Empowered Spell/ })).not.toBeInTheDocument();
        });
    });

    it('a declined reroll (host resolves null) consumes the offer without rendering a row', async () => {
        const onEmpoweredSpell = vi.fn().mockResolvedValue(null);
        const { container } = render(
            <DiceRollResult
                name="Fire Bolt"
                type="damage"
                rolls={[6]}
                bonus={0}
                total={6}
                formula="1d6"
                empoweredSpell={true}
                onEmpoweredSpell={onEmpoweredSpell}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /Empowered Spell/ }));

        // Offer consumption is the observable completion of the async handler.
        await vi.waitFor(() => {
            expect(onEmpoweredSpell).toHaveBeenCalledWith(expect.objectContaining({ damageFormula: '1d6', rolls: [6] }));
            expect(screen.queryByRole('button', { name: /Empowered Spell/ })).not.toBeInTheDocument();
        });
        expect(container.querySelector('.dice-roll-reroll-result')).not.toBeInTheDocument();
    });
});

describe('Piercer - Puncture result row', () => {
    it('click consumes the offer and shows the lowest die rerolled to its new value', () => {
        const onPuncture = vi.fn().mockResolvedValue(undefined);
        const { container } = render(
            <DiceRollResult
                name="Hand Crossbow"
                type="damage"
                rolls={[3, 5]}
                bonus={0}
                total={8}
                formula="2d6"
                piercerPuncture={true}
                onPuncture={onPuncture}
            />
        );
        expect(container.querySelector('.dice-roll-reroll-result')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Piercer - Puncture/ }));

        // 0.999 → the lowest die (3) rerolls on 2d6 terms to 6.
        expect(onPuncture).toHaveBeenCalledWith(expect.objectContaining({ originalRolls: [3, 5], newRolls: [6, 5] }));
        expect(singleResultRowText(container)).toBe('Piercer - Puncture: 3, 5 → 6, 5');
        expect(screen.queryByRole('button', { name: /Piercer - Puncture/ })).not.toBeInTheDocument();
    });
});

describe('Savage Attacker result row', () => {
    it('click consumes the offer and shows the reroll comparison with the keep prompt', () => {
        const onSavageAttacker = vi.fn();
        const { container } = render(
            <DiceRollResult
                name="Greatsword"
                type="damage"
                rolls={[2, 3]}
                bonus={0}
                total={5}
                formula="2d6"
                savageAttacker={true}
                onSavageAttacker={onSavageAttacker}
            />
        );
        expect(container.querySelector('.dice-roll-reroll-result')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Savage Attacker/ }));

        // 0.999 → both dice max at 6 (total 12) beating the original 5, so the
        // row prompts for a keep choice (chooser dispatch: savageAttackerChoice lane).
        expect(onSavageAttacker).toHaveBeenCalledWith(expect.objectContaining({ originalRolls: [2, 3], newRolls: [6, 6] }));
        expect(singleResultRowText(container)).toBe('Savage Attacker: 2, 3 → 6, 6 — choose which total to keep (5 or 12)');
        expect(screen.queryByRole('button', { name: /^Savage Attacker/ })).not.toBeInTheDocument();
    });
});
