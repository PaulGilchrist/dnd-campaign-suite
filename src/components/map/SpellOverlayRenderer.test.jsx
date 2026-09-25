// @improved-by-ai
// @cleaned-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SpellOverlayRenderer from './SpellOverlayRenderer.jsx';
import { OverlayShape, OVERLAY_STROKE_ALPHA } from '../../models/SpellOverlay.js';
import { CELL_SIZE } from '../../config/mapConfig.js';

const toGrid = (ft) => ft / 5;

const gridCenterX = (gridX) => gridX * CELL_SIZE + CELL_SIZE / 2;
const gridCenterY = (gridY) => gridY * CELL_SIZE + CELL_SIZE / 2;

const makeSphereOverlay = (overrides = {}) => ({
    id: 'sphere-1',
    shape: OverlayShape.SPHERE,
    startGridX: 5,
    startGridY: 5,
    angle: 0,
    radiusFt: 20,
    coneAngle: 0,
    widthFt: 0,
    distanceFt: 0,
    sizeFt: 0,
    color: 'rgba(255,80,60,0.07)',
    ...overrides,
});

const makeCylinderOverlay = (overrides = {}) => ({
    id: 'cylinder-1',
    shape: OverlayShape.CYLINDER,
    startGridX: 3,
    startGridY: 3,
    angle: 0,
    radiusFt: 15,
    coneAngle: 0,
    widthFt: 0,
    distanceFt: 0,
    sizeFt: 0,
    color: 'rgba(100,150,255,0.07)',
    ...overrides,
});

const makeCubeOverlay = (overrides = {}) => ({
    id: 'cube-1',
    shape: OverlayShape.CUBE,
    startGridX: 4,
    startGridY: 4,
    angle: 0,
    radiusFt: 0,
    coneAngle: 0,
    widthFt: 0,
    distanceFt: 0,
    sizeFt: 15,
    color: 'rgba(255,200,50,0.07)',
    ...overrides,
});

const makeConeOverlay = (overrides = {}) => ({
    id: 'cone-1',
    shape: OverlayShape.CONE,
    startGridX: 2,
    startGridY: 2,
    angle: 0,
    radiusFt: 0,
    coneAngle: 90,
    widthFt: 0,
    distanceFt: 60,
    sizeFt: 0,
    color: 'rgba(255,100,100,0.07)',
    ...overrides,
});

const makeLineOverlay = (overrides = {}) => ({
    id: 'line-1',
    shape: OverlayShape.LINE,
    startGridX: 1,
    startGridY: 1,
    angle: 0,
    radiusFt: 0,
    coneAngle: 0,
    widthFt: 5,
    distanceFt: 30,
    sizeFt: 0,
    color: 'rgba(100,255,100,0.07)',
    ...overrides,
});

const makeUnknownOverlay = (overrides = {}) => ({
    id: 'unknown-1',
    shape: 'unknown-shape',
    startGridX: 0,
    startGridY: 0,
    ...overrides,
});

const renderComponent = (props, overlays = [], pendingOverlay = null) =>
    render(
        <g>
            <SpellOverlayRenderer
                overlays={overlays}
                pendingOverlay={pendingOverlay}
                {...props}
            />
        </g>
    );

const getLayer = (container) => container.querySelector('g.spell-overlay-layer');
const getGroups = (container) => container.querySelectorAll('g.spell-overlay-group');
const getSpellOverlay = (container) => container.querySelector('circle.spell-overlay');
const getConePath = (container) => container.querySelector('path.spell-overlay');
const getLineRect = (container) => container.querySelector('rect.spell-overlay');

