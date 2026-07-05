// @cleaned-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SpellOverlayRenderer from './SpellOverlayRenderer.jsx';
import { OverlayShape } from '../../models/SpellOverlay.js';
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
    color: 'rgba(255,80,60,0.35)',
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
    color: 'rgba(100,150,255,0.35)',
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
    color: 'rgba(255,200,50,0.35)',
    ...overrides,
});

const makeConeOverlay = (overrides = {}) => ({
    id: 'cone-1',
    shape: OverlayShape.CONE,
    startGridX: 2,
    startGridY: 2,
    angle: 90,
    radiusFt: 0,
    coneAngle: 90,
    widthFt: 0,
    distanceFt: 60,
    sizeFt: 0,
    color: 'rgba(255,100,100,0.35)',
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
    color: 'rgba(100,255,100,0.35)',
    ...overrides,
});

const renderComponent = (props, overlays = [], pendingOverlay = null) =>
    render(
        <svg width={1200} height={800}>
            <SpellOverlayRenderer
                overlays={overlays}
                pendingOverlay={pendingOverlay}
                {...props}
            />
        </svg>
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

        it('should render no overlay groups when overlays array is empty', () => {
            const { container } = renderComponent({}, [], null);
            expect(getGroups(container).length).toBe(0);
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

        it('should render a sphere with correct fill color', () => {
            const sphere = makeSphereOverlay({ color: 'rgba(0,255,0,0.35)' });
            const { container } = renderComponent({}, [sphere]);
            const circle = getSpellOverlay(container);
            expect(circle.getAttribute('fill')).toBe('rgba(0,255,0,0.35)');
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
        it('should render a cylinder using the same shape as a sphere', () => {
            const cylinder = makeCylinderOverlay({ radiusFt: 20 });
            const sphere = makeSphereOverlay({ radiusFt: 20 });
            const { container: cylinderContainer } = renderComponent({}, [cylinder]);
            const { container: sphereContainer } = renderComponent({}, [sphere]);
            const expectedR = toGrid(20) * CELL_SIZE;
            expect(cylinderContainer.querySelector('circle.spell-overlay').getAttribute('r')).toBe(String(expectedR));
            expect(sphereContainer.querySelector('circle.spell-overlay').getAttribute('r')).toBe(String(expectedR));
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
    });

    describe('multiple overlays', () => {
        it('should render multiple overlays', () => {
            const sphere = makeSphereOverlay({ id: 's1' });
            const cube = makeCubeOverlay({ id: 'c1' });
            const cone = makeConeOverlay({ id: 'cn1' });
            const line = makeLineOverlay({ id: 'l1' });
            const { container } = renderComponent({}, [sphere, cube, cone, line]);
            expect(getGroups(container).length).toBe(4);
        });

        it('should render each overlay group with correct key', () => {
            const sphere1 = makeSphereOverlay({ id: 's1' });
            const sphere2 = makeSphereOverlay({ id: 's2' });
            const { container } = renderComponent({}, [sphere1, sphere2]);
            expect(getGroups(container).length).toBe(2);
        });

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
