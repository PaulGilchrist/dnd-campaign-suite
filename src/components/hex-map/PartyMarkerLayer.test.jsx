// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PartyMarkerLayer from './PartyMarkerLayer.jsx';
import { hexToPixel, hexToSVGPath } from '../../services/maps/hexMapUtils.js';

const HEX_SIZE = 30;

function makeProps(overrides = {}) {
    return {
        position: { q: 0, r: 0 },
        HEX_SIZE,
        hexCols: 10,
        hexRows: 10,
        onPositionChange: vi.fn(),
        onEncounter: vi.fn(),
        onAdvance: vi.fn(),
        onCancelTravel: vi.fn(),
        travelMode: 'inactive',
        svgRef: { current: null },
        contextMenuOpen: false,
        onContextMenu: vi.fn(),
        ...overrides,
    };
}

function renderMarker(overrides = {}) {
    const props = makeProps(overrides);
    const view = render(<PartyMarkerLayer {...props} />);
    return { props, ...view };
}

// Transport fake only: jsdom does not implement the SVG CTM DOM APIs
// (createSVGPoint / getScreenCTM). Contains no hex-math — the component's
// real pixelToHexSnapped conversion runs un-mocked on the returned point.
function createMockSvg(svgPoint) {
    return {
        current: {
            createSVGPoint: vi.fn(() => ({
                matrixTransform: vi.fn(() => svgPoint),
            })),
            getScreenCTM: vi.fn(() => ({
                inverse: vi.fn(() => null),
            })),
        },
    };
}

function simulateDrag({ travelMode = 'inactive', button = 0, svgPoint = { x: 60, y: 60 } } = {}) {
    const { props, ...view } = renderMarker({ travelMode, svgRef: createMockSvg(svgPoint) });
    const path = view.container.querySelector('g.party-marker-layer path');
    fireEvent.pointerDown(path, { button, clientX: 100, clientY: 100 });
    return {
        props,
        move: () => fireEvent.pointerMove(document, { clientX: 200, clientY: 200 }),
        release: () => fireEvent.pointerUp(document),
    };
}

describe('PartyMarkerLayer', () => {
    describe('rendering', () => {
        it('renders nothing when position is null or undefined', () => {
            const { container: c1 } = renderMarker({ position: null });
            expect(c1.querySelector('g.party-marker-layer')).not.toBeInTheDocument();

            const { container: c2 } = renderMarker({ position: undefined });
            expect(c2.querySelector('g.party-marker-layer')).not.toBeInTheDocument();
        });

        it('renders the P marker at the hex center given by the real converter', () => {
            const { container } = renderMarker({ position: { q: 5, r: 3 } });
            const oracle = hexToPixel(5, 3, HEX_SIZE);

            const text = container.querySelector('g.party-marker-layer text');
            expect(text).toHaveTextContent('P');
            expect(text.getAttribute('x')).toBe(String(oracle.x));
            expect(text.getAttribute('text-anchor')).toBe('middle');
            expect(parseFloat(text.getAttribute('y'))).toBeGreaterThan(oracle.y);

            // Hex shape itself is owned by hexToSVGPath (hexMapUtils.test.js) —
            // verify the layer wires the converted center through, verbatim.
            const path = container.querySelector('g.party-marker-layer path');
            expect(path.getAttribute('d')).toBe(hexToSVGPath(oracle.x, oracle.y, HEX_SIZE));
        });
    });

    describe('context menu', () => {
        it.each([
            { travelMode: 'inactive', open: true, visible: ['Start Encounter'], hidden: ['Advance One Hex', 'Cancel Travel'] },
            { travelMode: 'active', open: true, visible: ['Advance One Hex', 'Cancel Travel'], hidden: ['Start Encounter'] },
            { travelMode: 'active', open: false, visible: [], hidden: ['Start Encounter', 'Advance One Hex', 'Cancel Travel'] },
        ])('shows the $travelMode menu only when open ($open)', ({ travelMode, open, visible, hidden }) => {
            renderMarker({ contextMenuOpen: open, travelMode, position: { q: 5, r: 3 } });
            for (const item of visible) {
                expect(screen.getByText(item)).toBeInTheDocument();
            }
            for (const item of hidden) {
                expect(screen.queryByText(item)).not.toBeInTheDocument();
            }
        });
    });

    describe('context menu interactions', () => {
        it('forwards the marker position to onContextMenu on right-click', () => {
            const { props, container } = renderMarker({ position: { q: 5, r: 3 } });
            fireEvent.contextMenu(container.querySelector('g.party-marker-layer path'));
            expect(props.onContextMenu).toHaveBeenCalledWith(5, 3);
        });

        it.each([
            { travelMode: 'inactive', items: [['Start Encounter', 'onEncounter', [5, 3]]] },
            {
                travelMode: 'active',
                items: [['Advance One Hex', 'onAdvance', []], ['Cancel Travel', 'onCancelTravel', []]],
            },
        ])('invokes each $travelMode menu action from its hit target', ({ travelMode, items }) => {
            const { props, container } = renderMarker({ contextMenuOpen: true, travelMode, position: { q: 5, r: 3 } });
            const hits = container.querySelectorAll('.party-menu-hit');
            expect(hits).toHaveLength(items.length);
            items.forEach(([label, callbackName, args], i) => {
                expect(screen.getByText(label)).toBeInTheDocument();
                fireEvent.click(hits[i]);
                expect(props[callbackName]).toHaveBeenCalledWith(...args);
            });
        });
    });

    describe('dragging', () => {
        it('reports the snapped hex while dragging and stops after release', () => {
            const { props, move, release } = simulateDrag();
            move();
            expect(props.onPositionChange).toHaveBeenCalledWith({ q: 1, r: 1 });
            release();
            move();
            expect(props.onPositionChange).toHaveBeenCalledTimes(1);
        });

        it.each([
            { label: 'right-click', opts: { button: 2 } },
            { label: 'travel active', opts: { travelMode: 'active' } },
            { label: 'drop outside map bounds', opts: { svgPoint: { x: 3000, y: 3000 } } },
       ])('does not move the marker on $label', ({ opts }) => {
            const { props, move, release } = simulateDrag(opts);
            move();
            release();
            expect(props.onPositionChange).not.toHaveBeenCalled();
        });
    });
});
