// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HexMapToolbar from './HexMapToolbar.jsx';
import { TOOL_NONE, TOOL_PAINT, TOOL_ERASE, TOOL_RIVER, TOOL_ROAD, TOOL_TRAVEL } from '../../config/outdoorConfig';

// Tool button titles mirror the component's title props.
// Keeping them local avoids importing from the component source,
// but they must stay in sync with HexMapToolbar.jsx.
const TOOL_TITLES = {
    [TOOL_PAINT]: 'Paint terrain',
    [TOOL_ERASE]: 'Erase terrain paint (re-click Paint rivers tool to remove river hexes)',
    [TOOL_RIVER]: 'Paint rivers',
    [TOOL_ROAD]: 'Connect cities and settlements with roads',
    [TOOL_TRAVEL]: 'Travel mode — plan and execute overland travel',
};

// The toolbar's full button contract: exact set and DOM order (byte-for-byte).
const BUTTON_TITLE_ORDER = [
    'Back to maps',
    TOOL_TITLES[TOOL_PAINT],
    TOOL_TITLES[TOOL_ERASE],
    TOOL_TITLES[TOOL_RIVER],
    TOOL_TITLES[TOOL_ROAD],
    TOOL_TITLES[TOOL_TRAVEL],
    'Open POI panel',
    'Manage marching order',
    'Print map',
    'Zoom in',
    'Zoom out',
    'Reset view',
];

