// @maintained-by-ai
// Lane: FriendlyFireConfirmModal — the copy/chrome layer for the initiative
// friendly-fire overlay (backlog 2026-11-04 CQ, replaces the retired native
// window.confirm in createCreatureHandlers.handleTargetChange). OWNED here: the
// verbatim question copy (byte-identical to the native string it replaced),
// the heading/confirm-label derivation, the null-when-idle mount contract, the
// callback pass-through, and the modal family's dismissal convention PINNED
// (backdrop click and Escape do NOT cancel — an explicit button answers).
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

    it('renders the retired native-confirm copy VERBATIM plus explicit buttons', () => {
        renderModal(PENDING);
        const paragraph = document.querySelector('.maps-manager-modal p');
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

    it('family dismissal convention: backdrop click and Escape do NOT cancel — it waits indefinitely', () => {
        const { onCancel, onConfirm } = renderModal(PENDING);
        fireEvent.click(document.querySelector('.maps-manager-modal-overlay'));
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(onCancel).not.toHaveBeenCalled();
        expect(onConfirm).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});
