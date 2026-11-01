// @maintained-by-ai
// Lane: SpellOverlayConfirmModal — the descriptor→copy seam for the spell
// overlay destructive lanes (backlog 2026-11-01 BA, replaces the retired
// native confirms in useSpellOverlay). OWNED here: the verbatim copy both
// lanes show (`Remove this <Shape> overlay?` and `Clear all N spell
// overlay(s)? This removes overlays placed by everyone.` — count-noun gate
// included), the heading/confirm-label derivation per kind, the null-when-idle
// mount contract, and the callback pass-through. A11y tier of the underlying
// dialog → common/DeleteConfirmModal.test.jsx; descriptor arming →
// hooks/useSpellOverlay.test.js; Map mount → Map.spell-overlay-confirm.test.jsx.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SpellOverlayConfirmModal from './SpellOverlayConfirmModal.jsx';

const renderModal = (pending, onCancel = vi.fn(), onConfirm = vi.fn()) => {
    render(
        <SpellOverlayConfirmModal pending={pending} onCancel={onCancel} onConfirm={onConfirm} />
    );
    return { onCancel, onConfirm };
};

describe('SpellOverlayConfirmModal', () => {
    it('renders nothing while no overlay action is armed', () => {
        const { container } = render(
            <SpellOverlayConfirmModal pending={null} onCancel={vi.fn()} onConfirm={vi.fn()} />
        );
        expect(container.innerHTML).toBe('');
    });

    it('remove descriptor → "Remove Overlay" dialog naming the shape', () => {
        renderModal({ kind: 'remove', label: 'Sphere', confirm: vi.fn() });
        const dialog = screen.getByRole('dialog', { name: 'Remove Overlay' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveTextContent('Remove this Sphere overlay?');
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Yes, Remove' })).toBeInTheDocument();
    });

    it('unknown-shape descriptor keeps the honest generic "spell" fallback in the copy', () => {
        renderModal({ kind: 'remove', label: 'spell', confirm: vi.fn() });
        expect(screen.getByRole('dialog')).toHaveTextContent('Remove this spell overlay?');
    });

    it('clear descriptor → "Clear All Overlays" dialog naming the count and the everyone-scope', () => {
        renderModal({ kind: 'clear', count: 2, confirm: vi.fn() });
        const dialog = screen.getByRole('dialog', { name: 'Clear All Overlays' });
        expect(dialog).toHaveTextContent(
            'Clear all 2 spell overlays? This removes overlays placed by everyone.'
        );
        expect(screen.getByRole('button', { name: 'Yes, Clear All' })).toBeInTheDocument();
    });

    it('count-noun gate: exactly 1 reads singular', () => {
        renderModal({ kind: 'clear', count: 1, confirm: vi.fn() });
        expect(screen.getByRole('dialog')).toHaveTextContent(
            'Clear all 1 spell overlay? This removes overlays placed by everyone.'
        );
    });

    it('routes Cancel/Confirm clicks to the parent handlers', () => {
        const { onCancel, onConfirm } = renderModal({ kind: 'clear', count: 3, confirm: vi.fn() });
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'Yes, Clear All' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
