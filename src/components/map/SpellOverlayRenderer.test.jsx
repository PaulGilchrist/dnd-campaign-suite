// @maintained-by-ai: 2026-10-14
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SpellOverlayRenderer from './SpellOverlayRenderer.jsx';
import {
    OverlayShape,
    createOverlay,
    svgOrigin,
    toGrid,
    OVERLAY_STROKE_ALPHA,
} from '../../models/SpellOverlay.js';
import { CELL_SIZE } from '../../config/mapConfig.js';

const px = (ft) => toGrid(ft) * CELL_SIZE;
const center = (gridX, gridY) => svgOrigin({ startGridX: gridX, startGridY: gridY });

const makeSphere = (overrides = {}) =>
    createOverlay(OverlayShape.SPHERE, 5, 5, 0, { id: 'sphere-1', ...overrides });
const makeCylinder = (overrides = {}) =>
    createOverlay(OverlayShape.CYLINDER, 3, 3, 0, {
        id: 'cylinder-1',
        color: 'rgba(100,150,255,0.07)',
        ...overrides,
    });
const makeCube = (overrides = {}) =>
    createOverlay(OverlayShape.CUBE, 4, 4, 0, {
        id: 'cube-1',
        color: 'rgba(255,200,50,0.07)',
        ...overrides,
    });
const makeCone = (overrides = {}) =>
    createOverlay(OverlayShape.CONE, 2, 2, 0, {
        id: 'cone-1',
        coneAngle: 90,
        distanceFt: 60,
        ...overrides,
    });
const makeLine = (overrides = {}) =>
    createOverlay(OverlayShape.LINE, 1, 1, 0, { id: 'line-1', distanceFt: 30, ...overrides });

const renderComponent = (overlays = [], pendingOverlay = null) =>
    render(<SpellOverlayRenderer overlays={overlays} pendingOverlay={pendingOverlay} />);

const getGroups = (container) => container.querySelectorAll('g.spell-overlay-group');
const getHandles = (container) => container.querySelectorAll('circle.spell-overlay-handle');

