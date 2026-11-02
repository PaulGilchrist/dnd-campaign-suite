// @maintained-by-ai
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HexMap3D from './HexMap3D.jsx';

// HexMap3D container lane (outdoor twin of Map3D.test.jsx). Map3D.test owns
// the INDOOR shell; this file owns what HexMap3D does ONCE MOUNTED: toolbar
// title + counts + exit dispatch, the camera-hint placement, the a11y tier,
// scene lifecycle (loading/error, dispose-once), the exact structural →
// buildMap payload, and the party/travelPath/weather patch lanes — a change
// to any of those must NEVER reach buildMap (the indoor camera-reset bug
// class). hex3dScene.js is mocked with a full call-arg census surface;
// three.js is never loaded in this file.

const buildMapMock = vi.fn();
const setTogglesMock = vi.fn();
const updatePartyMock = vi.fn();
const updateTravelPathMock = vi.fn();
const setWeatherMock = vi.fn();
const topDownMock = vi.fn();
const disposeMock = vi.fn();
const initMock = vi.fn();
const constructedContainers = [];

vi.mock('./hex3dScene.js', () => ({
    Hex3DScene: class {
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
        updateParty(partyPosition) {
            updatePartyMock(partyPosition);
        }
        updateTravelPath(path, pathIndex) {
            updateTravelPathMock(path, pathIndex);
        }
        setWeather(weather) {
            setWeatherMock(weather);
        }
        topDown() {
            topDownMock();
        }
        dispose() {
            disposeMock();
        }
    },
}));

const terrain = { '0,0': 'forest', '1,1': 'water' };
const roads = [{ id: 'r1', hexes: ['0,0', '1,0'] }];
const pois = [{ id: 'p1', type: 'city', q: 2, r: 2, visible: true, label: 'Metropolis' }];

const hex3dProps = (overrides = {}) => ({
    displayName: 'North Reach',
    hexCols: 60,
    hexRows: 30,
    terrain,
    rivers: ['5,5', '6,5'],
    roads,
    pois,
    partyPosition: { q: 3, r: 3 },
    travelPath: [],
    travelPathIndex: 0,
    weather: null,
    isLocalhost: true,
    onExit: vi.fn(),
    ...overrides,
});

const renderHex3D = (overrides = {}) => {
    const props = hex3dProps(overrides);
    return { ...render(<HexMap3D {...props} />), props };
};

