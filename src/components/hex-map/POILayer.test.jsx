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
        it('should render the poi-layer group', () => {
            const { container } = renderLayer();
            expect(container.querySelector('g.poi-layer')).toBeInTheDocument();
        });

        it('should render one poi-item group per POI', () => {
            const { container } = renderLayer();
            expect(container.querySelectorAll('g.poi-item').length).toBe(3);
        });

        it('should render no POIs when pois is empty', () => {
            const { container } = renderLayer({ pois: [] });
            expect(container.querySelectorAll('g.poi-item').length).toBe(0);
        });

        it('should render a use element for each POI icon', () => {
            const { container } = renderLayer();
            expect(container.querySelectorAll('use').length).toBe(3);
        });

        it('should reference the correct SVG symbol for each POI type', () => {
            const { container } = renderLayer();
            const uses = container.querySelectorAll('use');
            expect(uses[0].getAttribute('href')).toBe('#poi-city');
            expect(uses[1].getAttribute('href')).toBe('#poi-camp');
            expect(uses[2].getAttribute('href')).toBe('#poi-dungeon');
        });

        it('should render label text when POI has a label', () => {
            renderLayer();
            expect(screen.getByText('City A')).toBeInTheDocument();
            expect(screen.getByText('Camp B')).toBeInTheDocument();
            expect(screen.getByText('Dungeon C')).toBeInTheDocument();
        });

        it('should not render label text when POI has no label', () => {
            const { container } = renderLayer({ pois: [{ id: 'poi-1', type: 'city', q: 0, r: 0, visible: true }] });
            const layer = container.querySelector('g.poi-layer');
            const texts = layer.querySelectorAll('text');
            expect(texts.length).toBe(0);
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

        it('should default visible POIs to full opacity', () => {
            const { container } = renderLayer({
                pois: [{ id: 'visible-poi', type: 'city', q: 0, r: 0, visible: true }],
            });
            expect(container.querySelector('g.poi-item').getAttribute('opacity')).toBe('1');
        });

        it('should set reduced opacity on hidden POIs shown to localhost', () => {
            const { container } = renderLayer({
                pois: [{ id: 'hidden-poi', type: 'city', q: 0, r: 0, visible: false }],
            });
            expect(container.querySelector('g.poi-item').getAttribute('opacity')).toBe('0.4');
        });
    });

    describe('interaction callbacks', () => {
        it('should call onPoiPointerDown when non-enterable POI is pressed', () => {
            renderLayer();
            const rects = document.querySelectorAll('rect[fill="transparent"]');
            fireEvent.pointerDown(rects[0], { preventDefault: () => {} });
            expect(props.onPoiPointerDown).toHaveBeenCalledWith('poi-1', expect.any(Object));
        });

        it('should call onPoiContextMenu on right-click', () => {
            renderLayer();
            const rects = document.querySelectorAll('rect[fill="transparent"]');
            fireEvent.contextMenu(rects[0], { preventDefault: () => {}, stopPropagation: () => {} });
            expect(props.onPoiContextMenu).toHaveBeenCalledWith('poi-1', expect.any(Object));
        });
    });

    describe('drag and drop', () => {
        it('should render drag highlight when POI is being dragged', () => {
            const { container } = renderLayer({ poiDragging: { poiId: 'poi-1' } });
            const dragHighlight = container.querySelectorAll('rect[stroke="#FFD700"][stroke-width="2"]');
            expect(dragHighlight.length).toBeGreaterThan(0);
        });

        it('should not render drag highlight when no POI is being dragged', () => {
            const { container } = renderLayer({ poiDragging: null });
            const dragHighlights = container.querySelectorAll('rect[stroke="#FFD700"][stroke-width="2"]');
            expect(dragHighlights.length).toBe(0);
        });

        it('should render drop preview when poiHover is set', () => {
            const { container } = renderLayer({ poiHover: { x: 100, y: 200 } });
            const preview = container.querySelectorAll('rect[stroke="#FFD700"][stroke-dasharray="4 2"]');
            expect(preview.length).toBe(1);
        });

        it('should not render drop preview when poiHover is null', () => {
            const { container } = renderLayer({ poiHover: null });
            const previews = container.querySelectorAll('rect[stroke="#FFD700"][stroke-dasharray="4 2"]');
            expect(previews.length).toBe(0);
        });
    });

    describe('enterable POIs', () => {
        function createEnterablePoi() {
            return { id: 'enterable-poi', type: 'dungeon', q: 0, r: 1, visible: true, linkedMap: 'dungeon-map.json' };
        }

        it('should render enterable POI with golden glow ring when adjacent to party', () => {
            const validMaps = new Set(['dungeon-map.json']);
            const { container } = renderLayer({
                partyPosition: { q: 0, r: 0 },
                validLinkedMaps: validMaps,
                pois: [createEnterablePoi()],
            });
            expect(container.querySelectorAll('circle[stroke="#FFD700"][stroke-dasharray="5 3"]').length).toBe(1);
        });

        it('should not render golden glow ring when POI is not adjacent to party', () => {
            const validMaps = new Set(['dungeon-map.json']);
            const { container } = renderLayer({
                partyPosition: { q: 10, r: 10 },
                validLinkedMaps: validMaps,
                pois: [createEnterablePoi()],
            });
            expect(container.querySelectorAll('circle[stroke="#FFD700"][stroke-dasharray="5 3"]').length).toBe(0);
        });

        it('should not render golden glow ring when POI has no linkedMap', () => {
            const { container } = renderLayer({
                partyPosition: { q: 0, r: 1 },
                pois: [{ id: 'no-link-poi', type: 'city', q: 0, r: 1, visible: true, linkedMap: null }],
            });
            expect(container.querySelectorAll('circle[stroke="#FFD700"][stroke-dasharray="5 3"]').length).toBe(0);
        });

        it('should not render golden glow ring when linkedMap is not in validLinkedMaps', () => {
            const validMaps = new Set(['other-map.json']);
            const { container } = renderLayer({
                partyPosition: { q: 0, r: 1 },
                validLinkedMaps: validMaps,
                pois: [createEnterablePoi()],
            });
            expect(container.querySelectorAll('circle[stroke="#FFD700"][stroke-dasharray="5 3"]').length).toBe(0);
        });

        it('should not render golden glow ring when POI is hidden', () => {
            const validMaps = new Set(['dungeon-map.json']);
            const { container } = renderLayer({
                partyPosition: { q: 0, r: 1 },
                validLinkedMaps: validMaps,
                pois: [{ ...createEnterablePoi(), visible: false }],
            });
            expect(container.querySelectorAll('circle[stroke="#FFD700"][stroke-dasharray="5 3"]').length).toBe(0);
        });

        it('should render "Enter" badge for enterable POIs', () => {
            const validMaps = new Set(['dungeon-map.json']);
            renderLayer({
                partyPosition: { q: 0, r: 0 },
                validLinkedMaps: validMaps,
                pois: [createEnterablePoi()],
            });
            expect(screen.getByText('Enter')).toBeInTheDocument();
        });

        it('should not render "Enter" badge for non-enterable POIs', () => {
            renderLayer({ pois: [{ id: 'non-enterable', type: 'city', q: 0, r: 0, visible: true, linkedMap: null }] });
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

        it('should render enterable POI with enterable class', () => {
            const validMaps = new Set(['dungeon-map.json']);
            const { container } = renderLayer({
                partyPosition: { q: 0, r: 0 },
                validLinkedMaps: validMaps,
                pois: [createEnterablePoi()],
            });
            expect(container.querySelectorAll('g.poi-item-enterable').length).toBe(1);
        });

        it('should not render enterable class on non-enterable POIs', () => {
            const { container } = renderLayer({ pois: [{ id: 'non-enterable', type: 'city', q: 0, r: 0, visible: true, linkedMap: null }] });
            expect(container.querySelectorAll('g.poi-item-enterable').length).toBe(0);
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

    describe('null safety and edge cases', () => {
        it('should handle POIs with undefined linkedMap', () => {
            const { container } = renderLayer({ pois: [{ id: 'no-link', type: 'city', q: 0, r: 0, visible: true }] });
            expect(container.querySelectorAll('g.poi-item').length).toBe(1);
        });

        it('should not crash when validLinkedMaps is null', () => {
            const { container } = renderLayer({
                validLinkedMaps: null,
                pois: [{ id: 'poi-1', type: 'city', q: 0, r: 0, visible: true, linkedMap: 'some-map.json' }],
            });
            expect(container.querySelectorAll('g.poi-item').length).toBe(1);
        });
    });
});
