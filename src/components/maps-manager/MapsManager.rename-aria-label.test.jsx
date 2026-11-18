// @maintained-by-ai
// MapsManager.rename-aria-label.test.jsx — a11y/automation pin (backlog
// GK 2026-11-17): while a row's inline rename is open, the rename <input>
// carries a stable, map-name-specific aria-label (`New name for "<map>"`)
// mirroring the row-control idiom (`Rename "<map>"`, `Open "<map>"`).
// Previously the input was only reachable via the `value` PROPERTY, so
// `input[value="<name>"]` attribute locators raced on `.press()`. The
// commit/dismiss lanes themselves are pinned in
// MapsManager.rename-cancel-error.test.jsx — these tests re-ride them
// through the accessible name to prove the locator resolves first try.
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

describe('MapsManager — rename input accessible name', () => {
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

    const openRename = async (name) => {
        await mount();
        fireEvent.click(screen.getByRole('button', { name: `Rename "${name}"` }));
    };

    // Criterion 1: the live input carries the exact mirrored label.
    it('pins aria-label New name for "<map>" on the open rename input', async () => {
        await openRename('Battle Arena');
        const input = screen.getByDisplayValue('Battle Arena');
        expect(input.getAttribute('aria-label')).toBe('New name for "Battle Arena"');
    });

    // Criterion 4: an accessible-name locator resolves the input first try,
    // and the existing Enter commit lane rides it unchanged.
    it('role textbox keyed by the accessible name resolves and commits via Enter', async () => {
        await openRename('Battle Arena');
        const input = screen.getByRole('textbox', { name: 'New name for "Battle Arena"' });
        expect(input).toBeInTheDocument();

        fireEvent.change(input, { target: { value: 'Renamed Arena' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() =>
            expect(mapsService.renameMap).toHaveBeenCalledWith('test-campaign', 'battle-arena.json', 'Renamed Arena'));
        expect(screen.queryByRole('textbox', { name: 'New name for "Battle Arena"' })).not.toBeInTheDocument();
    });

    // The label tracks each row's own map name (not a shared constant).
    it('names the label after the row being renamed', async () => {
        await openRename('Test Map');
        expect(screen.getByRole('textbox', { name: 'New name for "Test Map"' })).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'New name for "Battle Arena"' })).not.toBeInTheDocument();
    });

    // Criterion 3 (symmetry guard): dismiss lanes stay intact through the
    // named locator — Escape cancels with zero writes.
    it('Escape through the named locator still cancels with zero writes', async () => {
        await openRename('Battle Arena');
        const input = screen.getByRole('textbox', { name: 'New name for "Battle Arena"' });
        fireEvent.change(input, { target: { value: 'Renamed Arena' } });
        fireEvent.keyDown(input, { key: 'Escape' });

        expect(screen.getByText('Battle Arena')).toBeInTheDocument();
        await waitFor(() => expect(mapsService.renameMap).not.toHaveBeenCalled());
    });
});
