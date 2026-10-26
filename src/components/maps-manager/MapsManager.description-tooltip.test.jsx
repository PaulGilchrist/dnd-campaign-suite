// @maintained-by-ai: 2026-10-26
// Lane: read-only surfacing of map descriptions in the manager list
// (backlog 2026-10-26). Every row whose saved description is non-empty
// carries a hover `title` attribute containing the description; empty or
// absent descriptions render NO title (no misleading empty tooltip). Saving
// via the description modal re-fetches the list (the dedicated PUT route
// broadcasts map-data-<campaign>-<slug>, never maps-list) so tooltips go
// live without a manual reload.
//
// Row affordance regressions (aria labels, modals) live in MapsManager.test.jsx.

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapsManager from './MapsManager.jsx';

vi.mock('../../services/maps/mapsService.js', () => ({
    loadMaps: vi.fn(),
    createMap: vi.fn(),
    deleteMap: vi.fn(),
    renameMap: vi.fn(),
    activateMap: vi.fn(),
    loadMapData: vi.fn(),
    updateMapDescription: vi.fn(),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
    default: ({ value, onChange, placeholder }) => (
        <textarea
            data-testid="preview-toggle-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
        />
    ),
}));

vi.mock('../common/Subscriber.jsx', () => ({ default: () => null }));
vi.mock('./GenerateDungeonModal.jsx', () => ({ default: () => null }));
vi.mock('./GenerateTerrainModal.jsx', () => ({ default: () => null }));

import * as mapsService from '../../services/maps/mapsService.js';

const props = {
    campaignName: 'test-campaign',
    onOpenMap: vi.fn(),
    onBack: vi.fn(),
};

const rowFor = (name) => screen.getByRole('button', { name: `Open "${name}"` }).closest('li');

describe('MapsManager description tooltip (row title)', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mapsService.loadMapData.mockResolvedValue({ description: '' });
        mapsService.updateMapDescription.mockResolvedValue(undefined);
    });

    async function renderWithMaps(...maps) {
        mapsService.loadMaps.mockResolvedValue({ maps });
        render(<MapsManager {...props} />);
        await waitFor(() => expect(screen.getByText(maps[0].name)).toBeInTheDocument());
    }

    it('non-empty description surfaces verbatim as the row hover title', async () => {
        await renderWithMaps({
            fileName: 'test-map.json',
            name: 'Test Map',
            type: 'indoor',
            isActive: false,
            description: 'A misty ruined keep overlooking the sea.',
        });

        expect(rowFor('Test Map')).toHaveAttribute(
            'title',
            'A misty ruined keep overlooking the sea.'
        );
    });

    it('empty description ("") renders NO title attribute (no misleading tooltip)', async () => {
        await renderWithMaps({
            fileName: 'test-map.json',
            name: 'Test Map',
            type: 'indoor',
            isActive: false,
            description: '',
        });

        expect(rowFor('Test Map').hasAttribute('title')).toBe(false);
    });

    it('missing description key also renders NO title attribute', async () => {
        await renderWithMaps({
            fileName: 'battle-arena.json',
            name: 'Battle Arena',
            type: 'indoor',
            isActive: true,
        });

        expect(rowFor('Battle Arena').hasAttribute('title')).toBe(false);
    });

    it('saving a description re-fetches the list so the tooltip goes live', async () => {
        mapsService.loadMaps
            .mockResolvedValueOnce({
                maps: [{ fileName: 'test-map.json', name: 'Test Map', type: 'indoor', isActive: false, description: '' }],
            })
            .mockResolvedValue({
                maps: [{ fileName: 'test-map.json', name: 'Test Map', type: 'indoor', isActive: false, description: 'Fresh overview' }],
            });
        render(<MapsManager {...props} />);
        await waitFor(() => expect(screen.getByText('Test Map')).toBeInTheDocument());
        expect(rowFor('Test Map').hasAttribute('title')).toBe(false);

        fireEvent.click(screen.getByTitle('Edit description'));
        await waitFor(() => expect(screen.getByRole('heading', { name: /Edit Description/ })).toBeInTheDocument());
        fireEvent.change(screen.getByTestId('preview-toggle-textarea'), { target: { value: 'Fresh overview' } });
        fireEvent.click(screen.getByRole('button', { name: /Save/i }));

        await waitFor(() => expect(mapsService.updateMapDescription).toHaveBeenCalledWith('test-campaign', 'test-map.json', 'Fresh overview'));
        await waitFor(() => expect(rowFor('Test Map')).toHaveAttribute('title', 'Fresh overview'));
        expect(mapsService.loadMaps).toHaveBeenCalledTimes(2);
    });

    it('existing row affordances stay intact alongside the tooltip', async () => {
        await renderWithMaps({
            fileName: 'test-map.json',
            name: 'Test Map',
            type: 'indoor',
            isActive: false,
            description: 'Some description',
        });

        expect(screen.getByRole('button', { name: 'Open "Test Map"' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Activate "Test Map"' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Rename "Test Map"' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete "Test Map"' })).toBeInTheDocument();
        // The generic button title is unchanged (row title does not replace it).
        expect(screen.getByRole('button', { name: 'Edit description for "Test Map"' })).toHaveAttribute('title', 'Edit description');
    });
});
