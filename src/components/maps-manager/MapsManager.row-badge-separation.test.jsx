// Backlog 2026-11-03 (CK): the map-row type badge used to be nested inside
// .maps-manager-item-name with no whitespace, so screen readers and innerText
// scans saw "The Colosseum PitIndoor". These tests pin the fix: name and badge
// are distinct sibling flex items (the row's existing gap separates them
// visually), the row text layer carries a separator, and the badge has an
// accessible label.
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

vi.mock('../common/PreviewToggle.jsx', () => ({
    default: ({ value, onChange, placeholder }) => (
        <textarea data-testid="preview-toggle-textarea" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    ),
}));

vi.mock('../common/Subscriber.jsx', () => ({
    default: () => null,
}));

vi.mock('./GenerateDungeonModal.jsx', () => ({ default: () => null }));
vi.mock('./GenerateTerrainModal.jsx', () => ({ default: () => null }));

import * as mapsService from '../../services/maps/mapsService.js';

const makeMap = (overrides) => ({
    fileName: 'test-map.json',
    name: 'Test Map',
    type: 'indoor',
    isActive: false,
    ...overrides,
});

async function renderWithMaps(...maps) {
    mapsService.loadMaps.mockResolvedValue({ maps });
    const result = render(<MapsManager campaignName="test-campaign" onOpenMap={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(maps[0].name)).toBeInTheDocument());
    return result;
}

describe('MapsManager row name/type-badge separation', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mapsService.loadMapData.mockResolvedValue({ description: '' });
    });

    it('keeps the badge OUT of the name node so name text stays pure', async () => {
        const { container } = await renderWithMaps(makeMap());

        const name = container.querySelector('.maps-manager-item-name');
        // No "Test MapIndoor" seam inside the name element.
        expect(name.textContent).toBe('Test Map');

        // The badge is a SIBLING of the name inside the flex info lane
        // (same pattern as the Active badge), so the container's gap
        // provides the visual separation.
        const badge = container.querySelector('.map-type-badge');
        expect(badge).not.toBeNull();
        expect(badge.parentElement).toBe(name.parentElement);
        expect(name.parentElement).toHaveClass('maps-manager-item-info');
    });

    it('row text layer renders name and type with a separator, never concatenated', async () => {
        const { container } = await renderWithMaps(makeMap());

        const row = container.querySelector('.maps-manager-item');
        expect(row.textContent).not.toContain('Test MapIndoor');
        expect(row.textContent).toContain('Test Map Indoor');
    });

    it.each([
        ['indoor', 'Indoor'],
        ['outdoor', 'Outdoor'],
    ])('badge for %s carries an aria-label naming the type', async (type, label) => {
        const { container } = await renderWithMaps(makeMap({ type }));

        const badge = container.querySelector('.map-type-badge');
        expect(badge).toHaveTextContent(label);
        expect(badge).toHaveAttribute('aria-label', `Map type: ${label}`);
    });

    it('rows without a type badge and other row affordances are unchanged', async () => {
        const onOpenMap = vi.fn();
        mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ type: undefined })] });
        const { container } = render(<MapsManager campaignName="test-campaign" onOpenMap={onOpenMap} />);
        await waitFor(() => expect(screen.getByText('Test Map')).toBeInTheDocument());

        expect(container.querySelector('.map-type-badge')).toBeNull();
        expect(container.querySelector('.maps-manager-item-name').textContent).toBe('Test Map');

        // Open button still named and functional; rename/delete lanes intact.
        fireEvent.click(screen.getByRole('button', { name: 'Open "Test Map"' }));
        expect(onOpenMap).toHaveBeenCalledWith('test-map', 'Test Map');
        expect(screen.getByRole('button', { name: 'Rename "Test Map"' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete "Test Map"' })).toBeInTheDocument();
    });

    it('hides the badge while the row is being renamed (input lane unchanged)', async () => {
        const { container } = await renderWithMaps(makeMap());

        fireEvent.click(screen.getByRole('button', { name: 'Rename "Test Map"' }));
        expect(screen.getByDisplayValue('Test Map')).toBeInTheDocument();
        expect(container.querySelector('.map-type-badge')).toBeNull();
    });
});
