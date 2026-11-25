// @maintained-by-ai
// MapsManager.rename-sibling-lock.test.jsx — backlog 2026-11-25 BC (follow-up):
// with a rename editor armed, EVERY other row still rendered an identical
// enabled `Rename "<other>"` button — nothing dimmed or blocked the siblings,
// so multi-row editor mixups were one stray click away (the BC scare). While
// `renamingMap` is set, every sibling row's ACTION buttons (Open,
// Activate/Deactivate, Rename, Description, AI Dress, Regenerate, Delete) now
// render `disabled` with the cause-naming title (the `.npcs-init-btn`
// disabled-with-cause idiom), the armed row's Confirm/Cancel pair stays
// enabled, and rows carry state classes (`renaming` highlight /
// `rename-locked` dim). Closing the editor through ANY lane (Confirm-commit,
// Cancel, Escape, blur-revert) restores every row's live buttons. Harness
// mirrors MapsManager.rename-blur-revert.test.jsx.

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapsManager from './MapsManager.jsx';

const LOCK_TITLE = 'Rename editor open on another row — confirm or cancel that rename first';

vi.mock('../../services/maps/mapsService.js', async (importActual) => ({
    ...await importActual(),
    loadMaps: vi.fn(),
    createMap: vi.fn(),
    deleteMap: vi.fn(),
    renameMap: vi.fn(),
    activateMap: vi.fn(),
    deactivateMap: vi.fn(),
    loadMapData: vi.fn(),
    updateMapDescription: vi.fn(),
}));

vi.mock('../common/Subscriber.jsx', () => ({ default: () => null }));

import * as mapsService from '../../services/maps/mapsService.js';

const makeMap = (overrides) => ({
    fileName: 'map1.json',
    name: 'Test Map',
    type: 'indoor',
    isActive: false,
    ...overrides,
});

const twoMaps = () => [
    makeMap({ fileName: 'battle-arena.json', name: 'Battle Arena' }),
    makeMap({ fileName: 'test-map.json', name: 'Test Map', generationOpts: { mode: 'bsp', seed: 7, gridSize: 40, density: 0.8 } }),
];

const rowOf = (name) => screen.getByText(name).closest('li');

/** The armed row's <li>: while armed the row's name span is REPLACED by the
 *  editor input (no text node to match), so locate through the input itself. */
const armedRow = () => screen.getByPlaceholderText('Rename to…').closest('li');

/** Every action button in a row except the ones whose accessible name is in
 *  `except` (used to skip the armed row's Confirm/Cancel pair). */
const actionButtonsOf = (name, except = []) =>
    Array.from(rowOf(name).querySelectorAll('.maps-manager-item-actions button'))
        .filter(b => !except.includes(b.getAttribute('aria-label')));