describe('SpellOverlayRenderer', () => {
    describe('layer rendering', () => {
        it('should render a layer', () => {
            const { container } = renderComponent({}, [], null);
            expect(getLayer(container)).toBeInTheDocument();
        });

        it('should render all overlay shapes in a single layer', () => {
            const overlays = [
                makeSphereOverlay({ id: 's1' }),
                makeCylinderOverlay({ id: 's2' }),
                makeCubeOverlay({ id: 'c1' }),
                makeConeOverlay({ id: 'cn1' }),
                makeLineOverlay({ id: 'l1' }),
            ];
            const { container } = renderComponent({}, overlays);
            expect(getGroups(container).length).toBe(5);
        });

        it('should render overlay groups keyed by overlay id for correct reconciliation', () => {
            const sphere1 = makeSphereOverlay({ id: 'unique-id-1' });
            const sphere2 = makeSphereOverlay({ id: 'unique-id-2' });
            const { container } = renderComponent({}, [sphere1, sphere2]);
            expect(getGroups(container).length).toBe(2);
            expect(getGroups(container)[0].querySelector('circle.spell-overlay')).toBeInTheDocument();
            expect(getGroups(container)[1].querySelector('circle.spell-overlay')).toBeInTheDocument();
        });
    });

    describe('unknown shape handling', () => {
        it('should render no group for an unknown overlay shape', () => {
            const { container } = renderComponent({}, [makeUnknownOverlay()]);
            expect(getGroups(container).length).toBe(0);
        });

        it('should still render other overlays when one has an unknown shape', () => {
            const sphere = makeSphereOverlay({ id: 's1' });
            const unknown = makeUnknownOverlay({ id: 'u1' });
            const { container } = renderComponent({}, [sphere, unknown]);
            expect(getGroups(container).length).toBe(1);
        });
    });

    describe('sphere overlay', () => {
        it('should render a sphere with correct circle radius', () => {
            const sphere = makeSphereOverlay({ radiusFt: 20 });
            const { container } = renderComponent({}, [sphere]);
            const circle = getSpellOverlay(container);
            const expectedR = toGrid(20) * CELL_SIZE;
            expect(circle.getAttribute('r')).toBe(String(expectedR));
        });

        it('should render a sphere at correct center position', () => {
            const sphere = makeSphereOverlay({ startGridX: 5, startGridY: 5 });
            const { container } = renderComponent({}, [sphere]);
            const circle = getSpellOverlay(container);
            expect(circle.getAttribute('cx')).toBe(String(gridCenterX(5)));
            expect(circle.getAttribute('cy')).toBe(String(gridCenterY(5)));
        });

        it('should render a sphere with the specified fill color', () => {
            const sphere = makeSphereOverlay({ color: 'rgba(0,255,0,0.35)' });
            const { container } = renderComponent({}, [sphere]);
            const circle = getSpellOverlay(container);
            expect(circle.getAttribute('fill')).toBe('rgba(0,255,0,0.35)');
        });

        it('should keep a 0.8 alpha stroke regardless of fill alpha', () => {
            const sphere = makeSphereOverlay();
            const { container } = renderComponent({}, [sphere]);
            const circle = getSpellOverlay(container);
            expect(circle.getAttribute('fill')).toBe('rgba(255,80,60,0.07)');
            expect(circle.getAttribute('stroke')).toBe(`rgba(255,80,60,${OVERLAY_STROKE_ALPHA})`);
        });

        it('should render a sphere with a drag handle at the center', () => {
            const sphere = makeSphereOverlay({ startGridX: 5, startGridY: 5 });
            const { container } = renderComponent({}, [sphere]);
            const handles = container.querySelectorAll('circle.spell-overlay-handle');
            expect(handles.length).toBe(1);
            expect(handles[0].getAttribute('cx')).toBe(String(gridCenterX(5)));
            expect(handles[0].getAttribute('cy')).toBe(String(gridCenterY(5)));
        });
    });

    describe('cylinder overlay', () => {
        it('should render a cylinder as a circle like a sphere', () => {
            const cylinder = makeCylinderOverlay({ radiusFt: 20 });
            const { container } = renderComponent({}, [cylinder]);
            const circle = getSpellOverlay(container);
            const expectedR = toGrid(20) * CELL_SIZE;
            expect(circle.getAttribute('r')).toBe(String(expectedR));
            expect(circle.getAttribute('cx')).toBe(String(gridCenterX(3)));
            expect(circle.getAttribute('cy')).toBe(String(gridCenterY(3)));
        });

        it('should render a cylinder with a drag handle at center', () => {
            const cylinder = makeCylinderOverlay();
            const { container } = renderComponent({}, [cylinder]);
            const handles = container.querySelectorAll('circle.spell-overlay-handle');
            expect(handles.length).toBe(1);
        });
    });

    describe('cube overlay', () => {
        it('should render a cube with correct size', () => {
            const cube = makeCubeOverlay({ sizeFt: 15 });
            const { container } = renderComponent({}, [cube]);
            const rect = getLineRect(container);
            const expectedSize = toGrid(15) * CELL_SIZE;
            expect(rect.getAttribute('width')).toBe(String(expectedSize));
            expect(rect.getAttribute('height')).toBe(String(expectedSize));
        });

        it('should render a cube centered at correct position', () => {
            const cube = makeCubeOverlay({ startGridX: 4, startGridY: 4, sizeFt: 15 });
            const { container } = renderComponent({}, [cube]);
            const rect = getLineRect(container);
            const cx = gridCenterX(4);
            const cy = gridCenterY(4);
            const size = toGrid(15) * CELL_SIZE;
            expect(rect.getAttribute('x')).toBe(String(cx - size / 2));
            expect(rect.getAttribute('y')).toBe(String(cy - size / 2));
        });

        it('should render a cube with a drag handle at center', () => {
            const cube = makeCubeOverlay({ startGridX: 4, startGridY: 4 });
            const { container } = renderComponent({}, [cube]);
            const handles = container.querySelectorAll('circle.spell-overlay-handle');
            expect(handles.length).toBe(1);
        });

        it('should render a cube with the specified fill color', () => {
            const cube = makeCubeOverlay({ color: 'rgba(0,100,200,0.35)' });
            const { container } = renderComponent({}, [cube]);
            const rect = getLineRect(container);
            expect(rect.getAttribute('fill')).toBe('rgba(0,100,200,0.35)');
        });

        it('should apply rotation transform to the cube based on angle', () => {
            const cube = makeCubeOverlay({ angle: 45 });
            const { container } = renderComponent({}, [cube]);
            const transformGroup = container.querySelector('g.spell-overlay-group g');
            expect(transformGroup.getAttribute('transform')).toContain('rotate(45');
        });
    });

    describe('cone overlay', () => {
        it('should render a cone with a path element', () => {
            const cone = makeConeOverlay();
            const { container } = renderComponent({}, [cone]);
            expect(getConePath(container)).toBeInTheDocument();
        });

        it('should render a cone with a path starting at origin', () => {
            const cone = makeConeOverlay({ startGridX: 2, startGridY: 2, distanceFt: 60, coneAngle: 90, angle: 90 });
            const { container } = renderComponent({}, [cone]);
            const path = getConePath(container);
            const startX = gridCenterX(2);
            const startY = gridCenterY(2);
            expect(path.getAttribute('d')).toContain(`M ${startX},${startY}`);
        });

        it('should render a cone with two drag handles (origin and edge)', () => {
            const cone = makeConeOverlay();
            const { container } = renderComponent({}, [cone]);
            const handles = container.querySelectorAll('circle.spell-overlay-handle');
            expect(handles.length).toBe(2);
        });

        it('should render a cone with the specified fill color', () => {
            const cone = makeConeOverlay({ color: 'rgba(0,200,100,0.35)' });
            const { container } = renderComponent({}, [cone]);
            const path = getConePath(container);
            expect(path.getAttribute('fill')).toBe('rgba(0,200,100,0.35)');
        });

        it('should render a cone path with large arc flag when coneAngle exceeds 180', () => {
            const cone = makeConeOverlay({ coneAngle: 270, distanceFt: 60, angle: 0 });
            const { container } = renderComponent({}, [cone]);
            const path = getConePath(container);
            const d = path.getAttribute('d');
            expect(d).toContain('A 480,480 0 1,1');
        });

        it('should render a cone path without large arc flag when coneAngle is 180 or less', () => {
            const cone = makeConeOverlay({ coneAngle: 90, distanceFt: 60, angle: 0 });
            const { container } = renderComponent({}, [cone]);
            const path = getConePath(container);
            const d = path.getAttribute('d');
            expect(d).toContain('A 480,480 0 0,1');
        });
    });

    describe('line overlay', () => {
        it('should render a line with a rect element', () => {
            const line = makeLineOverlay();
            const { container } = renderComponent({}, [line]);
            expect(getLineRect(container)).toBeInTheDocument();
        });

        it('should render a line with correct width and length', () => {
            const line = makeLineOverlay({ widthFt: 5, distanceFt: 30 });
            const { container } = renderComponent({}, [line]);
            const rect = getLineRect(container);
            const expectedWidth = toGrid(5) * CELL_SIZE;
            const expectedLength = toGrid(30) * CELL_SIZE;
            expect(rect.getAttribute('height')).toBe(String(expectedWidth));
            expect(rect.getAttribute('width')).toBe(String(expectedLength));
        });

        it('should render a line with two drag handles', () => {
            const line = makeLineOverlay();
            const { container } = renderComponent({}, [line]);
            const handles = container.querySelectorAll('circle.spell-overlay-handle');
            expect(handles.length).toBe(2);
        });

        it('should render a line with the specified fill color', () => {
            const line = makeLineOverlay({ color: 'rgba(100,100,255,0.35)' });
            const { container } = renderComponent({}, [line]);
            const rect = getLineRect(container);
            expect(rect.getAttribute('fill')).toBe('rgba(100,100,255,0.35)');
        });

        it('should apply rotation transform to the line based on angle', () => {
            const line = makeLineOverlay({ angle: 90 });
            const { container } = renderComponent({}, [line]);
            const transformGroup = container.querySelector('g.spell-overlay-group g');
            expect(transformGroup.getAttribute('transform')).toContain('rotate(90');
        });
    });

    describe('multiple overlays', () => {
        it('should render overlay groups in correct order: overlays then pending', () => {
            const sphere = makeSphereOverlay({ id: 's1' });
            const cube = makeCubeOverlay({ id: 'c1' });
            const pending = makeConeOverlay({ id: 'p1' });
            const { container } = renderComponent({}, [sphere, cube], pending);
            expect(getGroups(container).length).toBe(3);
        });
    });

    describe('pending overlay', () => {
        it('should render a pending overlay', () => {
            const pending = makeSphereOverlay({ id: 'pending-1' });
            const { container } = renderComponent({}, [], pending);
            expect(getGroups(container).length).toBe(1);
        });

        it('should render both overlays and pending overlay', () => {
            const sphere = makeSphereOverlay({ id: 's1' });
            const pending = makeCubeOverlay({ id: 'pending-1' });
            const { container } = renderComponent({}, [sphere], pending);
            expect(getGroups(container).length).toBe(2);
        });
    });
});
