// @maintained-by-ai 2026-11-17
// Lane: NpcUnarmedConfirmModal — the copy/chrome layer for the campaign-NPC
// unarmed join-confirm (backlog 2026-11-17 EG, replaces the INVERTED native
// window.confirm retired from npcCombatService). OWNED here: the honest
// situation copy (no weapons/attacks + Unarmed Strike outcome, with a
// regression guard that the inverted native sentence never resurfaces), the
// explicit `Add anyway` / `Cancel` button labels, the heading/aria tier, the
// null-when-idle mount contract, the callback pass-through, and the modal
// family's dismissal convention (Escape/backdrop route to the inert onCancel).
// Service refusal + addUnarmed join bytes → npcCombatService.test.js;
// host wiring (row + save-and-add + quick action) → NPCs.test.jsx.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NpcUnarmedConfirmModal from './NpcUnarmedConfirmModal.jsx';

const renderModal = (pending, onCancel = vi.fn(), onConfirm = vi.fn()) => {
    render(
        <NpcUnarmedConfirmModal pending={pending} onCancel={onCancel} onConfirm={onConfirm} />
    );
    return { onCancel, onConfirm };
};

const PENDING = { name: 'Goblin' };

describe('NpcUnarmedConfirmModal', () => {
    it('renders nothing while no unarmed join is armed', () => {
        const { container } = render(
            <NpcUnarmedConfirmModal pending={null} onCancel={vi.fn()} onConfirm={vi.fn()} />
        );
        expect(container.innerHTML).toBe('');
    });

    it('modern a11y tier: role=dialog + aria-modal + heading labelled via aria-labelledby', () => {
        renderModal(PENDING);
        const dialog = screen.getByRole('dialog', { name: 'No Weapons or Attacks' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        const heading = screen.getByRole('heading', { name: 'No Weapons or Attacks' });
        expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
        expect(heading.id).toBe('npc-unarmed-confirm-title');
    });

    it('renders the neutral shared modal-shell chrome — no maps-manager-* class anywhere in the subtree', () => {
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

    it('states the situation honestly with explicit Add anyway / Cancel buttons — no inverted sentence', () => {
        renderModal(PENDING);
        const paragraph = document.querySelector('.modal-shell p');
        expect(paragraph.textContent).toBe(
            'Goblin has no weapons or attacks. If you add them to Initiative now, they will fight with an Unarmed Strike.'
        );
        expect(paragraph.textContent).not.toMatch(/choose cancel/i);
        expect(screen.getByRole('button', { name: 'Cancel', exact: true })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add anyway', exact: true })).toBeInTheDocument();
    });

    it('routes Cancel/Add anyway clicks to the parent handlers', () => {
        const { onCancel, onConfirm } = renderModal(PENDING);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Add anyway', exact: true }));
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
