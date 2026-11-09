// @maintained-by-ai: 2026-10-14
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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

const renderComponent = (overlays = [], pendingOverlay = null, onRotateStart = null) =>
    render(<SpellOverlayRenderer overlays={overlays} pendingOverlay={pendingOverlay} onRotateStart={onRotateStart} />);

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

    // Knob wiring (backlog 2026-11-09 FU): the cone/line TIP knob drives the
    // hook's rotate lane via onRotateStart; knobs that don't act must not
    // advertise a grab cursor.
    describe('rotate knob wiring', () => {
        const renderWithRotate = (overlays, pendingOverlay = null, onRotateStart = vi.fn()) => ({
            onRotateStart,
            ...renderComponent(overlays, pendingOverlay, onRotateStart),
        });

        it('cone and line tip knobs carry a grab cursor and dispatch pointerdown to onRotateStart with their overlay', () => {
            const cone = makeCone();
            const line = makeLine();
            const { container, onRotateStart } = renderWithRotate([cone, line]);
            const coneTip = getGroups(container)[0].querySelectorAll('circle.spell-overlay-handle')[1];
            const lineTip = getGroups(container)[1].querySelectorAll('circle.spell-overlay-handle')[1];
            expect(coneTip.style.cursor).toBe('grab');
            expect(lineTip.style.cursor).toBe('grab');

            fireEvent.pointerDown(coneTip, { button: 0, clientX: 300, clientY: 40, pointerId: 3 });
            expect(onRotateStart).toHaveBeenCalledTimes(1);
            expect(onRotateStart.mock.calls[0][1]).toBe(cone);
            expect(onRotateStart.mock.calls[0][0].clientX).toBe(300);

            fireEvent.pointerDown(lineTip, { button: 0, clientX: 90, clientY: 90, pointerId: 3 });
            expect(onRotateStart).toHaveBeenCalledTimes(2);
            expect(onRotateStart.mock.calls[1][1]).toBe(line);
        });

        it('origin move knobs carry no rotate handler (the svg zone-body lane owns moves)', () => {
            const { container, onRotateStart } = renderWithRotate([makeCone(), makeLine()]);
            const originKnobs = [...getGroups(container)]
                .flatMap((g) => [...g.querySelectorAll('circle.spell-overlay-handle')])
                .filter((k) => k.style.cursor === 'move');
            expect(originKnobs.length).toBe(2);
            originKnobs.forEach((knob) => fireEvent.pointerDown(knob, { button: 0 }));
            expect(onRotateStart).not.toHaveBeenCalled();
        });

        it('non-rotatable shapes never advertise a grab cursor on their knobs', () => {
            const { container, onRotateStart } = renderWithRotate([makeSphere(), makeCylinder(), makeCube()]);
            const handles = getHandles(container);
            expect(handles.length).toBe(3);
            handles.forEach((knob) => {
                expect(knob.style.cursor).toBe('move');
                fireEvent.pointerDown(knob, { button: 0 });
            });
            expect(onRotateStart).not.toHaveBeenCalled();
        });

        it('the pending placement preview keeps its tip knob decorative: no handler, default cursor', () => {
            const { container, onRotateStart } = renderWithRotate([], makeCone({ id: 'pending-cone' }));
            const tip = getGroups(container)[0].querySelectorAll('circle.spell-overlay-handle')[1];
            expect(tip.style.cursor).toBe('default');
            fireEvent.pointerDown(tip, { button: 0 });
            expect(onRotateStart).not.toHaveBeenCalled();
        });

        it('a host without a rotate handler gets decorative tip knobs instead of dead grab promises', () => {
            const { container } = renderComponent([makeCone(), makeLine()]);
            const tips = [...getGroups(container)]
                .flatMap((g) => [...g.querySelectorAll('circle.spell-overlay-handle')])
                .filter((k) => k.style.cursor !== 'move');
            expect(tips.length).toBe(2);
            tips.forEach((knob) => expect(knob.style.cursor).toBe('default'));
        });
    });

    // Legacy-corrupt board rows (the BD probe stored junk coord keys via the
    // pre-fix POST). The renderer must skip them with one console.error each:
    // no circle cx="NaN" bytes, no color.replace crash, valid siblings intact.
    describe('malformed rows (backlog 2026-11-02 BD)', () => {
        const junkCases = [
            ['the x/y/radius junk sphere', { id: 'junk-1', shape: 'sphere', x: 5, y: 5, radius: 20, color: 'rgba(255,80,60,0.07)' }],
            ['a gridX-keyed row', { id: 'junk-2', shape: 'sphere', gridX: 2, gridY: 2, radiusFt: 20, color: 'rgba(255,80,60,0.07)' }],
            ['a color-less sphere (overlayStroke crash)', { id: 'junk-3', shape: 'sphere', startGridX: 1, startGridY: 1, radiusFt: 20 }],
            ['a zero-radius sphere', { id: 'junk-4', shape: 'sphere', startGridX: 1, startGridY: 1, radiusFt: 0, color: 'rgba(255,80,60,0.07)' }],
            ['a legacy name/level row', { id: 'junk-5', name: 'Fireball', level: 3 }],
            ['a null entry', null],
        ];

        it.each(junkCases)('skips %s with one console.error and renders nothing for it', (_label, junk) => {
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const { container } = renderComponent([makeSphere(), junk]);
            expect(getGroups(container).length).toBe(1); // only the valid sphere
            expect(container.innerHTML).not.toContain('NaN');
            expect(errSpy).toHaveBeenCalledTimes(1);
            expect(errSpy.mock.calls[0][0]).toMatch(/malformed overlay/);
            errSpy.mockRestore();
        });

        it('keeps the whole layer clean when every row is junk (committed + pending)', () => {
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const { container } = renderComponent(
                [{ id: 'j1', shape: 'sphere', x: 1, y: 1, radius: 5 }],
                { id: 'j2', shape: 'cube', x: 1, y: 1, size: 5 },
            );
            expect(container.querySelector('g.spell-overlay-layer')).toBeInTheDocument();
            expect(getGroups(container).length).toBe(0);
            expect(container.innerHTML).not.toContain('NaN');
            expect(errSpy).toHaveBeenCalledTimes(2);
            errSpy.mockRestore();
        });
    });
});