describe('HexMap3D', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        initMock.mockResolvedValue(undefined);
        constructedContainers.length = 0;
    });

    it('renders toolbar name, exact counts, and fires onExit from the 2D button, falling back to "3D Map"', () => {
        const { props } = renderHex3D();
        expect(screen.getByText('North Reach')).toBeInTheDocument();
        expect(screen.getByText('1800 hexes · 1 POI · 1 road · 2 river hexes')).toBeInTheDocument();
        fireEvent.click(screen.getByTitle('Back to 2D map'));
        expect(props.onExit).toHaveBeenCalledTimes(1);

        renderHex3D({ displayName: undefined });
        expect(screen.getByText('3D Map')).toBeInTheDocument();
    });

    // Backlog 2026-11-02 BD: the counts line pluralizes each slot honestly
    // (1 → singular, 0/≥2 → plural, byte-matching the old rendering for 0/≥2)
    // and the POI slot is visibility-aware — LAN counts only visible POIs
    // (mesh lane skips hidden), GM counts all and qualifies the hidden ones.
    describe('counts line singular/plural + hidden-POI table', () => {
        const renderCounts = (overrides = {}) => {
            cleanup();
            render(<HexMap3D {...hex3dProps(overrides)} />);
            return screen.getByText(/hex(es)? ·/).textContent;
        };

        const hiddenPoi = { id: 'p0', type: 'town', q: 0, r: 0, visible: false, label: 'Secret' };

        it('renders every slot singular at exactly 1', () => {
            expect(renderCounts({
                hexCols: 1,
                hexRows: 1,
                pois: [pois[0]],
                roads: [roads[0]],
                rivers: ['5,5'],
            })).toBe('1 hex · 1 POI · 1 road · 1 river hex');
        });

        it('renders every slot plural at 0, matching the legacy bytes', () => {
            expect(renderCounts({
                hexCols: 0,
                hexRows: 30,
                pois: [],
                roads: [],
                rivers: [],
            })).toBe('0 hexes · 0 POIs · 0 roads · 0 river hexes');
        });

        it('renders every slot plural at ≥2, matching the legacy bytes', () => {
            expect(renderCounts({
                hexCols: 2,
                hexRows: 3,
                pois: [pois[0], { ...pois[0], id: 'p2' }],
                roads: [roads[0], { id: 'r2', hexes: [] }],
                rivers: ['5,5', '6,5', '7,5'],
            })).toBe('6 hexes · 2 POIs · 2 roads · 3 river hexes');
        });

        it('GM face includes hidden POIs in the total and qualifies them', () => {
            expect(renderCounts({
                hexCols: 1,
                hexRows: 2,
                pois: [pois[0], hiddenPoi],
                isLocalhost: true,
            })).toBe('2 hexes · 2 POIs (1 hidden) · 1 road · 2 river hexes');

            expect(renderCounts({
                hexCols: 1,
                hexRows: 1,
                pois: [hiddenPoi],
                roads: [],
                rivers: [],
                isLocalhost: true,
            })).toBe('1 hex · 1 POI (1 hidden) · 0 roads · 0 river hexes');
        });

        it('GM face with no hidden POIs carries no qualifier (legacy bytes)', () => {
            expect(renderCounts({ isLocalhost: true })).not.toMatch(/hidden/);
        });

        it('LAN face counts only visible POIs and never leaks the hidden qualifier', () => {
            expect(renderCounts({
                hexCols: 1,
                hexRows: 2,
                pois: [pois[0], hiddenPoi],
                isLocalhost: false,
            })).toBe('2 hexes · 1 POI · 1 road · 2 river hexes');

            expect(renderCounts({
                hexCols: 1,
                hexRows: 1,
                pois: [hiddenPoi],
                roads: [],
                rivers: [],
                isLocalhost: false,
            })).toBe('1 hex · 0 POIs · 0 roads · 0 river hexes');
        });

        it('treats pois with visible undefined as visible on both faces (POILayer parity)', () => {
            const unpinned = { id: 'p3', type: 'town', q: 1, r: 1, label: 'Old' };
            expect(renderCounts({ pois: [unpinned], isLocalhost: true })).toBe(
                '1800 hexes · 1 POI · 1 road · 2 river hexes'
            );
            expect(renderCounts({ pois: [unpinned], isLocalhost: false })).toBe(
                '1800 hexes · 1 POI · 1 road · 2 river hexes'
            );
        });
    });

    it('renders the camera-control hint in the toolbar chrome with the exact copy, alongside the intact controls', () => {
        const { container } = renderHex3D();
        const hint = container.querySelector('.hex3d-hint');
        expect(hint).toBeTruthy();
        expect(hint.textContent).toBe('Left-drag to pan · Right-drag to orbit · Scroll to zoom');
        // Sibling of the viewport, never inside it.
        expect(hint.closest('.hex3d-viewport')).toBeNull();
        expect(screen.getByTitle('Top-down view')).toBeInTheDocument();
        expect(screen.getByTitle('Back to 2D map')).toBeInTheDocument();
        const toggles = [...document.querySelectorAll('.hex3d-toggle input')];
        expect(toggles).toHaveLength(2);
        expect(screen.getByRole('checkbox', { name: 'Labels' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Weather' })).toBeChecked();
    });

    it('exit and top-down buttons are discoverable by accessible name (aria-label parity)', () => {
        renderHex3D();
        const exit = screen.getByRole('button', { name: 'Back to 2D map' });
        expect(exit).toHaveAttribute('aria-label', 'Back to 2D map');
        expect(exit).toHaveAttribute('title', 'Back to 2D map');
        const topDown = screen.getByRole('button', { name: 'Top-down view' });
        expect(topDown).toHaveAttribute('aria-label', 'Top-down view');
        expect(topDown).toHaveAttribute('title', 'Top-down view');
    });

    it('holds the viewport loading state until init resolves, then builds the exact scene payload', async () => {
        const { container } = renderHex3D();
        expect(screen.getByText('Loading 3D map…')).toBeInTheDocument();
        expect(buildMapMock).not.toHaveBeenCalled();

        await act(async () => {});

        expect(screen.queryByText('Loading 3D map…')).not.toBeInTheDocument();
        expect(constructedContainers).toHaveLength(1);
        expect(constructedContainers[0]).toBe(container.querySelector('.hex3d-viewport'));
        expect(buildMapMock).toHaveBeenCalledWith({
            hexCols: 60,
            hexRows: 30,
            terrain,
            rivers: ['5,5', '6,5'],
            roads,
            pois,
            isLocalhost: true,
        });
        expect(setTogglesMock).toHaveBeenCalledWith({ showLabels: true, showWeather: true });
        // Patch lanes paint once ready.
        expect(updatePartyMock).toHaveBeenCalledWith({ q: 3, r: 3 });
        expect(updateTravelPathMock).toHaveBeenCalledWith([], 0);
        expect(setWeatherMock).toHaveBeenCalledWith(null);
    });

    it('shows the WebGL error in the viewport and never builds when init rejects', async () => {
        initMock.mockRejectedValueOnce(new Error('no webgl'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        renderHex3D();
        await act(async () => {});
        expect(screen.getByText('WebGL is not available in this browser.')).toBeInTheDocument();
        expect(screen.queryByText('Loading 3D map…')).not.toBeInTheDocument();
        expect(buildMapMock).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('patches party, travel path and weather WITHOUT a scene rebuild', async () => {
        const { props, rerender } = renderHex3D();
        await act(async () => {});
        expect(buildMapMock).toHaveBeenCalledTimes(1);
        buildMapMock.mockClear();
        setTogglesMock.mockClear();

        const pathB = [{ q: 3, r: 3 }, { q: 4, r: 3 }];
        const weatherB = { label: 'Rain', icon: 'cloud-rain' };
        await act(async () => {
            rerender(
                <HexMap3D
                    {...props}
                    partyPosition={{ q: 4, r: 3 }}
                    travelPath={pathB}
                    travelPathIndex={1}
                    weather={weatherB}
                />
            );
        });
        expect(updatePartyMock).toHaveBeenLastCalledWith({ q: 4, r: 3 });
        expect(updateTravelPathMock).toHaveBeenLastCalledWith(pathB, 1);
        expect(setWeatherMock).toHaveBeenLastCalledWith(weatherB);
        // The camera-reset bug class: patch lanes must NEVER full-rebuild.
        expect(buildMapMock).not.toHaveBeenCalled();
        expect(setTogglesMock).not.toHaveBeenCalled();
    });

    it('rebuilds the board when a structural input changes', async () => {
        const { props, rerender } = renderHex3D();
        await act(async () => {});
        buildMapMock.mockClear();
        const terrainB = { ...terrain, '2,2': 'hills' };
        await act(async () => {
            rerender(<HexMap3D {...props} terrain={terrainB} />);
        });
        expect(buildMapMock).toHaveBeenCalledTimes(1);
        expect(buildMapMock).toHaveBeenCalledWith(expect.objectContaining({ terrain: terrainB }));
    });

    it('forwards label and weather toggle changes to the scene as exact state', async () => {
        renderHex3D();
        await act(async () => {});
        setTogglesMock.mockClear();
        buildMapMock.mockClear();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Labels' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Weather' }));
        expect(setTogglesMock).toHaveBeenNthCalledWith(1, { showLabels: false, showWeather: true });
        expect(setTogglesMock).toHaveBeenNthCalledWith(2, { showLabels: false, showWeather: false });
        expect(buildMapMock).not.toHaveBeenCalled();
    });

    it('requests the top-down view from the scene once ready', async () => {
        renderHex3D();
        await act(async () => {});
        fireEvent.click(screen.getByTitle('Top-down view'));
        expect(topDownMock).toHaveBeenCalledTimes(1);
    });

    it('disposes the scene exactly once on unmount', async () => {
        const { unmount } = renderHex3D();
        await act(async () => {});
        disposeMock.mockClear();
        unmount();
        expect(disposeMock).toHaveBeenCalledTimes(1);
    });
});
