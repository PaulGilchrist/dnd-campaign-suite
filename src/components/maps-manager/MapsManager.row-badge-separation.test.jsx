// @maintained-by-ai 2026-11-14
// Backlog 2026-11-03 (CK): the map-row type badge used to be nested inside
// .maps-manager-item-name with no whitespace, so screen readers and innerText
// scans saw "The Colosseum PitIndoor". These tests pin the fix behaviourally:
// the name node's text stays pure (a badge re-nested inside it would pollute
// this), the row's text layer keeps a separator (a badge moved elsewhere
// breaks the adjacent "name type" reading), and the badge carries an
// accessible label. It disappears for typeless rows and while renaming.
// Per-type badge text and the Open/Rename/Delete affordances are covered in
// MapsManager.test.jsx.
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

    it.each([
        ['indoor', 'Indoor'],
        ['outdoor', 'Outdoor'],
    ])('%s row: pure name text, separated badge in the row text, accessible badge label', async (type, label) => {
        const { container } = await renderWithMaps(makeMap({ type }));

        // Name node carries ONLY the name — if the badge were re-nested inside
        // it, its text would show up here ("Test MapIndoor").
        const name = container.querySelector('.maps-manager-item-name');
        expect(name.textContent).toBe('Test Map');

        // Text layer of the whole row reads name and type separated, so
        // screen readers / innerText scans never see them concatenated. This
        // also pins the badge sitting right after the name in the row.
        const row = container.querySelector('.maps-manager-item');
        expect(row.textContent).toContain(`Test Map ${label}`);
        expect(row.textContent).not.toContain(`Test Map${label}`);

        const badge = container.querySelector('.map-type-badge');
        expect(badge).toHaveTextContent(label);
        expect(badge).toHaveAttribute('aria-label', `Map type: ${label}`);
    });

    it('omits the type badge for rows without a type, name text stays pure', async () => {
        const { container } = await renderWithMaps(makeMap({ type: undefined }));

        expect(container.querySelector('.map-type-badge')).toBeNull();
        expect(container.querySelector('.maps-manager-item-name').textContent).toBe('Test Map');
    });

    it('hides the badge while the row is being renamed (input lane unchanged)', async () => {
        const { container } = await renderWithMaps(makeMap());

        fireEvent.click(screen.getByRole('button', { name: 'Rename "Test Map"' }));
        expect(screen.getByDisplayValue('Test Map')).toBeInTheDocument();
        expect(container.querySelector('.map-type-badge')).toBeNull();
    });
});
