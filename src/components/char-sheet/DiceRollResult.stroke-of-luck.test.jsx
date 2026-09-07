// @improved-by-ai
// CLA-339: Stroke of Luck (Rogue lv20) — offer must be gated to FAILED d20 tests only.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiceRollResult from './DiceRollResult.jsx';

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
    it('does NOT offer Stroke of Luck on a successful attack roll', () => {
        renderStrokePopup({ targetName: 'Knight 1', targetAc: 18, rolls: [15], hit: true });
        expect(screen.queryByRole('button', { name: /Stroke of Luck/i })).not.toBeInTheDocument();
    });

    it('does NOT offer Stroke of Luck on a natural-20 critical hit', () => {
        renderStrokePopup({ targetName: 'Knight 1', targetAc: 18, rolls: [20], hit: true, isCrit: true });
        expect(screen.queryByRole('button', { name: /Stroke of Luck/i })).not.toBeInTheDocument();
    });

    it('does NOT offer Stroke of Luck on a save success', () => {
        renderStrokePopup({ rollType: 'save', saveResult: { success: true, total: 21, roll: 13, bonus: 8 }, saveDc: 15 });
        expect(screen.queryByRole('button', { name: /Stroke of Luck/i })).not.toBeInTheDocument();
    });

    it('does NOT offer Stroke of Luck while waiting for a player save', () => {
        renderStrokePopup({ rollType: 'save', waitingForPlayerSave: true, targetName: 'Knight 1', saveDc: 15 });
        expect(screen.queryByRole('button', { name: /Stroke of Luck/i })).not.toBeInTheDocument();
    });

    it('does NOT offer Stroke of Luck on a full-cover auto-miss (mirrors Boon of Combat Prowess gate)', () => {
        renderStrokePopup({ targetName: 'Knight 1', targetAc: 18, hit: false, isAutoMiss: true });
        expect(screen.queryByRole('button', { name: /Stroke of Luck/i })).not.toBeInTheDocument();
    });

    it('offers Stroke of Luck on a failed attack roll', () => {
        renderStrokePopup({ targetName: 'Knight 1', targetAc: 18, hit: false });
        expect(screen.getByRole('button', { name: /Stroke of Luck/i })).toBeInTheDocument();
    });

    it('offers Stroke of Luck on a failed saving throw', () => {
        renderStrokePopup({ rollType: 'save', saveResult: { success: false, total: 9, roll: 1, bonus: 8 }, saveDc: 15 });
        expect(screen.getByRole('button', { name: /Stroke of Luck/i })).toBeInTheDocument();
    });

    it('converts the roll to a 20 when clicked on a failed attack roll', () => {
        renderStrokePopup({ targetName: 'Knight 1', targetAc: 18, hit: false });
        fireEvent.click(screen.getByRole('button', { name: /Stroke of Luck/i }));
        expect(screen.getByText(/20 \(Stroke of Luck\)/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Stroke of Luck/i })).not.toBeInTheDocument();
    });

    it('identifies the feature when Stroke of Luck is clicked (no boon collateral)', () => {
        const onStrokeOfLuck = vi.fn();
        renderStrokePopup({ targetName: 'Knight 1', targetAc: 18, hit: false, onStrokeOfLuck });
        fireEvent.click(screen.getByRole('button', { name: /Stroke of Luck/i }));
        expect(onStrokeOfLuck).toHaveBeenCalledWith('strokeOfLuck');
    });

    it('identifies Boon of Combat Prowess separately when its button is clicked', () => {
        const onStrokeOfLuck = vi.fn();
        renderStrokePopup({ targetName: 'Knight 1', targetAc: 18, hit: false, autoRerollForAttack: true, onStrokeOfLuck });
        fireEvent.click(screen.getByRole('button', { name: /Boon of Combat Prowess/i }));
        expect(onStrokeOfLuck).toHaveBeenCalledWith('boonOfCombatProwess');
    });
});
