// @maintained-by-ai: 2026-11-01
// Accessibility pin for the Delete-map confirm (backlog 2026-11-01 AY):
// role="dialog" + aria-modal + labelled-by the "Delete Map" heading, discoverable
// by standard [role=dialog] probes, with a working focus trap. Mirrors the
// AiInstructionModal semantics; delete-lane behavior pinned in MapsManager.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapsManager from './MapsManager.jsx';

vi.mock('../../services/maps/mapsService.js', () => ({
    toKebabCase: (name) => name,
    loadMaps: vi.fn(),
    createMap: vi.fn(),
    deleteMap: vi.fn(),
    renameMap: vi.fn(),
    activateMap: vi.fn(),
    loadMapData: vi.fn(),
    updateMapDescription: vi.fn(),
}));

vi.mock('../common/Subscriber.jsx', () => ({
    default: () => null,
}));

vi.mock('./GenerateDungeonModal.jsx', () => ({ default: () => null }));
vi.mock('./GenerateTerrainModal.jsx', () => ({ default: () => null }));

import * as mapsService from '../../services/maps/mapsService.js';

const MAP = {
    fileName: 'dungeon-level-1.json',
    name: 'Dungeon Level 1',
    type: 'indoor',
    isActive: false,
};

describe('MapsManager Delete-map modal accessibility', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mapsService.loadMaps.mockResolvedValue({ maps: [MAP] });
    });

    async function openDeleteModal() {
        render(<MapsManager campaignName="test-campaign" onOpenMap={vi.fn()} />);
        await waitFor(() => expect(screen.getByText(MAP.name)).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: `Delete "${MAP.name}"` }));
        return screen.getByRole('dialog', { name: 'Delete Map' });
    }

    // Criterion 1 — role/aria semantics + accessible name from the heading.
    it('exposes the confirm as a labelled modal dialog', async () => {
        const dialog = await openDeleteModal();
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        const headingId = dialog.getAttribute('aria-labelledby');
        expect(headingId).toBeTruthy();
        const heading = document.getElementById(headingId);
        expect(heading).toHaveTextContent('Delete Map');
    });

    // Criterion 2 — standard [role=dialog] probe finds it while open.
    it('is found by a plain [role=dialog] query while the confirm is open', async () => {
        await openDeleteModal();
        const dialogs = document.querySelectorAll('[role="dialog"]');
        expect(dialogs.length).toBeGreaterThanOrEqual(1);
        expect(dialogs[0].classList).toContain('modal-shell');
    });

    // Criterion 3 — focus management: entry + two-way Tab wrap.
    it('moves focus into the dialog on open and traps Tab at both ends', async () => {
        const dialog = await openDeleteModal();
        const cancel = screen.getByRole('button', { name: 'Cancel' });
        const confirm = screen.getByRole('button', { name: /Yes, Delete Permanently/i });

        // Open → focus lands on the dialog's first focusable element.
        expect(cancel).toHaveFocus();
        expect(dialog.contains(document.activeElement)).toBe(true);

        // Tab from the LAST focusable element wraps to the FIRST.
        confirm.focus();
        fireEvent.keyDown(confirm, { key: 'Tab' });
        expect(cancel).toHaveFocus();

        // Shift+Tab from the FIRST focusable element wraps to the LAST.
        fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
        expect(confirm).toHaveFocus();
    });

    it('keeps the delete lane intact: confirm still deletes through the service', async () => {
        const dialog = await openDeleteModal();
        expect(dialog).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Yes, Delete Permanently/i }));
        await waitFor(() => {
            expect(mapsService.deleteMap).toHaveBeenCalledWith('test-campaign', MAP.fileName);
        });
        expect(screen.queryByRole('dialog', { name: 'Delete Map' })).not.toBeInTheDocument();
    });
});
