import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Map3D from './Map3D.jsx';

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

const createMapData = (overrides = {}) => ({
    displayName: 'Test Map',
    gridSize: 10,
    walls: new Set(['0,0', '1,1']),
    rooms: [{ id: 'r1', type: 'common', label: 'Hall', rect: { x: 0, y: 0, w: 5, h: 5 } }],
    players: [{ id: 'p1', name: 'Aria', gridX: 1, gridY: 1 }],
    bgFill: '#1a1a1a',
    ...overrides,
});

const fogSet = new Set(['5,5']);

const renderMap3D = (props = {}) => {
    const defaultProps = {
        campaignName: 'test-campaign',
        mapData: createMapData(),
        placedItems: [
            { id: 'i1', type: 'table', name: 'Table', gridX: 2, gridY: 2, visible: true },
            { id: 'i2', type: 'npc', name: 'Orc', gridX: 3, gridY: 3, visible: true },
        ],
        characters: [{ name: 'Aria', imagePath: 'avatars/aria.png' }],
        isLocalhost: true,
        fog: fogSet,
        npcImages: { Orc: 'https://example.com/orc.jpg' },
        onExit: vi.fn(),
        ...props,
    };
    return render(<Map3D {...defaultProps} />);
};

describe('Map3D', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        initMock.mockResolvedValue(undefined);
        constructedContainers.length = 0;
    });

    it('renders the 3D top bar with title, counts, and 2D button', () => {
        renderMap3D();
        expect(screen.getByText('Test Map')).toBeInTheDocument();
        expect(screen.getByText('2 walls · 1 items · 1 players · 1 npcs · 1 rooms')).toBeInTheDocument();
        expect(screen.getByTitle('Back to 2D map')).toBeInTheDocument();
    });

    it('calls onExit when the 2D button is clicked', () => {
        const onExit = vi.fn();
        renderMap3D({ onExit });
        fireEvent.click(screen.getByTitle('Back to 2D map'));
        expect(onExit).toHaveBeenCalledTimes(1);
    });

    it('shows a loading indicator until the scene is ready', async () => {
        renderMap3D();
        expect(screen.getByText('Loading 3D map…')).toBeInTheDocument();
        await act(async () => {});
        expect(screen.queryByText('Loading 3D map…')).not.toBeInTheDocument();
    });

    it('constructs the scene with the viewport container and builds the map with the map data', async () => {
        const { container } = renderMap3D();
        await act(async () => {});
        expect(constructedContainers.length).toBe(1);
        expect(constructedContainers[0]).toBe(container.querySelector('.map3d-viewport'));
        expect(buildMapMock).toHaveBeenCalledWith(expect.objectContaining({
            gridSize: 10,
            walls: ['0,0', '1,1'],
            rooms: expect.any(Array),
            items: expect.any(Array),
            players: expect.any(Array),
            fog: fogSet,
            isLocalhost: true,
            npcImages: { Orc: 'https://example.com/orc.jpg' },
            playerAvatars: { p1: 'campaigns/test-campaign/avatars/aria.png' },
            bgFill: '#1a1a1a',
        }));
    });

    it('forwards spell overlays to buildMap and rebuilds when they change', async () => {
        const overlays = [{ id: 'o1', shape: 'sphere', startGridX: 1, startGridY: 1, radiusFt: 20 }];
        const { rerender } = renderMap3D({ overlays });
        await act(async () => {});
        expect(buildMapMock).toHaveBeenLastCalledWith(expect.objectContaining({ overlays }));
        buildMapMock.mockClear();
        const moreOverlays = [
            ...overlays,
            { id: 'o2', shape: 'line', startGridX: 2, startGridY: 2, distanceFt: 60 },
        ];
        await act(async () => {
            rerender(
                <Map3D
                    campaignName="test-campaign"
                    mapData={createMapData()}
                    placedItems={[]}
                    characters={[]}
                    isLocalhost
                    fog={fogSet}
                    npcImages={{}}
                    overlays={moreOverlays}
                    onExit={vi.fn()}
                />
            );
        });
        expect(buildMapMock).toHaveBeenCalledTimes(1);
        expect(buildMapMock).toHaveBeenLastCalledWith(expect.objectContaining({ overlays: moreOverlays }));
    });

    it('rebuilds the map when map data changes', async () => {
        const { rerender } = renderMap3D();
        await act(async () => {});
        buildMapMock.mockClear();
        await act(async () => {
            rerender(
                <Map3D
                    campaignName="test-campaign"
                    mapData={createMapData({ players: [{ id: 'p1', name: 'Aria', gridX: 2, gridY: 2 }] })}
                    placedItems={[]}
                    characters={[]}
                    isLocalhost
                    fog={fogSet}
                    npcImages={{}}
                    onExit={vi.fn()}
                />
            );
        });
        expect(buildMapMock).toHaveBeenCalledTimes(1);
    });

    it('forwards toggle changes to the scene', async () => {
        renderMap3D();
        await act(async () => {});
        setTogglesMock.mockClear();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Rooms' }));
        await act(async () => {});
        expect(setTogglesMock).toHaveBeenCalledWith({ showRooms: false, showLabels: true, showTorch: true });
    });

    it('calls topDown when the Top-down button is clicked', async () => {
        renderMap3D();
        await act(async () => {});
        fireEvent.click(screen.getByTitle('Top-down view'));
        expect(topDownMock).toHaveBeenCalledTimes(1);
    });

    it('disposes the scene on unmount', async () => {
        const { unmount } = renderMap3D();
        await act(async () => {});
        disposeMock.mockClear();
        unmount();
        expect(disposeMock).toHaveBeenCalledTimes(1);
    });

    it('shows an error message when WebGL initialization fails', async () => {
        initMock.mockRejectedValue(new Error('no webgl'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        renderMap3D();
        await act(async () => {});
        expect(screen.getByText('WebGL is not available in this browser.')).toBeInTheDocument();
        expect(buildMapMock).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