describe('HexMapToolbar', () => {
    let props;
    // A stable container per test so repeat renderToolbar() calls replace
    // (not stack) content — RTL only auto-unmounts between tests, not renders.
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        props = {
            onBack: vi.fn(),
            mapName: 'Test Map',
            tool: TOOL_NONE,
            setTool: vi.fn(),
            selectedTerrain: 'grassland',
            setSelectedTerrain: vi.fn(),
            terrainTypes: [
                { id: 'grassland', name: 'Grassland', fill: '#4a7c3f' },
                { id: 'forest', name: 'Forest', fill: '#2d5a1e' },
                { id: 'water', name: 'Water', fill: '#3a6ea5' },
            ],
            zoomIn: vi.fn(),
            zoomOut: vi.fn(),
            resetView: vi.fn(),
            zoom: 1.0,
            poiPanelOpen: false,
            setPoiPanelOpen: vi.fn(),
            gridSize: 30,
            setGridSize: vi.fn(),
            marchingOrderOpen: false,
            setMarchingOrderOpen: vi.fn(),
            marchingOrder: [],
            // GM (localhost) view is the byte-order contract below; the LAN
            // differential lives in the 'host gating' describe.
            isLocalhost: true,
        };
    });

    afterEach(() => {
        container.remove();
    });

    function renderToolbar(overrideProps = {}) {
        return render(<HexMapToolbar {...props} {...overrideProps} />, { container });
    }

    it('renders the toolbar buttons in the exact set and order', () => {
        renderToolbar();
        const titles = [...container.querySelectorAll('button[title]')].map(b => b.getAttribute('title'));
        expect(titles).toEqual(BUTTON_TITLE_ORDER);
    });

    // a0211afcb precedent: icon-only tool buttons mirror their title into an
    // aria-label so harnesses can reach them by accessible name. One
    // intentional split: the erase button keeps its short accessible name
    // ("Erase terrain") while the title carries the terrain-vs-rivers
    // contract clarification (2026-10-27 QA run I — tooltip only, no rename).
    it('gives every toolbar button an aria-label mirroring its title', () => {
        renderToolbar();
        const buttons = [...container.querySelectorAll('.hex-map-toolbar button')];
        expect(buttons.length).toBe(BUTTON_TITLE_ORDER.length);
        for (const button of buttons) {
            if (button === screen.getByRole('button', { name: 'Erase terrain' })) {
                expect(button.getAttribute('title')).toBe(TOOL_TITLES[TOOL_ERASE]);
            } else {
                expect(button.getAttribute('aria-label')).toBe(button.getAttribute('title'));
            }
        }
        // Zero unlabelled buttons; a role+name click still dispatches.
        expect(container.querySelectorAll('.hex-map-toolbar button:not([aria-label])')).toHaveLength(0);
        fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
        expect(props.zoomIn).toHaveBeenCalledTimes(1);
    });

    it('mirrors open-state titles into aria-labels on the panel toggles', () => {
        renderToolbar({ poiPanelOpen: true, marchingOrderOpen: true });
        expect(screen.getByRole('button', { name: 'Close POI panel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Close marching order' })).toBeInTheDocument();
    });

    it('renders displayName in preference to mapName', () => {
        renderToolbar({ mapName: 'Northern Wilds' });
        expect(screen.getByText('Northern Wilds')).toBeInTheDocument();

        renderToolbar({ mapName: 'Northern Wilds', displayName: 'The Wilds' });
        expect(screen.getByText('The Wilds')).toBeInTheDocument();
        expect(screen.queryByText('Northern Wilds')).not.toBeInTheDocument();
    });

    // Dynamic back label (backlog 2026-11-11 JV): with the map-history stack
    // armed, the button names the map its press pops — title AND aria-label.
    // The static face is pinned byte-for-byte by the BUTTON_TITLE_ORDER census
    // above (no backMapTarget passed → 'Back to maps').
    it('names the popped map in title + aria-label when backMapTarget is armed', () => {
        renderToolbar({ backMapTarget: { mapName: 'jv-travel', mapDisplayName: 'JV Travel' } });
        const button = screen.getByRole('button', { name: 'Back to JV Travel' });
        expect(button).toHaveAttribute('title', 'Back to JV Travel');
        expect(screen.queryByTitle('Back to maps')).not.toBeInTheDocument();
        // Press routing unchanged — still a bare onBack click.
        fireEvent.click(button);
        expect(props.onBack).toHaveBeenCalledTimes(1);
    });

    it('title-cases a slug-only entry and reverts to the static label on null', () => {
        renderToolbar({ backMapTarget: { mapName: 'jv-travel' } });
        expect(screen.getByTitle('Back to Jv Travel'))
            .toHaveAttribute('aria-label', 'Back to Jv Travel');
        // Final pop empties the stack → the SAME mounted toolbar reverts to the
        // byte-identical "Back to maps" (no remount).
        renderToolbar({ backMapTarget: null });
        expect(screen.getByTitle('Back to maps'))
            .toHaveAttribute('aria-label', 'Back to maps');
    });

    // Simple fire-and-forget buttons: click routes to exactly the right prop, once.
    // (Container seam proves the handlers do something — HexMap.test.jsx #793; here we own the button wiring.)
    it.each([
        ['Back to maps', 'onBack'],
        ['Zoom in', 'zoomIn'],
        ['Zoom out', 'zoomOut'],
        ['Reset view', 'resetView'],
    ])('%s calls %s once', (title, propKey) => {
        renderToolbar();
        fireEvent.click(screen.getByTitle(title));
        expect(props[propKey]).toHaveBeenCalledTimes(1);
    });

    it('prints the map when the print button is clicked', () => {
        const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
        renderToolbar();
        fireEvent.click(screen.getByTitle('Print map'));
        expect(printSpy).toHaveBeenCalledTimes(1);
        printSpy.mockRestore();
    });

    // Arm → payload, active byte, terrain-selector visibility, disarm → payload.
    it.each(Object.entries(TOOL_TITLES))(
        'tool %s: arms with payload, is the only active tool, disarms to NONE',
        (tool, title) => {
            renderToolbar({ tool: TOOL_NONE });
            const button = screen.getByTitle(title);
            expect(button).not.toHaveClass('active');

            fireEvent.click(button);
            expect(props.setTool).toHaveBeenCalledTimes(1);
            expect(props.setTool).toHaveBeenCalledWith(tool);

            props.setTool.mockClear();
            // The travel button's .active face is the COMMITTED travel-open
            // boolean (travelActive), not the tool byte — feed it for the
            // armed re-render (improve JT 2026-11-11 parity law).
            renderToolbar({ tool, travelActive: tool === TOOL_TRAVEL });
            expect(screen.getByTitle(title)).toHaveClass('active');
            for (const [otherTool, otherTitle] of Object.entries(TOOL_TITLES)) {
                if (otherTool !== tool) {
                    expect(screen.getByTitle(otherTitle)).not.toHaveClass('active');
                }
            }

            // Terrain selector belongs to paint/erase only.
            const selectorVisible = tool === TOOL_PAINT || tool === TOOL_ERASE;
            if (selectorVisible) {
                expect(screen.getByTitle('Grassland')).toBeInTheDocument();
            } else {
                expect(screen.queryByTitle('Grassland')).not.toBeInTheDocument();
            }

            fireEvent.click(screen.getByTitle(title));
            expect(props.setTool).toHaveBeenCalledTimes(1);
            expect(props.setTool).toHaveBeenCalledWith(TOOL_NONE);
        }
    );

    // Run F (2026-10-27): binary view toggle must announce on/off to screen
    // readers. IMPROVE JT 2026-11-11 (tool/panel parity): the pressed face is
    // no longer the `tool` byte — .active AND aria-pressed both mirror the
    // `travelActive` prop, the ONE committed boolean the host mounts the
    // TravelPanel on (useTravelToolSync's travelPanelOpen). Panel open ⇔
    // aria-pressed=true holds by construction; `tool` stays the click-intent
    // channel (arm/disarm payloads unchanged).
    it('travel button mirrors the COMMITTED travelActive face, never the raw tool byte', () => {
        const travelName = TOOL_TITLES[TOOL_TRAVEL];

        // Inactive: attribute present and false.
        renderToolbar({ tool: TOOL_NONE, travelActive: false });
        const idle = screen.getByRole('button', { name: travelName });
        expect(idle).toHaveAttribute('aria-pressed', 'false');
        expect(idle).not.toHaveClass('active');

        // Press intent: click requests TOOL_TRAVEL — but the face lags the
        // COMMIT, not the click. While travel has not landed (travelActive
        // false, e.g. the fresh-mount absorbed press) the button stays
        // honestly unpressed: no ghost .active without a panel.
        fireEvent.click(idle);
        expect(props.setTool).toHaveBeenCalledWith(TOOL_TRAVEL);
        renderToolbar({ tool: TOOL_TRAVEL, travelActive: false });
        expect(screen.getByRole('button', { name: travelName })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: travelName })).not.toHaveClass('active');

        // Activation landed: BOTH faces flip on the same committed boolean.
        renderToolbar({ tool: TOOL_TRAVEL, travelActive: true });
        const armed = screen.getByRole('button', { name: travelName });
        expect(armed).toHaveAttribute('aria-pressed', 'true');
        expect(armed).toHaveClass('active');

        // Arrival/cancel settle: face clears even mid-churn of the tool byte.
        fireEvent.click(armed);
        expect(props.setTool).toHaveBeenLastCalledWith(TOOL_NONE);
        renderToolbar({ tool: TOOL_NONE, travelActive: false });
        expect(screen.getByRole('button', { name: travelName })).toHaveAttribute('aria-pressed', 'false');
    });

    // Run I (2026-10-27) backlog: tooltip-only clarification of the erase
    // contract — clears terrain paint overrides only; river hexes toggle off
    // by re-clicking the Paint rivers tool. Behavior must be untouched:
    // short aria-label, .active toggle, arm/disarm payloads unchanged.
    it('erase button documents terrain-only scope in its tooltip without changing behavior', () => {
        renderToolbar({ tool: TOOL_NONE });
        const erase = screen.getByRole('button', { name: 'Erase terrain' });
        expect(erase).toHaveAttribute(
            'title',
            'Erase terrain paint (re-click Paint rivers tool to remove river hexes)'
        );
        expect(erase).toHaveAttribute('aria-label', 'Erase terrain');
        expect(erase).not.toHaveAttribute('aria-pressed');

        fireEvent.click(erase);
        expect(props.setTool).toHaveBeenCalledTimes(1);
        expect(props.setTool).toHaveBeenCalledWith(TOOL_ERASE);

        props.setTool.mockClear();
        renderToolbar({ tool: TOOL_ERASE });
        const armed = screen.getByRole('button', { name: 'Erase terrain' });
        expect(armed).toHaveClass('active');
        fireEvent.click(armed);
        expect(props.setTool).toHaveBeenCalledTimes(1);
        expect(props.setTool).toHaveBeenCalledWith(TOOL_NONE);
    });

    it('clicking a swatch selects that terrain and arms the paint tool', () => {
        renderToolbar({ tool: TOOL_PAINT });
        fireEvent.click(screen.getByTitle('Forest'));
        expect(props.setSelectedTerrain).toHaveBeenCalledTimes(1);
        expect(props.setSelectedTerrain).toHaveBeenCalledWith('forest');
        expect(props.setTool).toHaveBeenCalledTimes(1);
        expect(props.setTool).toHaveBeenCalledWith(TOOL_PAINT);

        // Clicking a swatch while ERASE is active switches to paint.
        props.setSelectedTerrain.mockClear();
        props.setTool.mockClear();
        renderToolbar({ tool: TOOL_ERASE });
        fireEvent.click(screen.getByTitle('Water'));
        expect(props.setSelectedTerrain).toHaveBeenCalledWith('water');
        expect(props.setTool).toHaveBeenCalledWith(TOOL_PAINT);
    });

    it('marks only the selected terrain swatch as active', () => {
        renderToolbar({ tool: TOOL_PAINT, selectedTerrain: 'forest' });
        expect(screen.getByTitle('Forest')).toHaveClass('active');
        expect(screen.getByTitle('Grassland')).not.toHaveClass('active');
        expect(screen.getByTitle('Water')).not.toHaveClass('active');
    });

    it.each([
        [1.0, '50%'],
        [2.0, '100%'],
        [0.25, '13%'], // rounds half-up: 12.5 → 13
    ])('displays zoom %s as %s', (zoom, expected) => {
        renderToolbar({ zoom });
        expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it('exposes grid size with min/max bounds, numeric change payload, and hex dimension hint', () => {
        renderToolbar({ gridSize: 40 });
        const input = screen.getByDisplayValue('40');
        expect(input).toHaveAttribute('min', '30');
        expect(input).toHaveAttribute('max', '100');
        expect(screen.getByText('80×40')).toBeInTheDocument();

        fireEvent.change(input, { target: { value: '50' } });
        expect(props.setGridSize).toHaveBeenCalledTimes(1);
        expect(props.setGridSize).toHaveBeenCalledWith(50); // number, not string
    });

    it('toggles the POI panel and reflects open state in title and active class', () => {
        renderToolbar({ poiPanelOpen: false });
        fireEvent.click(screen.getByTitle('Open POI panel'));
        expect(props.setPoiPanelOpen).toHaveBeenCalledTimes(1);
        expect(props.setPoiPanelOpen).toHaveBeenCalledWith(true);

        renderToolbar({ poiPanelOpen: true });
        const button = screen.getByTitle('Close POI panel');
        expect(button).toHaveClass('active');
        fireEvent.click(button);
        expect(props.setPoiPanelOpen).toHaveBeenCalledTimes(2);
        expect(props.setPoiPanelOpen).toHaveBeenLastCalledWith(false);
    });

    it('toggles the marching order panel and reflects open state in title and active class', () => {
        renderToolbar({ marchingOrderOpen: false });
        fireEvent.click(screen.getByTitle('Manage marching order'));
        expect(props.setMarchingOrderOpen).toHaveBeenCalledTimes(1);
        expect(props.setMarchingOrderOpen).toHaveBeenCalledWith(true);

        renderToolbar({ marchingOrderOpen: true });
        const button = screen.getByTitle('Close marching order');
        expect(button).toHaveClass('active');
        fireEvent.click(button);
        expect(props.setMarchingOrderOpen).toHaveBeenCalledTimes(2);
        expect(props.setMarchingOrderOpen).toHaveBeenLastCalledWith(false);
    });

    it('shows the marching order count only when non-empty', () => {
        renderToolbar({ marchingOrder: [] });
        expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();

        renderToolbar({ marchingOrder: [{ id: 1 }, { id: 2 }] });
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    // 3D diorama entry (indoor MapToolbar.jsx twin): renders ONLY when the
    // host supplies the handler, fires once, and mirrors title into the
    // accessible name. With it supplied, it slots between the dress mount
    // and Print in the byte-order census.
    it('renders the 3D button only when onEnter3D is provided and invokes it once', () => {
        renderToolbar();
        expect(screen.queryByTitle('View map in 3D')).not.toBeInTheDocument();

        const onEnter3D = vi.fn();
        renderToolbar({ onEnter3D });
        const button = screen.getByRole('button', { name: 'View map in 3D' });
        expect(button).toHaveAttribute('title', 'View map in 3D');
        expect(button).toHaveAttribute('aria-label', 'View map in 3D');
        fireEvent.click(button);
        expect(onEnter3D).toHaveBeenCalledTimes(1);

        const titles = [...container.querySelectorAll('button[title]')].map(b => b.getAttribute('title'));
        // Slot: after the marching toggle (and dress mount), before Print.
        expect(titles).toEqual([...BUTTON_TITLE_ORDER.slice(0, -4), 'View map in 3D', ...BUTTON_TITLE_ORDER.slice(-4)]);
    });

    // bug-lan-player-terrain-paint-persists: the Paint terrain / Erase /
    // Paint rivers / Roads buttons and the Grid-size editor are GM-authored
    // map content — a network client (isLocalhost=false, the HexMap.jsx
    // default) must not even see them, mirroring the dressButton host gate.
    // The shared lanes (travel, POI panel, marching order, zoom, print) and
    // the read-only 3D entry stay available.
    describe('host gating (non-localhost read-only view)', () => {
        const GM_ONLY_TITLES = [
            TOOL_TITLES[TOOL_PAINT],
            'Erase terrain',
            TOOL_TITLES[TOOL_RIVER],
            TOOL_TITLES[TOOL_ROAD],
        ];

        it('hides the editor tools and the grid input but keeps the shared lanes', () => {
            renderToolbar({ isLocalhost: false, onEnter3D: vi.fn() });
            for (const title of GM_ONLY_TITLES) {
                expect(screen.queryByTitle(title)).not.toBeInTheDocument();
            }
            expect(container.querySelector('.hex-map-grid-size')).toBeNull();
            expect(container.querySelector('.terrain-selector')).toBeNull();
            // Shared lanes present, in order.
            const titles = [...container.querySelectorAll('button[title]')].map(b => b.getAttribute('title'));
            expect(titles).toEqual([
                'Back to maps',
                TOOL_TITLES[TOOL_TRAVEL],
                'Open POI panel',
                'Manage marching order',
                'View map in 3D',
                'Print map',
                'Zoom in',
                'Zoom out',
                'Reset view',
            ]);
        });

        it('still arms travel for a LAN client (shared party lane)', () => {
            renderToolbar({ isLocalhost: false, tool: TOOL_NONE });
            fireEvent.click(screen.getByTitle(TOOL_TITLES[TOOL_TRAVEL]));
            expect(props.setTool).toHaveBeenCalledWith(TOOL_TRAVEL);
        });

        it('defaults a host-less render to the hidden (read-only) state', () => {
            const noHost = { ...props };
            delete noHost.isLocalhost;
            render(<HexMapToolbar {...noHost} />, { container });
            expect(screen.queryByTitle(TOOL_TITLES[TOOL_PAINT])).not.toBeInTheDocument();
        });
    });
});
