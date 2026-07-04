// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import POILayer from './POILayer.jsx';

vi.mock('../../config/outdoorConfig.js', () => ({
    HEX_SIZE: 30,
}));

vi.mock('../../services/maps/hexMapUtils.js', () => ({
    hexToPixel: vi.fn((q, r, size) => ({
        x: size * Math.sqrt(3) * (q + r / 2),
        y: size * 3 / 2 * r,
    })),
    hexDistance: vi.fn((a, b) =>
        (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2
    ),
}));

describe('POILayer', () => {
    let props;

    beforeEach(() => {
        props = {
            pois: [
                { id: 'poi-1', type: 'city', q: 0, r: 0, label: 'City A', visible: true, linkedMap: null },
                { id: 'poi-2', type: 'camp', q: 1, r: 0, label: 'Camp B', visible: true, linkedMap: null },
                { id: 'poi-3', type: 'dungeon', q: 0, r: 1, label: 'Dungeon C', visible: true, linkedMap: 'dungeon-map.json' },
            ],
            onPoiPointerDown: vi.fn(),
            onPoiContextMenu: vi.fn(),
            poiDragging: null,
            poiHover: null,
            isLocalhost: true,
            partyPosition: null,
            onPoiEnter: vi.fn(),
            validLinkedMaps: new Set(),
            roadStartPoiId: null,
        };
    });

    function renderLayer(overrideProps = {}) {
        return render(<POILayer {...props} {...overrideProps} />);
    }

    describe('basic rendering', () => {
        it('should render POI items and labels for each POI', () => {
            const { container } = renderLayer();
            expect(container.querySelectorAll('g.poi-item').length).toBe(3);
            expect(screen.getByText('City A')).toBeInTheDocument();
            expect(screen.getByText('Camp B')).toBeInTheDocument();
            expect(screen.getByText('Dungeon C')).toBeInTheDocument();
        });

        it('should not render POI items when pois is empty', () => {
            const { container } = renderLayer({ pois: [] });
            expect(container.querySelectorAll('g.poi-item').length).toBe(0);
        });

        it('should not render label text when POI has no label', () => {
            renderLayer({ pois: [{ id: 'poi-1', type: 'city', q: 0, r: 0, visible: true }] });
            expect(screen.queryByText('City A')).not.toBeInTheDocument();
        });
    });

    describe('visibility', () => {
        it('should hide hidden POIs from non-localhost users but show them to localhost', () => {
            const hiddenPoi = { id: 'hidden-poi', type: 'city', q: 0, r: 0, visible: false };

            const { container: nonLocalhostContainer } = renderLayer({
                isLocalhost: false,
                pois: [hiddenPoi],
            });
            expect(nonLocalhostContainer.querySelectorAll('g.poi-item').length).toBe(0);

            const { container: localhostContainer } = renderLayer({
                isLocalhost: true,
                pois: [hiddenPoi],
            });
            expect(localhostContainer.querySelectorAll('g.poi-item').length).toBe(1);
        });
    });

    describe('interaction callbacks', () => {
        it('should call onPoiPointerDown when non-enterable POI is pressed', () => {
            renderLayer();
            const poiItems = document.querySelectorAll('g.poi-item');
            const nonEnterableRect = poiItems[0].querySelector('rect[fill="transparent"]');
            fireEvent.pointerDown(nonEnterableRect, { preventDefault: () => {} });
            expect(props.onPoiPointerDown).toHaveBeenCalledWith('poi-1', expect.any(Object));
        });

        it('should call onPoiContextMenu on right-click', () => {
            renderLayer();
            const poiItems = document.querySelectorAll('g.poi-item');
            const nonEnterableRect = poiItems[0].querySelector('rect[fill="transparent"]');
            fireEvent.contextMenu(nonEnterableRect, { preventDefault: () => {}, stopPropagation: () => {} });
            expect(props.onPoiContextMenu).toHaveBeenCalledWith('poi-1', expect.any(Object));
        });
    });

    describe('enterable POIs', () => {
        function createEnterablePoi() {
            return { id: 'enterable-poi', type: 'dungeon', q: 0, r: 1, visible: true, linkedMap: 'dungeon-map.json' };
        }

        it('should render enterable POI with Enter badge and glow when adjacent to party with valid linkedMap', () => {
            const validMaps = new Set(['dungeon-map.json']);
            const { container } = renderLayer({
                partyPosition: { q: 0, r: 0 },
                validLinkedMaps: validMaps,
                pois: [createEnterablePoi()],
            });
            expect(screen.getByText('Enter')).toBeInTheDocument();
            expect(container.querySelector('.poi-item-enterable')).toBeInTheDocument();
        });

        it.each([
            ['not adjacent to party', { partyPosition: { q: 10, r: 10 }, validLinkedMaps: new Set(['dungeon-map.json']) }],
            ['has no linkedMap', { partyPosition: { q: 0, r: 1 }, pois: [{ id: 'no-link-poi', type: 'city', q: 0, r: 1, visible: true, linkedMap: null }] }],
            ['linkedMap not in validLinkedMaps', { partyPosition: { q: 0, r: 1 }, validLinkedMaps: new Set(['other-map.json']) }],
            ['is hidden', { partyPosition: { q: 0, r: 1 }, validLinkedMaps: new Set(['dungeon-map.json']), pois: [{ ...createEnterablePoi(), visible: false }] }],
            ['has null partyPosition', { partyPosition: null, validLinkedMaps: new Set(['dungeon-map.json']) }],
        ])('should not render enterable indicators when POI is %s', (_, overrides) => {
            const { container } = renderLayer({
                ...overrides,
                pois: overrides.pois || [createEnterablePoi()],
            });
            expect(screen.queryByText('Enter')).not.toBeInTheDocument();
            expect(container.querySelectorAll('.poi-item-enterable').length).toBe(0);
        });

        it('should call onPoiEnter when enterable POI is clicked', () => {
            const validMaps = new Set(['dungeon-map.json']);
            renderLayer({
                partyPosition: { q: 0, r: 0 },
                validLinkedMaps: validMaps,
                pois: [createEnterablePoi()],
            });
            const enterableItem = document.querySelector('g.poi-item-enterable');
            const enterRect = enterableItem.querySelector('rect[fill="transparent"]');
            fireEvent.click(enterRect);
            expect(props.onPoiEnter).toHaveBeenCalledWith(expect.objectContaining({ id: 'enterable-poi' }));
        });
    });
});
