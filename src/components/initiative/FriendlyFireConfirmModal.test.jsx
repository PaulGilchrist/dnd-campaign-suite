// @maintained-by-ai
// Lane: FriendlyFireConfirmModal — the copy/chrome layer for the initiative
// friendly-fire overlay (backlog 2026-11-04 CQ, replaces the retired native
// window.confirm in createCreatureHandlers.handleTargetChange). OWNED here: the
// verbatim question copy (byte-identical to the native string it replaced),
// the heading/confirm-label derivation, the null-when-idle mount contract, the
// callback pass-through, and the modal family's dismissal convention PINNED
// (backlog 2026-11-13 AD: backdrop click and Escape route to the inert
// onCancel — an explicit confirm still owns the destructive leg).
// Handler bridge + arm/log contract → createCreatureHandlers.friendly-fire.test.js;
// container wiring + select revert → Initiative.friendly-fire.test.jsx;
// underlying a11y tier internals → common/DeleteConfirmModal.test.jsx.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FriendlyFireConfirmModal from './FriendlyFireConfirmModal.jsx';

const renderModal = (pending, onCancel = vi.fn(), onConfirm = vi.fn()) => {
    render(
        <FriendlyFireConfirmModal pending={pending} onCancel={onCancel} onConfirm={onConfirm} />
    );
    return { onCancel, onConfirm };
};

const PENDING = { creatureName: 'Alice', targetName: 'Bob' };

describe('FriendlyFireConfirmModal', () => {
    it('renders nothing while no ally-target prompt is armed', () => {
        const { container } = render(
            <FriendlyFireConfirmModal pending={null} onCancel={vi.fn()} onConfirm={vi.fn()} />
        );
        expect(container.innerHTML).toBe('');
    });

    it('modern a11y tier: role=dialog + aria-modal + heading labelled via aria-labelledby', () => {
        renderModal(PENDING);
        const dialog = screen.getByRole('dialog', { name: 'Friendly Fire' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        const heading = screen.getByRole('heading', { name: 'Friendly Fire' });
        expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
        expect(heading.id).toBe('friendly-fire-confirm-title');
    });

    it('renders the neutral shared modal-shell chrome — no maps-manager-* class anywhere in the subtree', () => {
        // Backlog EN 2026-11-08: the confirm rides the canonical `.modal-shell-*`
        // shell (global App.css), not the Maps manager's class family (style-bleed
        // guard). DeleteConfirmModal.test.jsx covers the shell for the tier itself;
        // this pins it for the friendly-fire consumer specifically.
        renderModal(PENDING);
        const overlay = document.querySelector('.modal-shell-overlay');
        const panel = document.querySelector('.modal-shell');
        expect(overlay).toBeInTheDocument();
        expect(panel).toBeInTheDocument();
        expect(overlay).toContainElement(panel);
        expect(panel.querySelector('.modal-shell-actions')).toBeInTheDocument();
        const offenders = [overlay, ...overlay.querySelectorAll('*')]
            .flatMap(el => [...el.classList])
            .filter(cls => cls.startsWith('maps-manager'));
        expect(offenders).toEqual([]);
    });

    it('renders the retired native-confirm copy VERBATIM plus explicit buttons', () => {
        renderModal(PENDING);
        const paragraph = document.querySelector('.modal-shell p');
        expect(paragraph.textContent).toBe(
            'Friendly fire: Bob is on Alice\'s ally list. Arm them as the target anyway?'
        );
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Yes, Arm Target' })).toBeInTheDocument();
    });

    it('routes Cancel/Confirm clicks to the parent handlers', () => {
        const { onCancel, onConfirm } = renderModal(PENDING);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Yes, Arm Target' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('family dismissal convention (2026-11-13 AD): backdrop click and Escape route to onCancel', () => {
        const { onCancel, onConfirm } = renderModal(PENDING);
        const overlay = document.querySelector('.modal-shell-overlay');
        fireEvent.mouseDown(overlay);
        fireEvent.click(overlay);
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(onCancel).toHaveBeenCalledTimes(2);
        expect(onConfirm).not.toHaveBeenCalled();
    });
});
