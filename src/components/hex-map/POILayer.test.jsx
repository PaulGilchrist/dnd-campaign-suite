// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import POILayer from './POILayer.jsx';
import { hexToPixel, hexDistance } from '../../services/maps/hexMapUtils.js';
import { HEX_SIZE } from '../../config/outdoorConfig';

// Oracle: the real hexToPixel/hexDistance run un-mocked (precedent:
// PartyMarkerLayer.test.jsx). POI toggle STATE is owned by
// usePoiManagement.test.js; prop forwarding by HexMap.test.jsx;
// context-menu internals by POIContextMenu.test.jsx — this file owns only
// the rendered result and event dispatch of the POI SVG layer.

function makePoi(overrides = {}) {
    return { id: 'poi-1', type: 'city', q: 0, r: 0, label: 'City A', visible: true, linkedMap: null, ...overrides };
}

function makeProps(overrides = {}) {
    return {
        pois: [
            makePoi(),
            makePoi({ id: 'poi-2', type: 'camp', q: 1, r: 0, label: 'Camp B' }),
            makePoi({ id: 'poi-3', type: 'dungeon', q: 0, r: 1, label: 'Dungeon C', linkedMap: 'dungeon-map.json' }),
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
        ...overrides,
    };
}

function renderLayer(overrides = {}) {
    const props = makeProps(overrides);
    const result = render(<POILayer {...props} />);
    return { props, ...result };
}

// poi-3 at (0,1) is adjacent to party at (0,0) per the real hexDistance.
function renderEnterable(overrides = {}) {
    return renderLayer({
        partyPosition: { q: 0, r: 0 },
        validLinkedMaps: new Set(['dungeon-map.json']),
        pois: [makePoi({ id: 'enterable-poi', type: 'dungeon', q: 0, r: 1, linkedMap: 'dungeon-map.json', label: null })],
        ...overrides,
    });
}

function renderedPoiIds(container) {
    return [...container.querySelectorAll('g.poi-item')].map((g) => {
        const label = g.querySelector('text');
        return label ? label.textContent : g.querySelector('use').getAttribute('href');
    });
}

describe('POILayer', () => {
    describe('rendering', () => {
        it('renders every POI at its converted hex center with type icon and label', () => {
            const { container } = renderLayer({
                pois: [
                    makePoi(),
                    makePoi({ id: 'poi-2', type: 'camp', q: 1, r: 0, label: 'Camp B' }),
                    makePoi({ id: 'poi-3', type: 'ruins', q: 2, r: 1, label: null }),
                ],
            });
            const items = container.querySelectorAll('g.poi-item');
            expect(items).toHaveLength(3);

            const first = items[0];
            const oracle = hexToPixel(0, 0, HEX_SIZE);
            expect(first.querySelector('use').getAttribute('href')).toBe('#poi-city');
            expect(first.querySelector('use').getAttribute('x')).toBe(String(oracle.x - 18));
            expect(first.querySelector('use').getAttribute('y')).toBe(String(oracle.y - 18));
            expect(screen.getByText('City A')).toHaveAttribute('x', String(oracle.x));

            expect(items[1].querySelector('use').getAttribute('href')).toBe('#poi-camp');
            expect(screen.getByText('Camp B')).toBeInTheDocument();
            // POI without a label renders its icon but no text element
            expect(items[2].querySelectorAll('text')).toHaveLength(0);
        });

        it.each([
            { isLocalhost: true, hiddenExpected: true },
            { isLocalhost: false, hiddenExpected: false },
        ])('GM view ($isLocalhost) renders the exact visible set, hidden POIs faded at opacity 0.4', ({ isLocalhost, hiddenExpected }) => {
            const { container } = renderLayer({
                isLocalhost,
                pois: [
                    makePoi({ id: 'poi-1', label: 'Visible POI' }),
                    makePoi({ id: 'poi-2', q: 1, r: 0, label: 'Hidden POI', visible: false }),
                ],
            });
            expect(renderedPoiIds(container)).toEqual(hiddenExpected ? ['Visible POI', 'Hidden POI'] : ['Visible POI']);
            if (hiddenExpected) {
                const [visibleGroup, hiddenGroup] = container.querySelectorAll('g.poi-item');
                expect(hiddenGroup.getAttribute('opacity')).toBe('0.4');
                expect(visibleGroup.getAttribute('opacity')).toBe('1');
            }
        });

        it('renders nothing when the POI list is empty', () => {
            const { container } = renderLayer({ pois: [] });
            expect(container.querySelector('g.poi-item')).not.toBeInTheDocument();
        });
    });

    describe('hit dispatch (non-enterable)', () => {
        it('pointer-down and right-click dispatch the exact POI id, once each', () => {
            const { props, container } = renderLayer();
            const hit = container.querySelector('g.poi-item rect[fill="transparent"]');
            fireEvent.pointerDown(hit, { button: 0 });
            fireEvent.contextMenu(hit, { button: 2 });
            expect(props.onPoiPointerDown).toHaveBeenCalledTimes(1);
            expect(props.onPoiPointerDown).toHaveBeenCalledWith('poi-1', expect.any(Object));
            expect(props.onPoiContextMenu).toHaveBeenCalledTimes(1);
            expect(props.onPoiContextMenu).toHaveBeenCalledWith('poi-1', expect.any(Object));
        });
    });

    describe('enterable POIs', () => {
        // Adjacency is computed by the REAL hexDistance — no stubs.
        it('shows the Enter badge and gold glow ring on an adjacent POI with a valid linked map', () => {
            expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 1 })).toBe(1); // fixture sanity
            const { container } = renderEnterable();
            expect(screen.getByText('Enter')).toBeInTheDocument();
            const oracle = hexToPixel(0, 1, HEX_SIZE);
            const glow = container.querySelector('circle[stroke="#FFD700"]');
            expect(glow).toHaveAttribute('cx', String(oracle.x));
            expect(glow).toHaveAttribute('cy', String(oracle.y));
        });

        it.each([
            ['not adjacent to the party', { pois: [makePoi({ id: 'far', type: 'dungeon', q: 5, r: 5, linkedMap: 'dungeon-map.json' })] }],
            ['missing a linked map', { pois: [makePoi({ id: 'nolink', q: 0, r: 1, linkedMap: null })] }],
            ['linked to a map not in validLinkedMaps', { validLinkedMaps: new Set(['other-map.json']) }],
            ['when validLinkedMaps is null', { validLinkedMaps: null }],
            ['marked invisible', { pois: [makePoi({ id: 'hidden', q: 0, r: 1, linkedMap: 'dungeon-map.json', visible: false })] }],
            ['when the party has no position', { partyPosition: null }],
        ])('does not offer entry when the POI is %s', (_desc, overrides) => {
            const { container } = renderEnterable(overrides);
            expect(screen.queryByText('Enter')).not.toBeInTheDocument();
            expect(container.querySelector('circle[stroke="#FFD700"]')).not.toBeInTheDocument();
        });

        it('click dispatches onPoiEnter with the POI (suppressing pointer-down); right-click still dispatches the context menu', () => {
            const { props, container } = renderEnterable();
            const hit = container.querySelector('g.poi-item-enterable rect[fill="transparent"]');
            fireEvent.click(hit);
            expect(props.onPoiEnter).toHaveBeenCalledTimes(1);
            expect(props.onPoiEnter).toHaveBeenCalledWith(expect.objectContaining({ id: 'enterable-poi' }));
            expect(props.onPoiPointerDown).not.toHaveBeenCalled();

            fireEvent.contextMenu(hit, { button: 2 });
            expect(props.onPoiContextMenu).toHaveBeenCalledWith('enterable-poi', expect.any(Object));
        });
    });

    describe('road-start selection ring', () => {
        it('draws the dashed ring on the matching POI only', () => {
            const { container } = renderLayer({ roadStartPoiId: 'poi-2' });
            const ring = container.querySelector('circle[stroke="#A08060"]');
            const oracle = hexToPixel(1, 0, HEX_SIZE);
            expect(ring).toHaveAttribute('cx', String(oracle.x));
            expect(ring).toHaveAttribute('cy', String(oracle.y));
            expect(ring).toHaveAttribute('stroke-dasharray', '4 3');
            expect(container.querySelectorAll('circle[stroke="#A08060"]')).toHaveLength(1);

            const second = renderLayer({ roadStartPoiId: 'nonexistent-poi' });
            expect(second.container.querySelector('circle[stroke="#A08060"]')).not.toBeInTheDocument();
        });
    });

    describe('drag state', () => {
        it('highlights only the POI whose id matches poiDragging', () => {
            const { container } = renderLayer({ poiDragging: { poiId: 'poi-1' } });
            const highlight = container.querySelector('rect[stroke="#FFD700"]');
            const oracle = hexToPixel(0, 0, HEX_SIZE);
            expect(highlight).toHaveAttribute('x', String(oracle.x - 20));
            expect(highlight).toHaveAttribute('y', String(oracle.y - 20));
            expect(container.querySelectorAll('rect[stroke="#FFD700"]')).toHaveLength(1);
        });
    });

    describe('placement drop preview', () => {
        it('shows a drop-preview box at the hovered position, and none by default', () => {
            const { container } = renderLayer({ poiHover: { x: 45, y: 50 } });
            const box = container.querySelector('rect[fill="rgba(255,215,0,0.2)"]');
            expect(box).toHaveAttribute('x', '27');
            expect(box).toHaveAttribute('y', '32');
            expect(container.querySelectorAll('rect[fill="rgba(255,215,0,0.2)"]')).toHaveLength(1);

            const second = renderLayer();
            expect(second.container.querySelector('rect[fill="rgba(255,215,0,0.2)"]')).not.toBeInTheDocument();
        });
    });
});
