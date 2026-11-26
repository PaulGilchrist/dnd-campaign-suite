// @maintained-by-ai
// MapsManager.rename-blur-revert.test.jsx — backlog 2026-11-25 BC: the armed
// inline rename editor used to COMMIT on blur, so clicking another row's
// Rename button silently PUT the pending value (live-proved: 'SILENT
// CROSS-ROW' landed on disk), and the commit's async loadMapsList tail could
// swallow the editor the same click had just armed. Blur is now a REVERT
// (identical to Cancel/Escape: close, drop stale banner, zero writes) and the
// editor closes through a fileName-guarded lane so a late-resolving commit
// can never tear down a newer arm. Commit lanes are Enter and Confirm only.
// Harness mirrors MapsManager.rename-confirm-cancel.test.jsx; the Subscriber
// mock additionally captures handleEvent so a maps-list SSE echo can fire a
// real loadMapsList while an editor is armed.

import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapsManager from './MapsManager.jsx';

const sse = vi.hoisted(() => ({ handler: null }));

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

vi.mock('../common/Subscriber.jsx', () => ({
    default: ({ handleEvent }) => {
        sse.handler = handleEvent;
        return null;
    },
}));

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

const deferred = () => {
    let resolve;
    const promise = new Promise((res) => { resolve = res; });
    return { promise, resolve };
};

