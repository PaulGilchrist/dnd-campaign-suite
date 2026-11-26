// @maintained-by-ai 2026-11-18
// NB 2026-11-18 backlog (popup-footer leading-space family, sibling of
// 2da7466dd): the Savage Attacker chip that rides the damage-result popup face
// (DamageFeatureTriggers 'savage' — the dwell/commit face keeps the trigger
// while popupData.savageAttacker is still set) must be RAW-textContent
// BYTE-EXACT: the label is ONE expression child after the icon (OA-chip
// precedent), so JSON.stringify(textContent) reads '"Savage Attacker"' — no
// icon-adjacent leading space for raw-text locators to trip over — and the
// icon gap stays CSS-owned (.dice-roll-savage-btn i margin-right, 6px like
// .dice-roll-done-btn i). Pins:
//   • raw textContent of the chip is byte-exact (getByText with exact:true
//     normalizes, so the raw anchor is `element.textContent` itself);
//   • structural idiom: one <i> element child + one text node, byte-equal;
//   • the fa-solid fa-arrows-spin icon still renders inside the chip;
//   • chooser seam unregressed through the raw-text press: visible copy of
//     Keep First/Keep Reroll and of the :702 result row is byte-identical
//     (the row's RAW leading space is a known, explicitly out-of-scope
//     residual — its visible copy is pinned via the normalized text, same
//     normalize the rerollResults lane uses).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import DiceRollResult from './DiceRollResult.jsx';

// Deterministic dice: a constant Math.random makes every d6 roll the max face.
let randomSpy;
afterEach(() => {
    if (randomSpy) randomSpy.mockRestore();
    randomSpy = null;
});

const normalize = (text) => text.replace(/\s+/g, ' ').trim();

// Damage-result popup face: type='damage' with damageApplied already committed
// — the dwell face on which the Savage Attacker chip rides (the map's riderless
// control face: "… N damage applied to <T> — HP: a → b / Savage Attacker / …").
function renderDamageResultFace() {
    const props = {
        name: 'Longsword',
        type: 'damage',
        rolls: [2, 3],
        bonus: 0,
        total: 5,
        formula: '2d6',
        savageAttacker: true,
        targetName: 'Goblin',
        damageType: 'Slashing',
        modifier: 0,
        damageApplied: true,
        finalDamage: 5,
        targetOldHp: 7,
        targetCurrentHp: 2,
        onSavageAttacker: vi.fn(),
        onSavageAttackerChoice: vi.fn().mockResolvedValue(undefined),
    };
    render(<DiceRollResult {...props} />);
    return props;
}

describe('damage-result popup Savage Attacker chip is raw-text byte-exact', () => {
    it('raw textContent is exactly "Savage Attacker" — no icon-adjacent leading space', () => {
        renderDamageResultFace();

        // Exact raw-text locator resolves first-try to exactly one element.
        const matches = screen.getAllByText('Savage Attacker', { exact: true });
        expect(matches).toHaveLength(1);
        const chip = matches[0];

        // The raw anchor (trim would hide a leading space — byte compare only).
        expect(chip.textContent).toBe('Savage Attacker');
        expect(JSON.stringify(chip.textContent)).toBe('"Savage Attacker"');

        // It is the chip button, carrying the CSS-gap class beside the shared
        // reroll-button skin.
        expect(chip.tagName).toBe('BUTTON');
        expect(chip).toHaveClass('dice-roll-reroll-btn', 'dice-roll-savage-btn');
    });

    it('2da7466dd idiom held: icon element child + one expression text node, icon still rendered', () => {
        renderDamageResultFace();
        const chip = screen.getByText('Savage Attacker', { exact: true });

        // Icon still renders (fa-solid fa-arrows-spin on the chip).
        expect(chip.querySelector('i.fa-solid.fa-arrows-spin')).not.toBeNull();

        // Structure: exactly one <i> element child and ONE text node — the
        // label is a single expression child, not a leading-space text node.
        expect(chip.childNodes).toHaveLength(2);
        expect(chip.childNodes[0].nodeType).toBe(1);
        expect(chip.childNodes[0].tagName).toBe('I');
        expect(chip.childNodes[1].nodeType).toBe(3);
        expect(chip.childNodes[1].nodeValue).toBe('Savage Attacker');
    });

    it('chooser seam unregressed through the raw-text press: visible copy byte-identical', () => {
        randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999); // d6 → 6
        const props = renderDamageResultFace();

        fireEvent.click(screen.getByText('Savage Attacker', { exact: true }));

        // Trigger consumed (chip gone, replaced by the result row + chooser).
        expect(screen.queryByText('Savage Attacker', { exact: true })).not.toBeInTheDocument();
        expect(props.onSavageAttacker).toHaveBeenCalledTimes(1);

        // Keep First/Keep Reroll chooser: exact accessible names unchanged.
        expect(screen.getByRole('button', { name: 'Keep First (5)' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Keep Reroll (12)' })).toBeInTheDocument();

        // Result row visible copy is byte-identical (normalized read — the
        // row's RAW leading space is out-of-scope per the backlog). The
        // chooser row nests INSIDE the result row, so read the row text with
        // the nested chooser removed.
        const rows = document.querySelectorAll('.dice-roll-reroll-result');
        expect(rows).toHaveLength(1);
        const rowText = rows[0].cloneNode(true);
        rowText.querySelectorAll('.dice-roll-reroll').forEach((node) => node.remove());
        expect(normalize(rowText.textContent)).toBe(
            'Savage Attacker: 2, 3 → 6, 6 — choose which total to keep (5 or 12)'
        );

        // Keep First press still routes the chooser decision to the host.
        fireEvent.click(screen.getByRole('button', { name: 'Keep First (5)' }));
        expect(props.onSavageAttackerChoice).toHaveBeenCalledWith(
            expect.objectContaining({ keep: 'original', originalTotal: 5, newTotal: 12 })
        );
    });
});
