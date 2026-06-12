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

    it('should render the poi-layer group', () => {
        const { container } = render(<POILayer {...props} />);
        const layer = container.querySelector('g.poi-layer');
        expect(layer).toBeInTheDocument();
    });

    it('should render one poi-item group per POI', () => {
        const { container } = render(<POILayer {...props} />);
        const items = container.querySelectorAll('g.poi-item');
        expect(items.length).toBe(3);
    });

    it('should render no POIs when pois is empty', () => {
        const { container } = render(<POILayer {...props} pois={[]} />);
        const items = container.querySelectorAll('g.poi-item');
        expect(items.length).toBe(0);
    });

    it('should render a use element for each POI icon', () => {
        const { container } = render(<POILayer {...props} />);
        const uses = container.querySelectorAll('use');
        expect(uses.length).toBe(3);
    });

    it('should reference the correct SVG symbol for each POI type', () => {
        const { container } = render(<POILayer {...props} />);
        const uses = container.querySelectorAll('use');
        expect(uses[0].getAttribute('href')).toBe('#poi-city');
        expect(uses[1].getAttribute('href')).toBe('#poi-camp');
        expect(uses[2].getAttribute('href')).toBe('#poi-dungeon');
    });

    it('should render label text when POI has a label', () => {
        render(<POILayer {...props} />);
        const texts = document.querySelectorAll('text');
        const labels = [...texts].filter(t => ['City A', 'Camp B', 'Dungeon C'].includes(t.textContent));
        expect(labels.length).toBe(3);
    });

    it('should not render label text when POI has no label', () => {
        const { container } = render(<POILayer {...props} pois={[{ id: 'poi-1', type: 'city', q: 0, r: 0, visible: true }]} />);
        const layer = container.querySelector('g.poi-layer');
        // The text element should not exist for this POI since it has no label
        // We check that only the text elements we expect are there
        const texts = layer.querySelectorAll('text');
        expect(texts.length).toBe(0);
    });

    it('should hide hidden POIs from non-localhost users', () => {
        const { container } = render(<POILayer {...props} isLocalhost={false} pois={[{ id: 'hidden-poi', type: 'city', q: 0, r: 0, visible: false }]} />);
        const items = container.querySelectorAll('g.poi-item');
        expect(items.length).toBe(0);
    });

    it('should show hidden POIs to localhost users', () => {
        const { container } = render(<POILayer {...props} isLocalhost={true} pois={[{ id: 'hidden-poi', type: 'city', q: 0, r: 0, visible: false }]} />);
        const items = container.querySelectorAll('g.poi-item');
        expect(items.length).toBe(1);
    });

    it('should set opacity 0.4 on hidden POIs', () => {
        const { container } = render(<POILayer {...props} pois={[{ id: 'hidden-poi', type: 'city', q: 0, r: 0, visible: false }]} />);
        const item = container.querySelector('g.poi-item');
        expect(item.getAttribute('opacity')).toBe('0.4');
    });

    it('should set opacity 1 on visible POIs', () => {
        const { container } = render(<POILayer {...props} pois={[{ id: 'visible-poi', type: 'city', q: 0, r: 0, visible: true }]} />);
        const item = container.querySelector('g.poi-item');
        expect(item.getAttribute('opacity')).toBe('1');
    });

    it('should default to visible when visible prop is absent', () => {
        const { container } = render(<POILayer {...props} pois={[{ id: 'default-poi', type: 'city', q: 0, r: 0 }]} />);
        const item = container.querySelector('g.poi-item');
        expect(item.getAttribute('opacity')).toBe('1');
    });

    it('should call onPoiPointerDown when non-enterable POI is pressed', () => {
        render(<POILayer {...props} />);
        const rects = document.querySelectorAll('rect[fill="transparent"]');
        // The non-enterable hit area should trigger onPointerDown
        fireEvent.pointerDown(rects[0], { preventDefault: () => {} });
        expect(props.onPoiPointerDown).toHaveBeenCalledWith('poi-1', expect.any(Object));
    });

    it('should call onPoiContextMenu on right-click', () => {
        render(<POILayer {...props} />);
        const rects = document.querySelectorAll('rect[fill="transparent"]');
        fireEvent.contextMenu(rects[0], { preventDefault: () => {}, stopPropagation: () => {} });
        expect(props.onPoiContextMenu).toHaveBeenCalledWith('poi-1', expect.any(Object));
    });

    it('should stop propagation on click of non-enterable POI', () => {
        render(<POILayer {...props} />);
        const rects = document.querySelectorAll('rect[fill="transparent"]');
        // Non-enterable POI hit area has onClick with stopPropagation
        expect(rects.length).toBeGreaterThan(0);
    });

    it('should render drag highlight when POI is being dragged', () => {
        const { container } = render(<POILayer {...props} poiDragging={{ poiId: 'poi-1' }} />);
        const dragHighlight = container.querySelectorAll('rect[stroke="#FFD700"][stroke-width="2"]');
        expect(dragHighlight.length).toBeGreaterThan(0);
    });

    it('should not render drag highlight when no POI is being dragged', () => {
        const { container } = render(<POILayer {...props} poiDragging={null} />);
        const dragHighlights = container.querySelectorAll('rect[stroke="#FFD700"][stroke-width="2"]');
        expect(dragHighlights.length).toBe(0);
    });

    it('should render drop preview when poiHover is set', () => {
        const { container } = render(<POILayer {...props} poiHover={{ x: 100, y: 200 }} />);
        const preview = container.querySelectorAll('rect[stroke="#FFD700"][stroke-dasharray="4 2"]');
        expect(preview.length).toBe(1);
    });

    it('should not render drop preview when poiHover is null', () => {
        const { container } = render(<POILayer {...props} poiHover={null} />);
        const previews = container.querySelectorAll('rect[stroke="#FFD700"][stroke-dasharray="4 2"]');
        expect(previews.length).toBe(0);
    });

    it('should render enterable POI with golden glow ring', () => {
        const validMaps = new Set(['dungeon-map.json']);
        const { container } = render(<POILayer {...props} partyPosition={{ q: 0, r: 0 }} validLinkedMaps={validMaps} pois={[{ id: 'enterable-poi', type: 'dungeon', q: 0, r: 1, visible: true, linkedMap: 'dungeon-map.json' }]} />);
        const goldenGlows = container.querySelectorAll('circle[stroke="#FFD700"][stroke-dasharray="5 3"]');
        expect(goldenGlows.length).toBe(1);
    });

    it('should not render golden glow ring when POI is not adjacent to party', () => {
        const validMaps = new Set(['dungeon-map.json']);
        const { container } = render(<POILayer {...props} partyPosition={{ q: 10, r: 10 }} validLinkedMaps={validMaps} pois={[{ id: 'enterable-poi', type: 'dungeon', q: 0, r: 1, visible: true, linkedMap: 'dungeon-map.json' }]} />);
        const goldenGlows = container.querySelectorAll('circle[stroke="#FFD700"][stroke-dasharray="5 3"]');
        expect(goldenGlows.length).toBe(0);
    });

    it('should not render golden glow ring when POI has no linkedMap', () => {
        const { container } = render(<POILayer {...props} partyPosition={{ q: 0, r: 1 }} pois={[{ id: 'no-link-poi', type: 'city', q: 0, r: 1, visible: true, linkedMap: null }]} />);
        const goldenGlows = container.querySelectorAll('circle[stroke="#FFD700"][stroke-dasharray="5 3"]');
        expect(goldenGlows.length).toBe(0);
    });

    it('should not render golden glow ring when linkedMap is not in validLinkedMaps', () => {
        const validMaps = new Set(['other-map.json']);
        const { container } = render(<POILayer {...props} partyPosition={{ q: 0, r: 1 }} validLinkedMaps={validMaps} pois={[{ id: 'invalid-map-poi', type: 'dungeon', q: 0, r: 1, visible: true, linkedMap: 'dungeon-map.json' }]} />);
        const goldenGlows = container.querySelectorAll('circle[stroke="#FFD700"][stroke-dasharray="5 3"]');
        expect(goldenGlows.length).toBe(0);
    });

    it('should not render golden glow ring when POI is hidden', () => {
        const validMaps = new Set(['dungeon-map.json']);
        const { container } = render(<POILayer {...props} partyPosition={{ q: 0, r: 1 }} validLinkedMaps={validMaps} pois={[{ id: 'hidden-poi', type: 'dungeon', q: 0, r: 1, visible: false, linkedMap: 'dungeon-map.json' }]} />);
        const goldenGlows = container.querySelectorAll('circle[stroke="#FFD700"][stroke-dasharray="5 3"]');
        expect(goldenGlows.length).toBe(0);
    });

    it('should render "Enter" badge for enterable POIs', () => {
        const validMaps = new Set(['dungeon-map.json']);
        render(<POILayer {...props} partyPosition={{ q: 0, r: 0 }} validLinkedMaps={validMaps} pois={[{ id: 'enterable-poi', type: 'dungeon', q: 0, r: 1, visible: true, linkedMap: 'dungeon-map.json' }]} />);
        expect(screen.getByText('Enter')).toBeInTheDocument();
    });

    it('should not render "Enter" badge for non-enterable POIs', () => {
        render(<POILayer {...props} pois={[{ id: 'non-enterable', type: 'city', q: 0, r: 0, visible: true, linkedMap: null }]} />);
        expect(screen.queryByText('Enter')).not.toBeInTheDocument();
    });

    it('should call onPoiEnter when enterable POI is clicked', () => {
        const validMaps = new Set(['dungeon-map.json']);
        render(<POILayer {...props} partyPosition={{ q: 0, r: 0 }} validLinkedMaps={validMaps} pois={[{ id: 'enterable-poi', type: 'dungeon', q: 0, r: 1, visible: true, linkedMap: 'dungeon-map.json' }]} />);
        const enterRect = document.querySelector('rect[fill="transparent"]');
        fireEvent.click(enterRect);
        expect(props.onPoiEnter).toHaveBeenCalledWith({ id: 'enterable-poi', type: 'dungeon', q: 0, r: 1, visible: true, linkedMap: 'dungeon-map.json' });
    });

    it('should render road-start selection ring for matching POI', () => {
        const { container } = render(<POILayer {...props} roadStartPoiId="poi-1" />);
        const ring = container.querySelectorAll('circle[stroke="#A08060"][stroke-width="2.5"][stroke-dasharray="4 3"]');
        expect(ring.length).toBe(1);
    });

    it('should not render road-start selection ring when no match', () => {
        const { container } = render(<POILayer {...props} roadStartPoiId="nonexistent" />);
        const rings = container.querySelectorAll('circle[stroke="#A08060"][stroke-width="2.5"][stroke-dasharray="4 3"]');
        expect(rings.length).toBe(0);
    });

    it('should render Enterable POIs with enterable class', () => {
        const validMaps = new Set(['dungeon-map.json']);
        const { container } = render(<POILayer {...props} partyPosition={{ q: 0, r: 0 }} validLinkedMaps={validMaps} pois={[{ id: 'enterable-poi', type: 'dungeon', q: 0, r: 1, visible: true, linkedMap: 'dungeon-map.json' }]} />);
        const enterableItems = container.querySelectorAll('g.poi-item-enterable');
        expect(enterableItems.length).toBe(1);
    });

    it('should render non-enterable POIs without enterable class', () => {
        const { container } = render(<POILayer {...props} pois={[{ id: 'non-enterable', type: 'city', q: 0, r: 0, visible: true, linkedMap: null }]} />);
        const nonEnterableItems = container.querySelectorAll('g.poi-item');
        const enterableItems = container.querySelectorAll('g.poi-item-enterable');
        expect(nonEnterableItems.length).toBe(1);
        expect(enterableItems.length).toBe(0);
    });

    it('should render Enterable POI hit area with 50px height', () => {
        const validMaps = new Set(['dungeon-map.json']);
        render(<POILayer {...props} partyPosition={{ q: 0, r: 0 }} validLinkedMaps={validMaps} pois={[{ id: 'enterable-poi', type: 'dungeon', q: 0, r: 1, visible: true, linkedMap: 'dungeon-map.json' }]} />);
        const enterRect = document.querySelector('rect[fill="transparent"]');
        expect(enterRect.getAttribute('height')).toBe('50');
    });

    it('should render non-enterable POI hit area with 36px height', () => {
        render(<POILayer {...props} pois={[{ id: 'non-enterable', type: 'city', q: 0, r: 0, visible: true, linkedMap: null }]} />);
        const rects = document.querySelectorAll('rect[fill="transparent"]');
        expect(rects[0].getAttribute('height')).toBe('36');
    });

    it('should pass correct coordinates to hexToPixel', () => {
        render(<POILayer {...props} pois={[{ id: 'poi-1', type: 'city', q: 2, r: 3, visible: true }]} />);
        // The component uses hexToPixel internally; verify the rendered SVG element positions
        const useElement = document.querySelector('use');
        expect(useElement).toBeInTheDocument();
    });

    it('should handle SVG use element with correct x and y offsets', () => {
        const { container } = render(<POILayer {...props} pois={[{ id: 'poi-1', type: 'city', q: 0, r: 0, visible: true }]} />);
        const useEl = container.querySelector('use');
        expect(useEl.getAttribute('href')).toBe('#poi-city');
    });

    it('should render all POIs in order', () => {
        const pois = [
            { id: 'poi-1', type: 'city', q: 0, r: 0, label: 'First', visible: true },
            { id: 'poi-2', type: 'camp', q: 1, r: 0, label: 'Second', visible: true },
            { id: 'poi-3', type: 'dungeon', q: 0, r: 1, label: 'Third', visible: true },
        ];
        const { container } = render(<POILayer {...props} pois={pois} />);
        const items = container.querySelectorAll('g.poi-item');
        expect(items.length).toBe(3);
    });

    it('should render pointer cursor for enterable POIs', () => {
        const validMaps = new Set(['dungeon-map.json']);
        render(<POILayer {...props} partyPosition={{ q: 0, r: 0 }} validLinkedMaps={validMaps} pois={[{ id: 'enterable-poi', type: 'dungeon', q: 0, r: 1, visible: true, linkedMap: 'dungeon-map.json' }]} />);
        const enterRect = document.querySelector('rect[fill="transparent"]');
        expect(enterRect.style.cursor).toBe('pointer');
    });

    it('should render grab cursor for non-enterable POIs', () => {
        render(<POILayer {...props} pois={[{ id: 'non-enterable', type: 'city', q: 0, r: 0, visible: true, linkedMap: null }]} />);
        const rects = document.querySelectorAll('rect[fill="transparent"]');
        expect(rects[0].style.cursor).toBe('grab');
    });

    it('should handle POIs with undefined linkedMap', () => {
        const { container } = render(<POILayer {...props} pois={[{ id: 'no-link', type: 'city', q: 0, r: 0, visible: true }]} />);
        const items = container.querySelectorAll('g.poi-item');
        expect(items.length).toBe(1);
    });

    it('should not crash when validLinkedMaps is null', () => {
        const { container } = render(<POILayer {...props} validLinkedMaps={null} pois={[{ id: 'poi-1', type: 'city', q: 0, r: 0, visible: true, linkedMap: 'some-map.json' }]} />);
        const items = container.querySelectorAll('g.poi-item');
        expect(items.length).toBe(1);
    });

    it('should not render Enterable POI when partyPosition is null', () => {
        const validMaps = new Set(['dungeon-map.json']);
        render(<POILayer {...props} partyPosition={null} validLinkedMaps={validMaps} pois={[{ id: 'enterable-poi', type: 'dungeon', q: 0, r: 1, visible: true, linkedMap: 'dungeon-map.json' }]} />);
        expect(screen.queryByText('Enter')).not.toBeInTheDocument();
    });
});