describe('MapsManager — rename blur reverts; Enter/Confirm are the only commit lanes', () => {
    let props;

    beforeEach(() => {
        vi.resetAllMocks();
        sse.handler = null;
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

    const mapsListRefresh = async () => {
        const loadsBefore = mapsService.loadMaps.mock.calls.length;
        await act(async () => {
            sse.handler({ key: 'maps-list-test-campaign', data: {} });
        });
        await waitFor(() => expect(mapsService.loadMaps.mock.calls.length).toBeGreaterThan(loadsBefore));
    };

    it('blur with a pending value reverts: zero rename writes, editor closed, row name intact (criteria 1 + 2)', async () => {
        const input = await armRename();
        fireEvent.change(input, { target: { value: 'SILENT CROSS-ROW' } });

        fireEvent.blur(input);

        expect(mapsService.renameMap).not.toHaveBeenCalled();
        expect(screen.queryByPlaceholderText('Rename to…')).not.toBeInTheDocument();
        expect(screen.getByText('Battle Arena')).toBeInTheDocument();
        await waitFor(() => expect(mapsService.renameMap).not.toHaveBeenCalled());
    });

    it('clicking another row\'s Rename while an editor is armed does NOT commit the pending value and arms the clicked row cleanly (criteria 1 + 4)', async () => {
        const input = await armRename('Battle Arena');
        fireEvent.change(input, { target: { value: 'SILENT CROSS-ROW' } });

        // Browser order for a cross-row click: focus change blurs the input
        // first, then the clicked button's handler arms its own editor.
        fireEvent.blur(input);
        fireEvent.click(screen.getByRole('button', { name: 'Rename "Test Map"' }));

        // Zero commits for the abandoned editor; the old name stays listed.
        expect(mapsService.renameMap).not.toHaveBeenCalled();
        expect(screen.getByText('Battle Arena')).toBeInTheDocument();

        // The click's own arm mounted and stayed mounted with its controls.
        const secondInput = screen.getByPlaceholderText('Rename to…');
        expect(secondInput).toHaveValue('Test Map');
        expect(screen.getByRole('button', { name: 'Confirm rename for "Test Map"' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel rename for "Test Map"' })).toBeInTheDocument();
        await waitFor(() => expect(mapsService.renameMap).not.toHaveBeenCalled());
    });

    it('Enter remains a commit lane: exactly one rename call with the edited value (criterion 3)', async () => {
        const input = await armRename();
        fireEvent.change(input, { target: { value: 'Renamed Arena' } });

        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() =>
            expect(mapsService.renameMap).toHaveBeenCalledWith('test-campaign', 'battle-arena.json', 'Renamed Arena'));
        expect(mapsService.renameMap).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByPlaceholderText('Rename to…')).not.toBeInTheDocument());
    });

    it('Confirm remains a commit lane: exactly one rename call, then the list reloads (criteria 3 + 4)', async () => {
        const input = await armRename();
        fireEvent.change(input, { target: { value: 'Renamed Arena' } });
        const loadsBefore = mapsService.loadMaps.mock.calls.length;

        fireEvent.click(screen.getByRole('button', { name: 'Confirm rename for "Battle Arena"' }));

        await waitFor(() =>
            expect(mapsService.renameMap).toHaveBeenCalledWith('test-campaign', 'battle-arena.json', 'Renamed Arena'));
        expect(mapsService.renameMap).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(mapsService.loadMaps.mock.calls.length).toBeGreaterThan(loadsBefore));
        expect(screen.getByRole('button', { name: 'Rename "Battle Arena"' })).toBeInTheDocument();
    });

    it('an armed editor survives a SSE-triggered loadMapsList re-render with its pending value and controls (criterion 4)', async () => {
        const input = await armRename();
        fireEvent.change(input, { target: { value: 'Pending Edit' } });

        await mapsListRefresh();

        const stillThere = screen.getByPlaceholderText('Rename to…');
        expect(stillThere).toHaveValue('Pending Edit');
        expect(screen.getByRole('button', { name: 'Confirm rename for "Battle Arena"' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel rename for "Battle Arena"' })).toBeInTheDocument();
        expect(mapsService.renameMap).not.toHaveBeenCalled();
    });

    it('a late-resolving commit does not swallow an editor armed while it was in flight (criterion 4)', async () => {
        const gate = deferred();
        mapsService.renameMap.mockReturnValueOnce(gate.promise);
        const input = await armRename('Battle Arena');
        fireEvent.change(input, { target: { value: 'Renamed Arena' } });

        // Enter starts the commit; while it is in flight the user arms row B.
        fireEvent.keyDown(input, { key: 'Enter' });
        fireEvent.blur(input);
        fireEvent.click(screen.getByRole('button', { name: 'Rename "Test Map"' }));

        // The commit resolves and its list reload lands on top of B's arm.
        await act(async () => { gate.resolve({}); });
        await waitFor(() =>
            expect(mapsService.renameMap).toHaveBeenCalledWith('test-campaign', 'battle-arena.json', 'Renamed Arena'));

        // B's editor survived: value prefilled, Confirm/Cancel present.
        const secondInput = screen.getByPlaceholderText('Rename to…');
        expect(secondInput).toHaveValue('Test Map');
        expect(screen.getByRole('button', { name: 'Confirm rename for "Test Map"' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel rename for "Test Map"' })).toBeInTheDocument();
        expect(mapsService.renameMap).toHaveBeenCalledTimes(1);
    });

    it('existing gates do not regress: Escape, empty, same-name and duplicate all write zero (criterion 5)', async () => {
        await mount();
        const arm = (name = 'Battle Arena') => {
            fireEvent.click(screen.getByRole('button', { name: `Rename "${name}"` }));
            return screen.getByPlaceholderText('Rename to…');
        };

        // Escape closes with zero writes.
        let input = arm();
        fireEvent.change(input, { target: { value: 'Escape Junk' } });
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(screen.getByText('Battle Arena')).toBeInTheDocument();
        expect(mapsService.renameMap).not.toHaveBeenCalled();

        // Empty commit is a silent cancel.
        input = arm();
        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.queryByPlaceholderText('Rename to…')).not.toBeInTheDocument();
        expect(mapsService.renameMap).not.toHaveBeenCalled();

        // Same-name Confirm is a no-op.
        input = arm();
        fireEvent.click(screen.getByRole('button', { name: 'Confirm rename for "Battle Arena"' }));
        expect(screen.queryByPlaceholderText('Rename to…')).not.toBeInTheDocument();
        expect(mapsService.renameMap).not.toHaveBeenCalled();

        // Duplicate name raises the inline banner with zero writes AND keeps
        // the editor armed with the rejected text (backlog 2026-11-26).
        input = arm();
        fireEvent.change(input, { target: { value: 'Test Map' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() =>
            expect(screen.getByText('A map with that name already exists')).toBeInTheDocument());
        expect(mapsService.renameMap).not.toHaveBeenCalled();
        expect(screen.getByPlaceholderText('Rename to…')).toHaveValue('Test Map');
    });
});
