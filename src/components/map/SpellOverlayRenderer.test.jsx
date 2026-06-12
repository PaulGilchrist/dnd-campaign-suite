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

describe('SpellOverlayRenderer', () => {
    it('should render no overlays when overlays array is empty', () => {
        const { container } = renderComponent({}, [], null);
        const layer = container.querySelector('g.spell-overlay-layer');
        expect(layer).not.toBeNull();
        const groups = container.querySelectorAll('g.spell-overlay-group');
        expect(groups.length).toBe(0);
    });

    it('should render a sphere overlay', () => {
        const sphere = makeSphereOverlay();
        const { container } = renderComponent({}, [sphere]);
        const layer = container.querySelector('g.spell-overlay-layer');
        expect(layer).not.toBeNull();
        const groups = container.querySelectorAll('g.spell-overlay-group');
        expect(groups.length).toBe(1);
    });

    it('should render a sphere with correct circle radius', () => {
        const sphere = makeSphereOverlay({ radiusFt: 20 });
        const { container } = renderComponent({}, [sphere]);
        const spellOverlay = container.querySelector('circle.spell-overlay');
        const expectedR = toGrid(20) * CELL_SIZE;
        expect(spellOverlay.getAttribute('r')).toBe(String(expectedR));
    });

    it('should render a sphere at correct center position', () => {
        const sphere = makeSphereOverlay({ startGridX: 5, startGridY: 5 });
        const { container } = renderComponent({}, [sphere]);
        const spellOverlay = container.querySelector('circle.spell-overlay');
        const expectedCx = gridCenterX(5);
        const expectedCy = gridCenterY(5);
        expect(spellOverlay.getAttribute('cx')).toBe(String(expectedCx));
        expect(spellOverlay.getAttribute('cy')).toBe(String(expectedCy));
    });

    it('should render a sphere with correct fill color', () => {
        const sphere = makeSphereOverlay({ color: 'rgba(255,80,60,0.35)' });
        const { container } = renderComponent({}, [sphere]);
        const spellOverlay = container.querySelector('circle.spell-overlay');
        expect(spellOverlay.getAttribute('fill')).toBe('rgba(255,80,60,0.35)');
    });

    it('should render a sphere with stroke color derived from fill', () => {
        const sphere = makeSphereOverlay({ color: 'rgba(255,80,60,0.35)' });
        const { container } = renderComponent({}, [sphere]);
        const spellOverlay = container.querySelector('circle.spell-overlay');
        expect(spellOverlay.getAttribute('stroke')).toBe('rgba(255,80,60,0.8)');
    });

    it('should render a drag handle at the center of a sphere', () => {
        const sphere = makeSphereOverlay({ startGridX: 5, startGridY: 5 });
        const { container } = renderComponent({}, [sphere]);
        const handles = container.querySelectorAll('circle.spell-overlay-handle');
        expect(handles.length).toBe(1);
        const handle = handles[0];
        const expectedCx = gridCenterX(5);
        const expectedCy = gridCenterY(5);
        expect(handle.getAttribute('cx')).toBe(String(expectedCx));
        expect(handle.getAttribute('cy')).toBe(String(expectedCy));
    });

    it('should render a sphere drag handle with cursor move', () => {
        const sphere = makeSphereOverlay();
        const { container } = renderComponent({}, [sphere]);
        const handle = container.querySelector('circle.spell-overlay-handle');
        expect(handle.getAttribute('style')).toContain('cursor: move');
    });

    it('should render a cylinder overlay', () => {
        const cylinder = makeCylinderOverlay();
        const { container } = renderComponent({}, [cylinder]);
        const groups = container.querySelectorAll('g.spell-overlay-group');
        expect(groups.length).toBe(1);
    });

    it('should render a cylinder using the same path as a sphere', () => {
        const cylinder = makeCylinderOverlay({ radiusFt: 20 });
        const sphere = makeSphereOverlay({ radiusFt: 20 });
        const { container: cylinderContainer } = renderComponent({}, [cylinder]);
        const { container: sphereContainer } = renderComponent({}, [sphere]);
        const cylinderR = toGrid(20) * CELL_SIZE;
        const sphereR = toGrid(20) * CELL_SIZE;
        expect(cylinderContainer.querySelector('circle.spell-overlay').getAttribute('r')).toBe(String(cylinderR));
        expect(sphereContainer.querySelector('circle.spell-overlay').getAttribute('r')).toBe(String(sphereR));
    });

    it('should render a cube overlay', () => {
        const cube = makeCubeOverlay();
        const { container } = renderComponent({}, [cube]);
        const groups = container.querySelectorAll('g.spell-overlay-group');
        expect(groups.length).toBe(1);
    });

    it('should render a cube with correct size', () => {
        const cube = makeCubeOverlay({ sizeFt: 15 });
        const { container } = renderComponent({}, [cube]);
        const cubeRect = container.querySelector('rect.spell-overlay');
        const expectedSize = toGrid(15) * CELL_SIZE;
        expect(cubeRect.getAttribute('width')).toBe(String(expectedSize));
        expect(cubeRect.getAttribute('height')).toBe(String(expectedSize));
    });

    it('should render a cube centered at correct position', () => {
        const cube = makeCubeOverlay({ startGridX: 4, startGridY: 4, sizeFt: 15 });
        const { container } = renderComponent({}, [cube]);
        const cubeRect = container.querySelector('rect.spell-overlay');
        const cx = gridCenterX(4);
        const cy = gridCenterY(4);
        const size = toGrid(15) * CELL_SIZE;
        expect(cubeRect.getAttribute('x')).toBe(String(cx - size / 2));
        expect(cubeRect.getAttribute('y')).toBe(String(cy - size / 2));
    });

    it('should render a cube with rotation transform', () => {
        const cube = makeCubeOverlay({ angle: 45 });
        const { container } = renderComponent({}, [cube]);
        const group = container.querySelector('g.spell-overlay-group');
        const innerGroup = group.querySelector('g');
        expect(innerGroup.getAttribute('transform')).toContain('rotate(45');
    });

    it('should render a cube with drag handle at center', () => {
        const cube = makeCubeOverlay({ startGridX: 4, startGridY: 4 });
        const { container } = renderComponent({}, [cube]);
        const handles = container.querySelectorAll('circle.spell-overlay-handle');
        expect(handles.length).toBe(1);
    });

    it('should render a cone overlay', () => {
        const cone = makeConeOverlay();
        const { container } = renderComponent({}, [cone]);
        const groups = container.querySelectorAll('g.spell-overlay-group');
        expect(groups.length).toBe(1);
    });

    it('should render a cone with a path element', () => {
        const cone = makeConeOverlay();
        const { container } = renderComponent({}, [cone]);
        const path = container.querySelector('path.spell-overlay');
        expect(path).not.toBeNull();
    });

    it('should render a cone with correct path starting at origin', () => {
        const cone = makeConeOverlay({ startGridX: 2, startGridY: 2, distanceFt: 60, coneAngle: 90, angle: 90 });
        const { container } = renderComponent({}, [cone]);
        const path = container.querySelector('path.spell-overlay');
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

    it('should render a cone origin handle with cursor move', () => {
        const cone = makeConeOverlay();
        const { container } = renderComponent({}, [cone]);
        const handles = container.querySelectorAll('circle.spell-overlay-handle');
        expect(handles[0].getAttribute('style')).toContain('cursor: move');
    });

    it('should render a cone edge handle with cursor grab', () => {
        const cone = makeConeOverlay();
        const { container } = renderComponent({}, [cone]);
        const handles = container.querySelectorAll('circle.spell-overlay-handle');
        expect(handles[1].getAttribute('style')).toContain('cursor: grab');
    });

    it('should render a line overlay', () => {
        const line = makeLineOverlay();
        const { container } = renderComponent({}, [line]);
        const groups = container.querySelectorAll('g.spell-overlay-group');
        expect(groups.length).toBe(1);
    });

    it('should render a line with a rect element', () => {
        const line = makeLineOverlay();
        const { container } = renderComponent({}, [line]);
        const lineRect = container.querySelector('rect.spell-overlay');
        expect(lineRect).not.toBeNull();
    });

    it('should render a line with correct width', () => {
        const line = makeLineOverlay({ widthFt: 5 });
        const { container } = renderComponent({}, [line]);
        const lineRect = container.querySelector('rect.spell-overlay');
        const expectedWidth = toGrid(5) * CELL_SIZE;
        expect(lineRect.getAttribute('height')).toBe(String(expectedWidth));
    });

    it('should render a line with correct length', () => {
        const line = makeLineOverlay({ distanceFt: 30 });
        const { container } = renderComponent({}, [line]);
        const lineRect = container.querySelector('rect.spell-overlay');
        const expectedLength = toGrid(30) * CELL_SIZE;
        expect(lineRect.getAttribute('width')).toBe(String(expectedLength));
    });

    it('should render a line with rotation transform', () => {
        const line = makeLineOverlay({ angle: 45 });
        const { container } = renderComponent({}, [line]);
        const group = container.querySelector('g.spell-overlay-group');
        const innerGroup = group.querySelector('g');
        expect(innerGroup.getAttribute('transform')).toContain('rotate(45');
    });

    it('should render a line with two drag handles', () => {
        const line = makeLineOverlay();
        const { container } = renderComponent({}, [line]);
        const handles = container.querySelectorAll('circle.spell-overlay-handle');
        expect(handles.length).toBe(2);
    });

    it('should render a line origin handle with cursor move', () => {
        const line = makeLineOverlay();
        const { container } = renderComponent({}, [line]);
        const handles = container.querySelectorAll('circle.spell-overlay-handle');
        expect(handles[0].getAttribute('style')).toContain('cursor: move');
    });

    it('should render a line end handle with cursor grab', () => {
        const line = makeLineOverlay();
        const { container } = renderComponent({}, [line]);
        const handles = container.querySelectorAll('circle.spell-overlay-handle');
        expect(handles[1].getAttribute('style')).toContain('cursor: grab');
    });

    it('should render an unknown shape as null (nothing)', () => {
        const unknown = { id: 'unknown-1', shape: 'unknown' };
        const { container } = renderComponent({}, [unknown]);
        const groups = container.querySelectorAll('g.spell-overlay-group');
        expect(groups.length).toBe(0);
    });

    it('should render multiple overlays', () => {
        const sphere = makeSphereOverlay({ id: 's1' });
        const cube = makeCubeOverlay({ id: 'c1' });
        const cone = makeConeOverlay({ id: 'cn1' });
        const line = makeLineOverlay({ id: 'l1' });
        const { container } = renderComponent({}, [sphere, cube, cone, line]);
        const groups = container.querySelectorAll('g.spell-overlay-group');
        expect(groups.length).toBe(4);
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
        const layer = container.querySelector('g.spell-overlay-layer');
        expect(layer).not.toBeNull();
        const groups = container.querySelectorAll('g.spell-overlay-group');
        expect(groups.length).toBe(5);
    });

    it('should render a pending overlay', () => {
        const pending = makeSphereOverlay({ id: 'pending-1' });
        const { container } = renderComponent({}, [], pending);
        const groups = container.querySelectorAll('g.spell-overlay-group');
        expect(groups.length).toBe(1);
    });

    it('should render both overlays and pending overlay', () => {
        const sphere = makeSphereOverlay({ id: 's1' });
        const pending = makeCubeOverlay({ id: 'pending-1' });
        const { container } = renderComponent({}, [sphere], pending);
        const groups = container.querySelectorAll('g.spell-overlay-group');
        expect(groups.length).toBe(2);
    });

    it('should default overlays to empty array when not provided', () => {
        const { container } = renderComponent({ overlays: undefined });
        const layer = container.querySelector('g.spell-overlay-layer');
        expect(layer).not.toBeNull();
    });

    it('should default pendingOverlay to null when not provided', () => {
        const sphere = makeSphereOverlay({ id: 's1' });
        const { container } = renderComponent({ pendingOverlay: null }, [sphere]);
        const groups = container.querySelectorAll('g.spell-overlay-group');
        expect(groups.length).toBe(1);
    });

    it('should render sphere with different radius', () => {
        const sphere = makeSphereOverlay({ radiusFt: 30 });
        const { container } = renderComponent({}, [sphere]);
        const spellOverlay = container.querySelector('circle.spell-overlay');
        const expectedR = toGrid(30) * CELL_SIZE;
        expect(spellOverlay.getAttribute('r')).toBe(String(expectedR));
    });

    it('should render sphere with custom color', () => {
        const sphere = makeSphereOverlay({ color: 'rgba(0,255,0,0.35)' });
        const { container } = renderComponent({}, [sphere]);
        const spellOverlay = container.querySelector('circle.spell-overlay');
        expect(spellOverlay.getAttribute('fill')).toBe('rgba(0,255,0,0.35)');
        expect(spellOverlay.getAttribute('stroke')).toBe('rgba(0,255,0,0.8)');
    });

    it('should render cone with 53 degree angle (default)', () => {
        const cone = makeConeOverlay({ coneAngle: 53 });
        const { container } = renderComponent({}, [cone]);
        const path = container.querySelector('path.spell-overlay');
        expect(path).not.toBeNull();
    });

    it('should render cone with 90 degree angle', () => {
        const cone = makeConeOverlay({ coneAngle: 90, angle: 0 });
        const { container } = renderComponent({}, [cone]);
        const path = container.querySelector('path.spell-overlay');
        expect(path.getAttribute('d')).toContain('A');
    });

    it('should render cube with custom angle rotation', () => {
        const cube = makeCubeOverlay({ angle: 90, sizeFt: 10 });
        const { container } = renderComponent({}, [cube]);
        const group = container.querySelector('g.spell-overlay-group');
        const innerGroup = group.querySelector('g');
        expect(innerGroup.getAttribute('transform')).toContain('rotate(90');
    });

    it('should render line with custom angle', () => {
        const line = makeLineOverlay({ angle: 180, distanceFt: 40 });
        const { container } = renderComponent({}, [line]);
        const group = container.querySelector('g.spell-overlay-group');
        const innerGroup = group.querySelector('g');
        expect(innerGroup.getAttribute('transform')).toContain('rotate(180');
    });

    it('should render each overlay group with correct key', () => {
        const sphere1 = makeSphereOverlay({ id: 's1' });
        const sphere2 = makeSphereOverlay({ id: 's2' });
        const { container } = renderComponent({}, [sphere1, sphere2]);
        const groups = container.querySelectorAll('g.spell-overlay-group');
        expect(groups.length).toBe(2);
    });

    it('should render drag handle with correct radius', () => {
        const sphere = makeSphereOverlay();
        const { container } = renderComponent({}, [sphere]);
        const handle = container.querySelector('circle.spell-overlay-handle');
        expect(handle.getAttribute('r')).toBe('6');
    });

    it('should render cone with large angle > 180', () => {
        const cone = makeConeOverlay({ coneAngle: 270, angle: 45 });
        const { container } = renderComponent({}, [cone]);
        const path = container.querySelector('path.spell-overlay');
        expect(path).not.toBeNull();
    });

    it('should render line with custom width', () => {
        const line = makeLineOverlay({ widthFt: 10, distanceFt: 20 });
        const { container } = renderComponent({}, [line]);
        const lineRect = container.querySelector('rect.spell-overlay');
        const expectedWidth = toGrid(10) * CELL_SIZE;
        const expectedLength = toGrid(20) * CELL_SIZE;
        expect(lineRect.getAttribute('height')).toBe(String(expectedWidth));
        expect(lineRect.getAttribute('width')).toBe(String(expectedLength));
    });

    it('should render cube with correct stroke color derived from fill', () => {
        const cube = makeCubeOverlay({ color: 'rgba(100,150,255,0.35)' });
        const { container } = renderComponent({}, [cube]);
        const cubeRect = container.querySelector('rect.spell-overlay');
        expect(cubeRect.getAttribute('stroke')).toBe('rgba(100,150,255,0.8)');
    });

    it('should render line with correct stroke color derived from fill', () => {
        const line = makeLineOverlay({ color: 'rgba(200,100,255,0.35)' });
        const { container } = renderComponent({}, [line]);
        const lineRect = container.querySelector('rect.spell-overlay');
        expect(lineRect.getAttribute('stroke')).toBe('rgba(200,100,255,0.8)');
    });

    it('should render overlay groups in correct order: overlays then pending', () => {
        const sphere = makeSphereOverlay({ id: 's1' });
        const cube = makeCubeOverlay({ id: 'c1' });
        const pending = makeConeOverlay({ id: 'p1' });
        const { container } = renderComponent({}, [sphere, cube], pending);
        const groups = container.querySelectorAll('g.spell-overlay-group');
        expect(groups.length).toBe(3);
    });

    it('should render pending overlay with same shape rendering as regular overlay', () => {
        const pendingCone = makeConeOverlay({ id: 'pending-cone' });
        const { container } = renderComponent({}, [], pendingCone);
        const path = container.querySelector('path.spell-overlay');
        expect(path).not.toBeNull();
    });

    it('should render pending cube overlay', () => {
        const pendingCube = makeCubeOverlay({ id: 'pending-cube' });
        const { container } = renderComponent({}, [], pendingCube);
        const cubeRect = container.querySelector('rect.spell-overlay');
        expect(cubeRect).not.toBeNull();
    });

    it('should render pending line overlay', () => {
        const pendingLine = makeLineOverlay({ id: 'pending-line' });
        const { container } = renderComponent({}, [], pendingLine);
        const lineRect = container.querySelector('rect.spell-overlay');
        expect(lineRect).not.toBeNull();
    });

    it('should handle overlay at grid origin', () => {
        const sphere = makeSphereOverlay({ startGridX: 0, startGridY: 0 });
        const { container } = renderComponent({}, [sphere]);
        const spellOverlay = container.querySelector('circle.spell-overlay');
        const expectedCx = gridCenterX(0);
        const expectedCy = gridCenterY(0);
        expect(spellOverlay.getAttribute('cx')).toBe(String(expectedCx));
        expect(spellOverlay.getAttribute('cy')).toBe(String(expectedCy));
    });

    it('should handle overlay at high grid coordinates', () => {
        const sphere = makeSphereOverlay({ startGridX: 20, startGridY: 15 });
        const { container } = renderComponent({}, [sphere]);
        const spellOverlay = container.querySelector('circle.spell-overlay');
        const expectedCx = gridCenterX(20);
        const expectedCy = gridCenterY(15);
        expect(spellOverlay.getAttribute('cx')).toBe(String(expectedCx));
        expect(spellOverlay.getAttribute('cy')).toBe(String(expectedCy));
    });

    it('should render cone with angle 0', () => {
        const cone = makeConeOverlay({ angle: 0, coneAngle: 53 });
        const { container } = renderComponent({}, [cone]);
        const path = container.querySelector('path.spell-overlay');
        expect(path).not.toBeNull();
    });

    it('should render cone with angle 360', () => {
        const cone = makeConeOverlay({ angle: 360, coneAngle: 90 });
        const { container } = renderComponent({}, [cone]);
        const path = container.querySelector('path.spell-overlay');
        expect(path).not.toBeNull();
    });
});
