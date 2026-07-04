// @improved-by-ai
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
        it('should hide hidden POIs from non-localhost users', () => {
            const { container } = renderLayer({
                isLocalhost: false,
                pois: [{ id: 'hidden-poi', type: 'city', q: 0, r: 0, visible: false }],
            });
            expect(container.querySelectorAll('g.poi-item').length).toBe(0);
        });

        it('should show hidden POIs to localhost users', () => {
            const { container } = renderLayer({
                isLocalhost: true,
                pois: [{ id: 'hidden-poi', type: 'city', q: 0, r: 0, visible: false }],
            });
            expect(container.querySelectorAll('g.poi-item').length).toBe(1);
        });
    });

    describe('interaction callbacks', () => {
        it('should call onPoiPointerDown when non-enterable POI is pressed', () => {
            renderLayer();
            const hitAreas = document.querySelectorAll('rect[fill="transparent"]');
            fireEvent.pointerDown(hitAreas[0], { preventDefault: () => {} });
            expect(props.onPoiPointerDown).toHaveBeenCalledWith('poi-1', expect.any(Object));
        });

        it('should call onPoiContextMenu on right-click', () => {
            renderLayer();
            const hitAreas = document.querySelectorAll('rect[fill="transparent"]');
            fireEvent.contextMenu(hitAreas[0], { preventDefault: () => {}, stopPropagation: () => {} });
            expect(props.onPoiContextMenu).toHaveBeenCalledWith('poi-1', expect.any(Object));
        });
    });

    describe('drag and drop', () => {
        it('should render drag highlight when POI is being dragged', () => {
            const { container } = renderLayer({ poiDragging: { poiId: 'poi-1' } });
            const dragHighlights = container.querySelectorAll('rect[stroke="#FFD700"][stroke-width="2"]');
            expect(dragHighlights.length).toBeGreaterThan(0);
        });

        it('should render drop preview when poiHover is set', () => {
            const { container } = renderLayer({ poiHover: { x: 100, y: 200 } });
            const previews = container.querySelectorAll('rect[stroke="#FFD700"][stroke-dasharray="4 2"]');
            expect(previews.length).toBe(1);
        });
    });

    describe('enterable POIs', () => {
        function createEnterablePoi() {
            return { id: 'enterable-poi', type: 'dungeon', q: 0, r: 1, visible: true, linkedMap: 'dungeon-map.json' };
        }

        it('should render enterable POI with golden glow ring and Enter badge when adjacent to party', () => {
            const validMaps = new Set(['dungeon-map.json']);
            const { container } = renderLayer({
                partyPosition: { q: 0, r: 0 },
                validLinkedMaps: validMaps,
                pois: [createEnterablePoi()],
            });
            expect(container.querySelectorAll('circle[stroke="#FFD700"][stroke-dasharray="5 3"]').length).toBe(1);
            expect(screen.getByText('Enter')).toBeInTheDocument();
        });

        it('should not render enterable indicators when POI is not adjacent to party', () => {
            const validMaps = new Set(['dungeon-map.json']);
            const { container } = renderLayer({
                partyPosition: { q: 10, r: 10 },
                validLinkedMaps: validMaps,
                pois: [createEnterablePoi()],
            });
            expect(container.querySelectorAll('circle[stroke="#FFD700"][stroke-dasharray="5 3"]').length).toBe(0);
            expect(screen.queryByText('Enter')).not.toBeInTheDocument();
        });

        it('should not render enterable indicators when POI has no linkedMap', () => {
            const { container } = renderLayer({
                partyPosition: { q: 0, r: 1 },
                pois: [{ id: 'no-link-poi', type: 'city', q: 0, r: 1, visible: true, linkedMap: null }],
            });
            expect(container.querySelectorAll('circle[stroke="#FFD700"][stroke-dasharray="5 3"]').length).toBe(0);
            expect(screen.queryByText('Enter')).not.toBeInTheDocument();
        });

        it('should not render enterable indicators when linkedMap is not in validLinkedMaps', () => {
            const validMaps = new Set(['other-map.json']);
            const { container } = renderLayer({
                partyPosition: { q: 0, r: 1 },
                validLinkedMaps: validMaps,
                pois: [createEnterablePoi()],
            });
            expect(container.querySelectorAll('circle[stroke="#FFD700"][stroke-dasharray="5 3"]').length).toBe(0);
            expect(screen.queryByText('Enter')).not.toBeInTheDocument();
        });

        it('should not render enterable indicators when POI is hidden', () => {
            const validMaps = new Set(['dungeon-map.json']);
            const { container } = renderLayer({
                partyPosition: { q: 0, r: 1 },
                validLinkedMaps: validMaps,
                pois: [{ ...createEnterablePoi(), visible: false }],
            });
            expect(container.querySelectorAll('circle[stroke="#FFD700"][stroke-dasharray="5 3"]').length).toBe(0);
            expect(screen.queryByText('Enter')).not.toBeInTheDocument();
        });

        it('should call onPoiEnter when enterable POI is clicked', () => {
            const validMaps = new Set(['dungeon-map.json']);
            renderLayer({
                partyPosition: { q: 0, r: 0 },
                validLinkedMaps: validMaps,
                pois: [createEnterablePoi()],
            });
            const enterRect = document.querySelector('rect[fill="transparent"]');
            fireEvent.click(enterRect);
            expect(props.onPoiEnter).toHaveBeenCalledWith(expect.objectContaining({ id: 'enterable-poi' }));
        });

        it('should not render Enterable POI when partyPosition is null', () => {
            const validMaps = new Set(['dungeon-map.json']);
            renderLayer({
                partyPosition: null,
                validLinkedMaps: validMaps,
                pois: [createEnterablePoi()],
            });
            expect(screen.queryByText('Enter')).not.toBeInTheDocument();
        });
    });

    describe('road-start selection', () => {
        it('should render road-start selection ring for matching POI', () => {
            const { container } = renderLayer({ roadStartPoiId: 'poi-1' });
            expect(container.querySelectorAll('circle[stroke="#A08060"][stroke-width="2.5"][stroke-dasharray="4 3"]').length).toBe(1);
        });

        it('should not render road-start selection ring when no match', () => {
            const { container } = renderLayer({ roadStartPoiId: 'nonexistent' });
            expect(container.querySelectorAll('circle[stroke="#A08060"][stroke-width="2.5"][stroke-dasharray="4 3"]').length).toBe(0);
        });
    });
});
