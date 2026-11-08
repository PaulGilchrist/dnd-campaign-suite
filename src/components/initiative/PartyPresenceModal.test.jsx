// @maintained-by-ai
// PartyPresenceModal — the bulk Split-Party picker: presence initial state
// from the away flags, Apply emits the full want-away map for every player
// row, and the quick actions (All Present / All Away) flip the draft set.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PartyPresenceModal from './PartyPresenceModal.jsx';

const players = [
    { name: 'Ann', type: 'player', initiative: '17' },
    { name: 'Bo', type: 'player', initiative: '', away: true },
];

function renderModal() {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<PartyPresenceModal players={players} onConfirm={onConfirm} onCancel={onCancel} />);
    return { onConfirm, onCancel };
}

describe('PartyPresenceModal', () => {
    it('initialises ticks from presence state and shows the away row', () => {
        renderModal();
        expect(screen.getByLabelText('Keep Ann present').checked).toBe(true);
        expect(screen.getByLabelText('Keep Bo present').checked).toBe(false);
        expect(screen.getByText('1 away')).toBeTruthy();
    });

    it('Apply emits want-away booleans for EVERY player row', () => {
        const { onConfirm } = renderModal();
        fireEvent.click(screen.getByLabelText('Keep Ann present'));   // split Ann
        fireEvent.click(screen.getByLabelText('Keep Bo present'));    // rejoin Bo
        fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
        expect(onConfirm).toHaveBeenCalledWith({ Ann: true, Bo: false });
    });

    it('quick actions flip the whole draft; Cancel writes nothing', () => {
        const { onConfirm, onCancel } = renderModal();
        fireEvent.click(screen.getByRole('button', { name: /All Away/i }));
        expect(screen.getByLabelText('Keep Ann present').checked).toBe(false);
        fireEvent.click(screen.getByRole('button', { name: /All Present/i }));
        expect(screen.getByLabelText('Keep Bo present').checked).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
        expect(onConfirm).not.toHaveBeenCalled();
        expect(onCancel).toHaveBeenCalled();
    });

    it('renders the honest empty-board note', () => {
        render(<PartyPresenceModal players={[]} onConfirm={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByText(/No players on the initiative board/)).toBeTruthy();
        expect(screen.getByRole('button', { name: /Apply/i }).disabled).toBe(true);
    });
});
