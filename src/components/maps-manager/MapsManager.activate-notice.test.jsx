// @maintained-by-ai
// Backlog 2026-11-16 WK: Activate/Deactivate was feedback-silent — the only
// confirmation was the row button flipping label. The toggle now rides the
// shared ephemeral-toast lane (useEphemeralToast + a null-when-idle
// role="status" sink): the notice names the map, reflects the SERVER response
// (fires only after the awaited PUT), auto-hides on the benign display-only
// timer, and a failure keeps the honest .maps-manager-error banner instead of
// silence. Label-flip behavior itself stays pinned in MapsManager.test.jsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MapsManager from './MapsManager.jsx';

vi.mock('../../services/maps/mapsService.js', () => ({
    toKebabCase: (name) => name,
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
vi.mock('./GenerateDungeonModal.jsx', () => ({ default: () => null }));
vi.mock('./GenerateTerrainModal.jsx', () => ({ default: () => null }));

import * as mapsService from '../../services/maps/mapsService.js';

const forest = { fileName: 'forest.json', name: 'Forest', type: 'indoor', isActive: false };
const cave = { fileName: 'cave.json', name: 'Cave', type: 'indoor', isActive: true };

async function renderWithMaps(...maps) {
    mapsService.loadMaps.mockResolvedValue({ maps });
    const result = render(
        <MapsManager campaignName="test-campaign" onOpenMap={vi.fn()} onMapDeleted={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByText(maps[0].name)).toBeInTheDocument());
    return result;
}

describe('MapsManager activate/deactivate notice', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mapsService.loadMaps.mockResolvedValue({ maps: [] });
        mapsService.loadMapData.mockResolvedValue({ description: '' });
        mapsService.activateMap.mockResolvedValue({ message: 'Map activated successfully' });
        mapsService.deactivateMap.mockResolvedValue({ message: 'Map deactivated successfully', activeMap: null });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders no notice on a fresh load (nothing lingers before any toggle)', () => {
        render(<MapsManager campaignName="test-campaign" onOpenMap={vi.fn()} onMapDeleted={vi.fn()} />);
        expect(document.querySelector('.maps-manager-notice')).not.toBeInTheDocument();
    });

    it('naming the map in a role="status" notice after a successful activate', async () => {
        await renderWithMaps(forest);
        fireEvent.click(screen.getByRole('button', { name: 'Activate "Forest"' }));

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent('Map "Forest" activated');
        });
        expect(mapsService.activateMap).toHaveBeenCalledWith('test-campaign', 'forest.json');
    });

    it('shows "deactivated" copy on the same notice lane after a successful deactivate', async () => {
        await renderWithMaps(cave);
        fireEvent.click(screen.getByRole('button', { name: 'Deactivate "Cave"' }));

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent('Map "Cave" deactivated');
        });
        expect(mapsService.deactivateMap).toHaveBeenCalledWith('test-campaign', 'cave.json');
    });

    it('is not optimistic: no success notice while the PUT is pending, and none on failure — the error banner shows the server copy instead', async () => {
        let rejectActivate;
        mapsService.activateMap.mockImplementation(
            () => new Promise((_resolve, reject) => { rejectActivate = reject; })
        );
        await renderWithMaps(forest);
        fireEvent.click(screen.getByRole('button', { name: 'Activate "Forest"' }));

        // Server has not answered yet: silence would be a lie, so nothing shows.
        expect(document.querySelector('.maps-manager-notice')).not.toBeInTheDocument();

        await act(async () => { rejectActivate(new Error('Map "forest" not found')); });

        // Honest refusal (criterion 4), and NEVER the success notice family.
        await waitFor(() => {
            expect(screen.getByText('Map "forest" not found')).toBeInTheDocument();
        });
        expect(document.querySelector('.maps-manager-notice')).not.toBeInTheDocument();
        expect(document.querySelector('.maps-manager-error')).toHaveAttribute('role', 'status');
    });

    it('auto-hides the notice on the benign display-only timer (4000ms)', async () => {
        vi.useFakeTimers();
        mapsService.loadMaps.mockResolvedValue({ maps: [forest] });
        render(<MapsManager campaignName="test-campaign" onOpenMap={vi.fn()} onMapDeleted={vi.fn()} />);
        await act(async () => { await Promise.resolve(); }); // flush the mount fetch

        fireEvent.click(screen.getByRole('button', { name: 'Activate "Forest"' }));
        await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // settle the PUT chain

        expect(document.querySelector('.maps-manager-notice')).toHaveTextContent('Map "Forest" activated');

        await act(async () => { await vi.advanceTimersByTimeAsync(3999); });
        expect(document.querySelector('.maps-manager-notice')).toBeInTheDocument();
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        expect(document.querySelector('.maps-manager-notice')).not.toBeInTheDocument();
    });
});
