// @maintained-by-ai 2026-11-26
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PolymorphSelectionModal from './PolymorphSelectionModal.jsx';
import {
    WOLF, CROCODILE, EAGLE, RAT,
    assertDiskRows, SHARED_MONSTER_PINS,
    findBeastItem,
} from './PolymorphSelectionModal.test-utils.js';

// Focus-entrance lane (backlog 2026-11-17 FH: the chooser left
// document.activeElement on BODY while open — no keyboard entrance into the
// 74-beast list). Locks criteria-level behaviour: entrance lands INSIDE the
// overlay (search input), rows are keyboard-focusable options whose Enter/Space
// activation is the SAME arm the click performs (semantics unchanged),
// ArrowUp/Down rove with wrap, and close restores focus out of BODY. The hook
// mechanics themselves are unit-pinned in src/hooks/ui/
// useOverlayEntranceFocus.test.js — do not duplicate them here.
//
// Fixture strategy mirrors the core lane (PolymorphSelectionModal.test.jsx):
// real disk rows via test-utils with drift-throws, dataLoader mocked.

assertDiskRows(SHARED_MONSTER_PINS);

const mockMonsters = [WOLF, CROCODILE, EAGLE, RAT];

vi.mock('../../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(async () => mockMonsters),
}));

// 2024 lv20 druid twin of the WSD fixture shape (max 4 uses, CR 1 beasts).
const druidStats2024 = {
    rules: '2024',
    level: 20,
    class: { name: 'Druid', class_levels: [{ level: 20, beast_max_cr: 1, wild_shape: 4 }] },
};

const baseProps = {
    playerStats: druidStats2024,
    campaignName: 'test-campaign',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
};

function getBeastItems() {
    return Array.from(document.querySelectorAll('.wild-shape-beast-item'));
}

// React 19's concurrent unmount defers passive cleanup past a bare microtask;
// one macrotask tick inside act is the settle bound (benign test-only timer).
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

async function renderLoadedModal(props = baseProps) {
    const result = render(<PolymorphSelectionModal {...props} />);
    await waitFor(() => {
        expect(document.querySelectorAll('.wild-shape-beast-item').length).toBeGreaterThan(0);
    });
    // waitFor resolves on the rows' DOM mutation, but the entrance pull lives
    // in a passive effect flushed via React 19's scheduler — under full-suite
    // load the scheduler lags the awaited continuation and focus is still on
    // BODY at assertion time (batch224 flake). One macrotask tick inside act
    // (the file's settle bound) guarantees the effect ran before we assert.
    await flush();
    return result;
}

describe('PolymorphSelectionModal: focus entrance and keyboard path', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        // Drain a prior test's queued close-restore before asserting focus.
        await flush();
        document.activeElement?.blur();
    });

    it('opens with focus INSIDE the overlay on the search input (never BODY)', async () => {
        const { container } = await renderLoadedModal();
        const overlay = container.querySelector('.sp-overlay');
        expect(overlay.contains(document.activeElement)).toBe(true);
        expect(document.activeElement).toBe(screen.getByPlaceholderText('Search beasts...'));
    });

    it('is a labelled role=dialog with an option list inside', async () => {
        await renderLoadedModal();
        const dialog = screen.getByRole('dialog', { name: 'Wild Shape' });
        expect(dialog).toBeInTheDocument();
        expect(screen.getByRole('listbox', { name: 'Choose a beast form (CR 1 or lower)' })).toBeInTheDocument();
        expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('ArrowDown/ArrowUp rove the rows from the entrance focus path (Tab order intact)', async () => {
        await renderLoadedModal();
        const rows = getBeastItems();
        rows[0].focus();
        fireEvent.keyDown(rows[0], { key: 'ArrowDown' });
        expect(document.activeElement).toBe(rows[1]);
        fireEvent.keyDown(rows[1], { key: 'ArrowUp' });
        expect(document.activeElement).toBe(rows[0]);
        // Wrap: ArrowUp from the top row lands on the bottom row.
        fireEvent.keyDown(rows[0], { key: 'ArrowUp' });
        expect(document.activeElement).toBe(rows[rows.length - 1]);
        // Every row is a real Tab stop AND confirm/Cancel are plain buttons.
        for (const row of rows) expect(row.tabIndex).toBe(0);
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    });

    it('Enter on a focused row arms it exactly like a click (same onSelect, no confirm)', async () => {
        await renderLoadedModal();
        const confirmBtn = screen.getByRole('button', { name: 'Wild Shape' });
        expect(confirmBtn).toBeDisabled();

        const wolf = findBeastItem('Wolf');
        wolf.focus();
        fireEvent.keyDown(wolf, { key: 'Enter' });
        await waitFor(() => expect(confirmBtn).toBeEnabled());
        expect(wolf.className).toContain('selected');
        expect(wolf.getAttribute('aria-selected')).toBe('true');

        // Space arms too (and never routes to onConfirm — activation parity).
        const rat = findBeastItem('Rat');
        rat.focus();
        fireEvent.keyDown(rat, { key: ' ' });
        await waitFor(() => expect(rat.className).toContain('selected'));
        expect(baseProps.onConfirm).not.toHaveBeenCalled();
    });

    it('Enter on the armed row then Enter on the focused confirm button casts once', async () => {
        await renderLoadedModal();
        fireEvent.keyDown(findBeastItem('Wolf'), { key: 'Enter' });
        const confirmBtn = screen.getByRole('button', { name: 'Wild Shape' });
        await waitFor(() => expect(confirmBtn).toBeEnabled());
        // A keyboard "press" of a focused button is a click with Enter.
        fireEvent.click(confirmBtn);
        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
        expect(baseProps.onConfirm.mock.calls[0][0]).toMatchObject({ index: 'wolf' });
    });

    it('unmount (Cancel/Escape dismissal) restores focus off BODY to the pre-open anchor', async () => {
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();

        const { unmount } = await renderLoadedModal();
        expect(document.activeElement).not.toBe(opener); // entrance pulled inside
        unmount();
        await flush();
        expect(document.activeElement).toBe(opener);
    });

    it('a pointer open (no anchor) restores to the stamped fallback host, not BODY', async () => {
        const { container, unmount } = await renderLoadedModal();
        expect(container.getAttribute('tabindex')).toBe('-1');
        unmount();
        await flush();
        expect(document.activeElement).toBe(container);
    });
});