describe('MapsManager — sibling rows lock while a rename editor is armed', () => {
    let props;

    beforeEach(() => {
        vi.resetAllMocks();
        mapsService.loadMaps.mockResolvedValue({ maps: twoMaps() });
        mapsService.renameMap.mockResolvedValue({});
        props = { campaignName: 'test-campaign', onOpenMap: vi.fn() };
    });

    const mount = async () => {
        render(<MapsManager {...props} />);
        await waitFor(() => expect(screen.getByText('Battle Arena')).toBeInTheDocument());
    };

    const armRename = async (name = 'Battle Arena') => {
        await mount();
        fireEvent.click(screen.getByRole('button', { name: `Rename "${name}"` }));
        return screen.getByPlaceholderText('Rename to…');
    };

    it('idle rows carry no lock: buttons enabled, original titles intact (baseline)', async () => {
        await mount();
        const buttons = actionButtonsOf('Test Map');
        expect(buttons.length).toBeGreaterThanOrEqual(6); // Open/Activate/Rename/Description/AI Dress/Regenerate/Delete
        for (const b of buttons) {
            expect(b.disabled).toBe(false);
            expect(b.getAttribute('title')).not.toBe(LOCK_TITLE);
        }
        expect(screen.getByRole('button', { name: 'Edit description for "Test Map"' }))
            .toHaveAttribute('title', 'Edit description');
        // The stamped row keeps its generationOpts tooltip when idle.
        expect(screen.getByRole('button', { name: 'Regenerate "Test Map"' }))
            .toHaveAttribute('title', expect.stringContaining('Generated with'));
    });

    it('while armed: every sibling action button is disabled with the cause title; sibling Rename click cannot arm (criteria 1 + 4)', async () => {
        await armRename('Battle Arena');

        const buttons = actionButtonsOf('Test Map');
        expect(buttons.length).toBeGreaterThanOrEqual(6);
        for (const b of buttons) {
            expect(b.disabled).toBe(true);
            expect(b.getAttribute('title')).toBe(LOCK_TITLE);
        }

        // A stray click on the locked sibling Rename arms NOTHING: the armed
        // editor stays mounted on its own row and no second input exists.
        fireEvent.click(screen.getByRole('button', { name: 'Rename "Test Map"' }));
        expect(screen.getByPlaceholderText('Rename to…')).toBeInTheDocument();
        expect(screen.queryAllByPlaceholderText('Rename to…')).toHaveLength(1);
        // The one input still lives on the originally-armed row: the row that
        // carries the `renaming` class is the sibling of the untouched row.
        expect(armedRow().className).toContain('renaming');
        expect(armedRow()).not.toBe(rowOf('Test Map'));
        expect(mapsService.renameMap).not.toHaveBeenCalled();
    });

    it('while armed: the armed row itself keeps enabled Confirm/Cancel and the row classes mark highlight vs dim (criteria 2 + 4)', async () => {
        await armRename('Battle Arena');

        const confirm = screen.getByRole('button', { name: 'Confirm rename for "Battle Arena"' });
        const cancel = screen.getByRole('button', { name: 'Cancel rename for "Battle Arena"' });
        expect(confirm.disabled).toBe(false);
        expect(cancel.disabled).toBe(false);
        expect(confirm.getAttribute('title')).not.toBe(LOCK_TITLE);
        expect(cancel.getAttribute('title')).not.toBe(LOCK_TITLE);

        expect(armedRow().className).toContain('renaming');
        expect(armedRow().className).not.toContain('rename-locked');
        expect(rowOf('Test Map').className).toContain('rename-locked');
        expect(rowOf('Test Map').className).not.toContain('renaming');
    });

    it('Cancel re-enables every sibling button (criterion 3)', async () => {
        await armRename('Battle Arena');
        fireEvent.click(screen.getByRole('button', { name: 'Cancel rename for "Battle Arena"' }));

        await waitFor(() => expect(screen.queryByPlaceholderText('Rename to…')).not.toBeInTheDocument());
        for (const b of actionButtonsOf('Test Map')) {
            expect(b.disabled).toBe(false);
            expect(b.getAttribute('title')).not.toBe(LOCK_TITLE);
        }
        expect(screen.getByRole('button', { name: 'Edit description for "Test Map"' }))
            .toHaveAttribute('title', 'Edit description');
        expect(rowOf('Test Map').className).not.toContain('rename-locked');
        expect(rowOf('Battle Arena').className).not.toContain('renaming');
    });

    it('Escape re-enables every sibling button (criterion 3)', async () => {
        const input = await armRename('Battle Arena');
        fireEvent.keyDown(input, { key: 'Escape' });

        await waitFor(() => expect(screen.queryByPlaceholderText('Rename to…')).not.toBeInTheDocument());
        for (const b of actionButtonsOf('Test Map')) {
            expect(b.disabled).toBe(false);
            expect(b.getAttribute('title')).not.toBe(LOCK_TITLE);
        }
        expect(rowOf('Test Map').className).not.toContain('rename-locked');
    });

    it('blur-revert re-enables every sibling button (criterion 3, blur stays a REVERT)', async () => {
        const input = await armRename('Battle Arena');
        fireEvent.change(input, { target: { value: 'ABANDONED' } });
        fireEvent.blur(input);

        await waitFor(() => expect(screen.queryByPlaceholderText('Rename to…')).not.toBeInTheDocument());
        expect(mapsService.renameMap).not.toHaveBeenCalled();
        for (const b of actionButtonsOf('Test Map')) {
            expect(b.disabled).toBe(false);
            expect(b.getAttribute('title')).not.toBe(LOCK_TITLE);
        }
    });

    it('Confirm-commit re-enables every sibling button after the rename lands (criterion 3)', async () => {
        const input = await armRename('Battle Arena');
        fireEvent.change(input, { target: { value: 'Renamed Arena' } });

        fireEvent.click(screen.getByRole('button', { name: 'Confirm rename for "Battle Arena"' }));
        await waitFor(() =>
            expect(mapsService.renameMap).toHaveBeenCalledWith('test-campaign', 'battle-arena.json', 'Renamed Arena'));

        await waitFor(() => expect(screen.queryByPlaceholderText('Rename to…')).not.toBeInTheDocument());
        for (const b of actionButtonsOf('Test Map')) {
            expect(b.disabled).toBe(false);
            expect(b.getAttribute('title')).not.toBe(LOCK_TITLE);
        }
        // And the sibling Rename is live again — clicking it arms its own editor.
        fireEvent.click(screen.getByRole('button', { name: 'Rename "Test Map"' }));
        expect(screen.getByPlaceholderText('Rename to…')).toHaveValue('Test Map');
    });

    it('while armed: a pointer press anywhere on a locked sibling row is cancelled (defaultPrevented) so it cannot blur-and-rearm mid-gesture (criterion 1, live-race pin)', async () => {
        await armRename('Battle Arena');

        // Real-browser race (live-proved 2026-11-25): clicking a DISABLED
        // button still blurs the armed input; the revert re-renders the row
        // ENABLED and the click tail re-arms it. The locked row's
        // onPointerDown preventDefault cancels the whole gesture before the
        // blur can start it (Chrome dispatches pointer events even to
        // disabled controls, so this is the one lane that sees the press).
        const sibRename = screen.getByRole('button', { name: 'Rename "Test Map"' });
        const down = new Event('pointerdown', { bubbles: true, cancelable: true });
        sibRename.dispatchEvent(down);
        expect(down.defaultPrevented).toBe(true);

        const up = new Event('pointerup', { bubbles: true, cancelable: true });
        sibRename.dispatchEvent(up);
        expect(up.defaultPrevented).toBe(false);

        // No press = no blur = the armed editor (and its value) survives.
        expect(screen.queryAllByPlaceholderText('Rename to…')).toHaveLength(1);
        expect(mapsService.renameMap).not.toHaveBeenCalled();
    });

    it('idle rows take the pointer normally: no preventDefault without an armed editor', async () => {
        await mount();
        const down = new Event('pointerdown', { bubbles: true, cancelable: true });
        screen.getByRole('button', { name: 'Rename "Test Map"' }).dispatchEvent(down);
        expect(down.defaultPrevented).toBe(false);
    });
});
