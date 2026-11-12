// @maintained-by-ai
// MapsManager.rename-cancel-error.test.jsx — regression for backlog
// 2026-11-12 RS: the error banner survived a rename CANCEL (Escape or
// empty/whitespace blur) and only cleared on the next successful action —
// after a dup-rename error, pressing Escape left the stale
// "A map with that name already exists" hovering over an untouched row.
// Cancel branches (Escape, empty-blur) and a fresh handleStartRename now
// mirror the setError(null)-on-action pattern of the success lanes.
// Harness mirrors MapsManager.empty-kebab-gate.test.jsx.

import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
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

// Byte-pinned dup copy (unified client+server in 8c9c8f6ca, playbook §46).
const DUP_COPY = 'A map with that name already exists';

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
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

describe('MapsManager — rename cancel clears the error banner', () => {
    let props;

    beforeEach(() => {
        vi.resetAllMocks();
        mapsService.loadMaps.mockResolvedValue({ maps: twoMaps() });
        mapsService.renameMap.mockResolvedValue({});
        mapsService.activateMap.mockResolvedValue({});
        props = { campaignName: 'test-campaign', onOpenMap: vi.fn() };
    });

    // Trigger the dup-rename inline error: rename Battle Arena to an existing
    // display name and commit with Enter. The gate branch sets the banner and
    // closes the input; renameMap must never fire.
    const triggerDupError = async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Rename "Battle Arena"' }));
        const input = screen.getByDisplayValue('Battle Arena');
        fireEvent.change(input, { target: { value: 'Test Map' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(screen.getByText(DUP_COPY)).toBeInTheDocument());
        expect(mapsService.renameMap).not.toHaveBeenCalled();
    };

    const mount = async () => {
        render(<MapsManager {...props} />);
        await waitFor(() => expect(screen.getByText('Battle Arena')).toBeInTheDocument());
    };

    it('dup error → fresh Rename clears the banner and Escape cancels with zero writes (criteria 1 + 3)', async () => {
        await mount();
        await triggerDupError();

        // Criterion 3: handleStartRename resets error — no stale banner the
        // moment a fresh rename opens.
        fireEvent.click(screen.getByRole('button', { name: 'Rename "Battle Arena"' }));
        expect(screen.queryByText(DUP_COPY)).not.toBeInTheDocument();
        const input = screen.getByDisplayValue('Battle Arena');

        // Criterion 1: Escape cancels — banner gone from the DOM, row name
        // byte-intact, and no rename request ever hit the service.
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(screen.queryByText(DUP_COPY)).not.toBeInTheDocument();
        expect(screen.getByText('Battle Arena')).toBeInTheDocument();
        await waitFor(() => expect(mapsService.renameMap).not.toHaveBeenCalled());
    });

    it('dup error → empty/whitespace blur ends with the banner gone and zero writes (criterion 2)', async () => {
        await mount();
        await triggerDupError();

        fireEvent.click(screen.getByRole('button', { name: 'Rename "Battle Arena"' }));
        const input = screen.getByDisplayValue('Battle Arena');
        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.blur(input);

        expect(screen.queryByText(DUP_COPY)).not.toBeInTheDocument();
        expect(screen.getByText('Battle Arena')).toBeInTheDocument();
        await waitFor(() => expect(mapsService.renameMap).not.toHaveBeenCalled());
    });

    // The gate branches close the input as they set the banner, so the only way
    // a banner is live WHILE the rename input is open is an async lane error
    // (a list reload failing behind the open input) — the race rig below pins
    // the Escape and empty-blur cancel legs directly, independently of the
    // handleStartRename clear.
    const openRenameBehindAsyncError = async () => {
        const gate = deferred();
        let loads = 0;
        mapsService.activateMap.mockImplementation(() => gate.promise);
        mapsService.loadMaps.mockImplementation(() => {
            loads += 1;
            return loads === 1
                ? Promise.resolve({ maps: twoMaps() })
                : Promise.reject(new Error('Failed to load maps'));
        });
        await mount();

        // Kick off an activate (pending), open a rename over the top, then let
        // the activate's list reload FAIL — the banner lands with the input
        // still mounted.
        fireEvent.click(screen.getByRole('button', { name: 'Activate "Test Map"' }));
        fireEvent.click(screen.getByRole('button', { name: 'Rename "Battle Arena"' }));
        const input = screen.getByDisplayValue('Battle Arena');
        await act(async () => { gate.resolve({}); });
        await waitFor(() => expect(screen.getByText('Failed to load maps')).toBeInTheDocument());
        return input;
    };

    it('Escape clears a banner raised while the rename input was open (cancel-leg pin)', async () => {
        const input = await openRenameBehindAsyncError();

        fireEvent.keyDown(input, { key: 'Escape' });
        expect(screen.queryByText('Failed to load maps')).not.toBeInTheDocument();
        expect(mapsService.renameMap).not.toHaveBeenCalled();
    });

    it('empty-blur clears a banner raised while the rename input was open (cancel-leg pin)', async () => {
        const input = await openRenameBehindAsyncError();

        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.blur(input);
        expect(screen.queryByText('Failed to load maps')).not.toBeInTheDocument();
        expect(mapsService.renameMap).not.toHaveBeenCalled();
    });

    it('a successful rename still saves and clears the banner (criterion 4)', async () => {
        await mount();
        await triggerDupError();

        fireEvent.click(screen.getByRole('button', { name: 'Rename "Battle Arena"' }));
        const input = screen.getByDisplayValue('Battle Arena');
        fireEvent.change(input, { target: { value: 'Renamed Arena' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() =>
            expect(mapsService.renameMap).toHaveBeenCalledWith('test-campaign', 'battle-arena.json', 'Renamed Arena'));
        expect(screen.queryByText(DUP_COPY)).not.toBeInTheDocument();
    });

    it('existing gates preserved: kebab-junk commit errors, same-name commit cancels silently (criterion 4)', async () => {
        await mount();

        // Kebab-junk → inline gate copy, zero write.
        fireEvent.click(screen.getByRole('button', { name: 'Rename "Battle Arena"' }));
        let input = screen.getByDisplayValue('Battle Arena');
        fireEvent.change(input, { target: { value: '!!!' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() =>
            expect(screen.getByText('Map name must contain letters or numbers')).toBeInTheDocument());
        expect(mapsService.renameMap).not.toHaveBeenCalled();

        // Same-name commit → silent cancel: no error, no write.
        fireEvent.click(screen.getByRole('button', { name: 'Rename "Battle Arena"' }));
        input = screen.getByDisplayValue('Battle Arena');
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(screen.queryByDisplayValue('Battle Arena')).not.toBeInTheDocument());
        expect(screen.queryByText('Map name must contain letters or numbers')).not.toBeInTheDocument();
        expect(mapsService.renameMap).not.toHaveBeenCalled();
    });
});
