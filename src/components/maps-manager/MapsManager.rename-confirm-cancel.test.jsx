// @maintained-by-ai
// MapsManager.rename-confirm-cancel.test.jsx — backlog 2026-11-24 BA: the
// toolbar create field (`New map name...`, Enter CREATES) and the row's armed
// inline rename editor (Enter commits the rename) were two near-identical
// name-entry affordances — a live self-trap where a rename attempt typed into
// the toolbar silently created an extra map. The armed editor now carries TWO
// distinguishing affordances: a distinct placeholder (`Rename to…`) and a
// Confirm/Cancel button pair replacing the row's plain Rename button while
// armed. Commit lanes are UNCHANGED: Enter still commits, Confirm rides the
// same handleRenameSave, Cancel rides the Escape lane (zero writes), and the
// toolbar Enter-creates semantics are pinned untouched.
// Harness mirrors MapsManager.rename-cancel-error.test.jsx.

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapsManager from './MapsManager.jsx';

vi.mock('../../services/maps/mapsService.js', async (importActual) => ({
    ...await importActual(),
    loadMaps: vi.fn(),
    createMap: vi.fn(),
    deleteMap: vi.fn(),
    renameMap: vi.fn(),
    activateMap: vi.fn(),
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
    makeMap({ fileName: 'test-map.json', name: 'Test Map' }),
];

describe('MapsManager — armed rename is distinguishable from the toolbar create field', () => {
    let props;

    beforeEach(() => {
        vi.resetAllMocks();
        mapsService.loadMaps.mockResolvedValue({ maps: twoMaps() });
        mapsService.renameMap.mockResolvedValue({});
        mapsService.createMap.mockResolvedValue({});
        props = { campaignName: 'test-campaign', onOpenMap: vi.fn() };
    });

    const mount = async () => {
        render(<MapsManager {...props} />);
        await waitFor(() => expect(screen.getByText('Battle Arena')).toBeInTheDocument());
    };

    const openRename = async (name = 'Battle Arena') => {
        await mount();
        fireEvent.click(screen.getByRole('button', { name: `Rename "${name}"` }));
    };

    it('arming the rename editor renders the distinct placeholder and a Confirm/Cancel pair in place of the row Rename button (criterion 1)', async () => {
        await openRename();

        const input = screen.getByRole('textbox', { name: 'New name for "Battle Arena"' });
        expect(input.getAttribute('placeholder')).toBe('Rename to…');

        // The armed row swaps Rename → Confirm/Cancel.
        expect(screen.getByRole('button', { name: 'Confirm rename for "Battle Arena"' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel rename for "Battle Arena"' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Rename "Battle Arena"' })).not.toBeInTheDocument();

        // Sibling rows keep their plain Rename button (only the armed row swaps).
        expect(screen.getByRole('button', { name: 'Rename "Test Map"' })).toBeInTheDocument();
    });

    it('toolbar create field is untouched: placeholder stays "New map name..." and Enter still creates (criterion 2)', async () => {
        await openRename();

        const createInput = screen.getByPlaceholderText('New map name...');
        expect(createInput.getAttribute('placeholder')).toBe('New map name...');

        fireEvent.change(createInput, { target: { value: 'Brand New Map' } });
        fireEvent.keyDown(createInput, { key: 'Enter' });

        await waitFor(() =>
            expect(mapsService.createMap).toHaveBeenCalledWith('test-campaign', 'Brand New Map', { type: 'indoor' }));
        // Creating from the toolbar never renames anything.
        expect(mapsService.renameMap).not.toHaveBeenCalled();
    });

    it('Enter in the rename input still commits via the rename lane, unchanged (criterion 3)', async () => {
        await openRename();
        const input = screen.getByRole('textbox', { name: 'New name for "Battle Arena"' });

        fireEvent.change(input, { target: { value: 'Renamed Arena' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() =>
            expect(mapsService.renameMap).toHaveBeenCalledWith('test-campaign', 'battle-arena.json', 'Renamed Arena'));
        expect(mapsService.createMap).not.toHaveBeenCalled();
    });

    it('Confirm commits exactly like Enter and the row returns to its standard button set (criterion 4)', async () => {
        await openRename();
        const input = screen.getByRole('textbox', { name: 'New name for "Battle Arena"' });
        fireEvent.change(input, { target: { value: 'Renamed Arena' } });

        fireEvent.click(screen.getByRole('button', { name: 'Confirm rename for "Battle Arena"' }));

        await waitFor(() =>
            expect(mapsService.renameMap).toHaveBeenCalledWith('test-campaign', 'battle-arena.json', 'Renamed Arena'));
        expect(mapsService.createMap).not.toHaveBeenCalled();

        // Editor closed, plain Rename button back.
        expect(screen.queryByRole('textbox', { name: 'New name for "Battle Arena"' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Rename "Battle Arena"' })).toBeInTheDocument();
    });

    it('Cancel performs zero writes, closes the editor, and restores the standard row buttons (criterion 4)', async () => {
        await openRename();
        const input = screen.getByRole('textbox', { name: 'New name for "Battle Arena"' });
        fireEvent.change(input, { target: { value: 'Renamed Arena' } });

        fireEvent.click(screen.getByRole('button', { name: 'Cancel rename for "Battle Arena"' }));

        expect(screen.getByText('Battle Arena')).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'New name for "Battle Arena"' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Rename "Battle Arena"' })).toBeInTheDocument();
        await waitFor(() => {
            expect(mapsService.renameMap).not.toHaveBeenCalled();
            expect(mapsService.createMap).not.toHaveBeenCalled();
        });
    });

    it('Cancel clears a stale error banner like the Escape lane (criterion 4)', async () => {
        await openRename();
        const input = screen.getByRole('textbox', { name: 'New name for "Battle Arena"' });

        // Dup commit sets the banner (gate branch closes the editor)...
        fireEvent.change(input, { target: { value: 'Test Map' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() =>
            expect(screen.getByText('A map with that name already exists')).toBeInTheDocument());

        // ...a fresh arm, then Cancel, ends with no banner and zero writes.
        fireEvent.click(screen.getByRole('button', { name: 'Rename "Battle Arena"' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel rename for "Battle Arena"' }));
        expect(screen.queryByText('A map with that name already exists')).not.toBeInTheDocument();
        await waitFor(() => expect(mapsService.renameMap).not.toHaveBeenCalled());
    });
});
