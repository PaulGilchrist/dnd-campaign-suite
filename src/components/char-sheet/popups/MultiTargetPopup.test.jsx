// @maintained-by-ai 2026-11-28
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MultiTargetPopup from './MultiTargetPopup.jsx';

// This file covers ONLY MultiTargetPopup's own UI lane: its copy, the
// second-target <select>, and the exact payload emitted on confirm.
// Spell-name rendering, Escape → onSkip, and the 'Spell' name fallback are
// owned by the base spec (TargetPopupBase.test.jsx) — no duplicate here.
// CharSpells → popup prop wiring is covered by CharSpells.Popups.popupWidgets.test.jsx.

const mockSpell = { name: 'Create Water', level: 1 };
const mockCreatureTargets = ['Goblin', 'Skeleton', 'Orc'];
const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

function makeProps(overrides) {
    return {
        spell: mockSpell,
        range: '30 ft',
        creatureTargets: mockCreatureTargets,
        onConfirm: mockOnConfirm,
        onSkip: mockOnSkip,
        ...(overrides || {}),
    };
}

function getConfirmButton() {
    return screen.getByRole('button', { name: 'Cast on Both Targets' });
}

describe('MultiTargetPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders its own copy: title, second-target subtitle, range description, target options, and action buttons', () => {
        render(<MultiTargetPopup {...makeProps()} />);

        expect(screen.getByRole('heading', { name: /Words of Creation/ })).toBeInTheDocument();
        expect(screen.getByText(/\u2014 Spread to Second Target/)).toBeInTheDocument();
        expect(screen.getByText(/Select a second creature within/)).toBeInTheDocument();
        expect(screen.getByText('30 ft')).toBeInTheDocument();
        expect(screen.getByText('Second Target:')).toBeInTheDocument();

        const options = screen.getAllByRole('option');
        expect(options.map(o => o.textContent)).toEqual([
            '-- Select target --', ...mockCreatureTargets,
        ]);
        expect(options[0].value).toBe('');

        expect(getConfirmButton()).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cast on First Target Only' })).toBeInTheDocument();
    });

    it('gates confirm on a second-target selection and fires only its own handler per button: confirm emits the selected secondTarget once, skip fires once', () => {
        render(<MultiTargetPopup {...makeProps()} />);

        const select = screen.getByRole('combobox');
        expect(getConfirmButton()).toBeDisabled();

        fireEvent.change(select, { target: { value: 'Goblin' } });
        expect(getConfirmButton()).not.toBeDisabled();

        fireEvent.change(select, { target: { value: '' } });
        expect(getConfirmButton()).toBeDisabled();

        fireEvent.change(select, { target: { value: 'Orc' } });
        fireEvent.click(getConfirmButton());
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
        expect(mockOnConfirm).toHaveBeenCalledWith({ secondTarget: 'Orc' });
        expect(mockOnSkip).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Cast on First Target Only' }));
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });
});
