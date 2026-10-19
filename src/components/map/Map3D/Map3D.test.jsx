// @maintained-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Map3D from './Map3D.jsx';

// Map3D container lane. Map.test.jsx (#924) owns the 2D↔3D mount decision and
// props-down bytes; this file owns what Map3D does ONCE MOUNTED: toolbar title
// + counts + exit dispatch, scene lifecycle (viewport identity, loading/error
// states, dispose), the exact mapData→buildMap payload transform, toggle and
// top-down forwarding. Overlay SHAPE geometry is owned by ./map3dSpellOverlays
// .test.js — only verbatim overlay forwarding is pinned here. Map3DScene is
// mocked with a full call-arg census surface (no undefined proxies); three.js
// is never loaded in this file.

const buildMapMock = vi.fn();
const setTogglesMock = vi.fn();
const topDownMock = vi.fn();
const disposeMock = vi.fn();
const initMock = vi.fn();
const constructedContainers = [];

vi.mock('./map3dScene.js', () => ({
    Map3DScene: class {
        constructor(container) {
            constructedContainers.push(container);
        }
        init() {
            return initMock();
        }
        buildMap(data) {
            buildMapMock(data);
        }
        setToggles(toggles) {
            setTogglesMock(toggles);
        }
        topDown() {
            topDownMock();
        }
        dispose() {
            disposeMock();
        }
    },
}));

const fogSet = new Set(['5,5']);

const createMapData = (overrides = {}) => ({
    displayName: 'Test Map',
    gridSize: 10,
    walls: new Set(['0,0', '1,1']),
    players: [{ id: 'p1', name: 'Aria', gridX: 1, gridY: 1 }],
    bgFill: '#1a1a1a',
    ...overrides,
});

const defaultPlacedItems = [
    { id: 'i1', type: 'table', name: 'Table', gridX: 2, gridY: 2, visible: true },
    { id: 'i2', type: 'npc', name: 'Orc', gridX: 3, gridY: 3, visible: true },
];

const map3dProps = (overrides = {}) => ({
    campaignName: 'test-campaign',
    mapData: createMapData(),
    placedItems: defaultPlacedItems,
    characters: [{ name: 'Aria', imagePath: 'avatars/aria.png' }],
    isLocalhost: true,
    fog: fogSet,
    npcImages: { Orc: 'https://example.com/orc.jpg' },
    onExit: vi.fn(),
    ...overrides,
});

const renderMap3D = (overrides = {}) => {
    const props = map3dProps(overrides);
    return { ...render(<Map3D {...props} />), props };
};

describe('Map3D', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        initMock.mockResolvedValue(undefined);
        constructedContainers.length = 0;
    });

    it('renders toolbar name, exact counts, and fires onExit from the 2D button, falling back to "3D Map"', () => {
        const { props } = renderMap3D();
        expect(screen.getByText('Test Map')).toBeInTheDocument();
        expect(screen.getByText('2 walls · 1 items · 1 players · 1 npcs')).toBeInTheDocument();
        fireEvent.click(screen.getByTitle('Back to 2D map'));
        expect(props.onExit).toHaveBeenCalledTimes(1);

        renderMap3D({ mapData: createMapData({ displayName: undefined }) });
        expect(screen.getByText('3D Map')).toBeInTheDocument();
    });

    it('holds the viewport loading state until init resolves, then builds the exact scene payload', async () => {
        const { container } = renderMap3D();
        expect(screen.getByText('Loading 3D map…')).toBeInTheDocument();
        expect(buildMapMock).not.toHaveBeenCalled();

        await act(async () => {});

        expect(screen.queryByText('Loading 3D map…')).not.toBeInTheDocument();
        expect(constructedContainers).toHaveLength(1);
        expect(constructedContainers[0]).toBe(container.querySelector('.map3d-viewport'));
        expect(setTogglesMock).toHaveBeenCalledWith({ showLabels: true, showTorch: true });
        expect(buildMapMock).toHaveBeenCalledWith({
            gridSize: 10,
            walls: ['0,0', '1,1'],
            items: defaultPlacedItems,
            players: [{ id: 'p1', name: 'Aria', gridX: 1, gridY: 1 }],
            fog: fogSet,
            isLocalhost: true,
            npcImages: { Orc: 'https://example.com/orc.jpg' },
            playerAvatars: { p1: 'campaigns/test-campaign/avatars/aria.png' },
            bgFill: '#1a1a1a',
            overlays: [],
        });
    });

    it('shows the WebGL error in the viewport and never builds when init rejects', async () => {
        initMock.mockRejectedValueOnce(new Error('no webgl'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        renderMap3D();
        await act(async () => {});
        expect(screen.getByText('WebGL is not available in this browser.')).toBeInTheDocument();
        expect(screen.queryByText('Loading 3D map…')).not.toBeInTheDocument();
        expect(buildMapMock).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('rebuilds once with the new overlays when only the overlays prop changes', async () => {
        const overlaysA = [{ id: 'o1', shape: 'sphere', startGridX: 1, startGridY: 1, radiusFt: 20 }];
        const { props, rerender } = renderMap3D({ overlays: overlaysA });
        await act(async () => {});
        expect(buildMapMock).toHaveBeenLastCalledWith(expect.objectContaining({ overlays: overlaysA }));

        buildMapMock.mockClear();
        const overlaysB = [
            ...overlaysA,
            { id: 'o2', shape: 'line', startGridX: 2, startGridY: 2, distanceFt: 60 },
        ];
        await act(async () => {
            rerender(<Map3D {...props} overlays={overlaysB} />);
        });
        expect(buildMapMock).toHaveBeenCalledTimes(1);
        expect(buildMapMock).toHaveBeenCalledWith(expect.objectContaining({ overlays: overlaysB }));
    });

    it('forwards label and torch toggle changes to the scene as exact state', async () => {
        renderMap3D();
        await act(async () => {});
        setTogglesMock.mockClear();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Labels' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Torch light' }));
        expect(setTogglesMock).toHaveBeenNthCalledWith(1, { showLabels: false, showTorch: true });
        expect(setTogglesMock).toHaveBeenNthCalledWith(2, { showLabels: false, showTorch: false });
    });

    it('requests the top-down view from the scene once ready', async () => {
        renderMap3D();
        await act(async () => {});
        fireEvent.click(screen.getByTitle('Top-down view'));
        expect(topDownMock).toHaveBeenCalledTimes(1);
    });

    it('disposes the scene exactly once on unmount', async () => {
        const { unmount } = renderMap3D();
        await act(async () => {});
        disposeMock.mockClear();
        unmount();
        expect(disposeMock).toHaveBeenCalledTimes(1);
    });
});