describe('SpellOverlayRenderer', () => {
    it('renders one group per known shape plus the pending overlay, and a layer wrapper', () => {
        const { container } = renderComponent(
            [makeSphere(), makeCylinder(), makeCube(), makeCone(), makeLine()],
            makeSphere({ id: 'pending-1' }),
        );
        expect(container.querySelector('g.spell-overlay-layer')).toBeInTheDocument();
        const groups = getGroups(container);
        expect(groups.length).toBe(6);
        // pending overlay renders last, after the committed overlays
        expect(groups[5].querySelector('circle.spell-overlay')).toBeInTheDocument();
    });

    it('skips overlays with an unknown shape but renders the rest', () => {
        const unknown = { id: 'u1', shape: 'unknown-shape', startGridX: 0, startGridY: 0 };
        const { container } = renderComponent([makeSphere(), unknown]);
        expect(getGroups(container).length).toBe(1);
    });

    describe('sphere overlay', () => {
        it('renders a circle centered on its grid cell with radius from radiusFt', () => {
            const { container } = renderComponent([makeSphere({ radiusFt: 20 })]);
            const circle = container.querySelector('circle.spell-overlay');
            const { x, y } = center(5, 5);
            expect(circle.getAttribute('cx')).toBe(String(x));
            expect(circle.getAttribute('cy')).toBe(String(y));
            expect(circle.getAttribute('r')).toBe(String(px(20)));
        });

        it('fills with the overlay color and strokes at fixed alpha regardless of fill alpha', () => {
            const { container } = renderComponent([makeSphere({ color: 'rgba(0,255,0,0.35)' })]);
            const circle = container.querySelector('circle.spell-overlay');
            expect(circle.getAttribute('fill')).toBe('rgba(0,255,0,0.35)');
            expect(circle.getAttribute('stroke')).toBe(`rgba(0,255,0,${OVERLAY_STROKE_ALPHA})`);
        });

        it('renders a move handle at the center', () => {
            const { container } = renderComponent([makeSphere()]);
            const handles = getHandles(container);
            expect(handles.length).toBe(1);
            const { x, y } = center(5, 5);
            expect(handles[0].getAttribute('cx')).toBe(String(x));
            expect(handles[0].getAttribute('cy')).toBe(String(y));
        });
    });

    it('renders a cylinder as a circle like a sphere with a center handle', () => {
        const { container } = renderComponent([makeCylinder()]);
        const circle = container.querySelector('circle.spell-overlay');
        const { x, y } = center(3, 3);
        expect(circle.getAttribute('cx')).toBe(String(x));
        expect(circle.getAttribute('cy')).toBe(String(y));
        expect(circle.getAttribute('r')).toBe(String(px(20)));
        expect(getHandles(container).length).toBe(1);
    });

    describe('cube overlay', () => {
        it('renders a centered rect sized from sizeFt with its fill color and a move handle', () => {
            const { container } = renderComponent([makeCube({ sizeFt: 15 })]);
            const rect = container.querySelector('rect.spell-overlay');
            const { x, y } = center(4, 4);
            const size = px(15);
            expect(rect.getAttribute('width')).toBe(String(size));
            expect(rect.getAttribute('height')).toBe(String(size));
            expect(rect.getAttribute('x')).toBe(String(x - size / 2));
            expect(rect.getAttribute('y')).toBe(String(y - size / 2));
            expect(rect.getAttribute('fill')).toBe('rgba(255,200,50,0.07)');
            expect(getHandles(container).length).toBe(1);
        });

        it('applies a rotation transform around the center based on angle', () => {
            const { container } = renderComponent([makeCube({ angle: 45 })]);
            const { x, y } = center(4, 4);
            const transformGroup = container.querySelector('g.spell-overlay-group g');
            expect(transformGroup.getAttribute('transform')).toContain(`rotate(45, ${x}, ${y})`);
        });
    });

    describe('cone overlay', () => {
        it('renders a wedge path from the origin with origin and edge drag handles', () => {
            const { container } = renderComponent([makeCone({ angle: 90 })]);
            const path = container.querySelector('path.spell-overlay');
            const { x, y } = center(2, 2);
            expect(path.getAttribute('d')).toContain(`M ${x},${y}`);
            expect(path.getAttribute('fill')).toBe('rgba(255,80,60,0.07)');
            const handles = getHandles(container);
            expect(handles.length).toBe(2);
            expect(handles[0].getAttribute('cx')).toBe(String(x));
            expect(handles[0].getAttribute('cy')).toBe(String(y));
            // edge handle sits on the arc at the trailing cone edge
            const dist = px(60);
            const halfSpread = (90 / 2) * (Math.PI / 180);
            const edgeAngle = (90 * Math.PI) / 180 + halfSpread;
            expect(Number(handles[1].getAttribute('cx'))).toBeCloseTo(x + dist * Math.cos(edgeAngle));
            expect(Number(handles[1].getAttribute('cy'))).toBeCloseTo(y + dist * Math.sin(edgeAngle));
        });

        it('sets the large-arc path flag only when coneAngle exceeds 180', () => {
            const dist = px(60);
            const { container: wide } = renderComponent([makeCone({ coneAngle: 270 })]);
            expect(wide.querySelector('path.spell-overlay').getAttribute('d'))
                .toContain(`A ${dist},${dist} 0 1,1`);
            const { container: narrow } = renderComponent([makeCone({ coneAngle: 90 })]);
            expect(narrow.querySelector('path.spell-overlay').getAttribute('d'))
                .toContain(`A ${dist},${dist} 0 0,1`);
        });
    });

    it('renders a line as a rotated rect along the angle with origin and end handles', () => {
        const { container } = renderComponent([makeLine({ angle: 90 })]);
        const rect = container.querySelector('rect.spell-overlay');
        const { x, y } = center(1, 1);
        const dist = px(30);
        const w = px(5);
        expect(rect.getAttribute('width')).toBe(String(dist));
        expect(rect.getAttribute('height')).toBe(String(w));
        expect(rect.getAttribute('x')).toBe(String(x));
        expect(rect.getAttribute('y')).toBe(String(y - w / 2));
        expect(rect.getAttribute('fill')).toBe('rgba(255,80,60,0.07)');
        const transformGroup = container.querySelector('g.spell-overlay-group g');
        expect(transformGroup.getAttribute('transform')).toContain(`rotate(90, ${x}, ${y})`);
        const handles = getHandles(container);
        expect(handles.length).toBe(2);
        expect(handles[0].getAttribute('cx')).toBe(String(x));
        // end handle rotates with the angle: straight down at 90 degrees
        expect(Number(handles[1].getAttribute('cx'))).toBeCloseTo(x);
        expect(Number(handles[1].getAttribute('cy'))).toBeCloseTo(y + dist);
    });
});
