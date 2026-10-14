import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HexMapToolbar from './HexMapToolbar.jsx';
import { TOOL_NONE, TOOL_PAINT, TOOL_ERASE, TOOL_RIVER, TOOL_ROAD, TOOL_TRAVEL } from '../../config/outdoorConfig';

// Tool button titles mirror the component's title props.
// Keeping them local avoids importing from the component source,
// but they must stay in sync with HexMapToolbar.jsx.
const TOOL_TITLES = {
    [TOOL_PAINT]: 'Paint terrain',
    [TOOL_ERASE]: 'Erase terrain',
    [TOOL_RIVER]: 'Paint rivers',
    [TOOL_ROAD]: 'Connect cities and settlements with roads',
    [TOOL_TRAVEL]: 'Travel mode — plan and execute overland travel',
};

describe('HexMapToolbar', () => {
    let props;
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
        };
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    function renderToolbar(overrideProps = {}) {
        return render(<HexMapToolbar {...props} {...overrideProps} />, { container });
    }

    // ── Back button ──────────────────────────────────────────────────

    it('calls onBack when the back button is clicked', () => {
        renderToolbar();
        fireEvent.click(screen.getByTitle('Back to maps'));
        expect(props.onBack).toHaveBeenCalledTimes(1);
    });

    it('renders the map name', () => {
        renderToolbar({ mapName: 'Northern Wilds' });
        expect(screen.getByText('Northern Wilds')).toBeInTheDocument();
    });

    // ── Terrain tools ────────────────────────────────────────────────

    it('toggles each terrain tool on and off', () => {
        for (const [tool, title] of Object.entries(TOOL_TITLES)) {
            // Initial render: tool is inactive
            renderToolbar({ tool: TOOL_NONE });
            const button = screen.getByTitle(title);
            expect(button).not.toHaveClass('active');

            // First click: activate
            fireEvent.click(button);
            expect(props.setTool).toHaveBeenLastCalledWith(tool);

            // Re-render with active tool
            props.setTool.mockClear();
            renderToolbar({ tool });
            expect(screen.getByTitle(title)).toHaveClass('active');

            // Second click: deactivate
            fireEvent.click(screen.getByTitle(title));
            expect(props.setTool).toHaveBeenLastCalledWith(TOOL_NONE);

            props.setTool.mockClear();
        }
    });

    it('marks the active tool button with the active class and leaves others inactive', () => {
        for (const [tool, title] of Object.entries(TOOL_TITLES)) {
            renderToolbar({ tool });
            expect(screen.getByTitle(title)).toHaveClass('active');
            for (const [otherTool, otherTitle] of Object.entries(TOOL_TITLES)) {
                if (otherTool !== tool) {
                    expect(screen.getByTitle(otherTitle)).not.toHaveClass('active');
                }
            }
        }
    });

    // ── Terrain selector ─────────────────────────────────────────────

    it('shows the terrain selector when paint or erase tool is active', () => {
        renderToolbar({ tool: TOOL_PAINT });
        expect(screen.getByTitle('Grassland')).toBeInTheDocument();

        renderToolbar({ tool: TOOL_ERASE });
        expect(screen.getByTitle('Grassland')).toBeInTheDocument();
    });

    it('hides the terrain selector for non-paint/erase tools', () => {
        renderToolbar({ tool: TOOL_NONE });
        expect(screen.queryByTitle('Grassland')).not.toBeInTheDocument();

        renderToolbar({ tool: TOOL_RIVER });
        expect(screen.queryByTitle('Grassland')).not.toBeInTheDocument();

        renderToolbar({ tool: TOOL_TRAVEL });
        expect(screen.queryByTitle('Grassland')).not.toBeInTheDocument();
    });

    it('selects terrain and switches to paint tool when a swatch is clicked', () => {
        renderToolbar({ tool: TOOL_PAINT });
        fireEvent.click(screen.getByTitle('Forest'));
        expect(props.setSelectedTerrain).toHaveBeenCalledWith('forest');
        expect(props.setTool).toHaveBeenCalledWith(TOOL_PAINT);
    });

    it('marks the selected terrain swatch as active', () => {
        renderToolbar({ tool: TOOL_PAINT, selectedTerrain: 'forest' });
        expect(screen.getByTitle('Forest')).toHaveClass('active');
        expect(screen.getByTitle('Grassland')).not.toHaveClass('active');
    });

    // ── Zoom controls ────────────────────────────────────────────────

    it('calls the correct handler for each zoom button', () => {
        renderToolbar();
        fireEvent.click(screen.getByTitle('Zoom in'));
        expect(props.zoomIn).toHaveBeenCalled();

        props.zoomIn.mockClear();
        fireEvent.click(screen.getByTitle('Zoom out'));
        expect(props.zoomOut).toHaveBeenCalled();

        props.zoomOut.mockClear();
        fireEvent.click(screen.getByTitle('Reset view'));
        expect(props.resetView).toHaveBeenCalled();
    });

    it('displays the zoom percentage using Math.round(zoom * 50)', () => {
        const zoomTests = [
            [0.5, '25%'],
            [1.0, '50%'],
            [2.0, '100%'],
            [3.0, '150%'],
        ];
        for (const [zoom, expected] of zoomTests) {
            renderToolbar({ zoom });
            expect(screen.getByText(expected)).toBeInTheDocument();
        }
    });

    // ── Grid size ────────────────────────────────────────────────────

    it('renders the grid size input with min/max constraints', () => {
        renderToolbar({ gridSize: 40 });
        const input = screen.getByDisplayValue('40');
        expect(input).toHaveAttribute('min', '30');
        expect(input).toHaveAttribute('max', '100');
    });

    it('calls setGridSize with a numeric value when the input changes', () => {
        renderToolbar();
        fireEvent.change(screen.getByDisplayValue('30'), { target: { value: '50' } });
        expect(props.setGridSize).toHaveBeenCalledWith(50);
    });

    it('shows hex dimensions derived from grid size (width×height)', () => {
        const gridSizeTests = [
            [30, '60×30'],
            [40, '80×40'],
            [50, '100×50'],
            [100, '200×100'],
        ];
        for (const [gridSize, expected] of gridSizeTests) {
            renderToolbar({ gridSize });
            expect(screen.getByText(expected)).toBeInTheDocument();
        }
    });

    // ── POI panel toggle ─────────────────────────────────────────────

    it('toggles the POI panel open/closed', () => {
        renderToolbar({ poiPanelOpen: false });
        fireEvent.click(screen.getByTitle('Open POI panel'));
        expect(props.setPoiPanelOpen).toHaveBeenCalledWith(true);

        props.setPoiPanelOpen.mockClear();
        renderToolbar({ poiPanelOpen: true });
        fireEvent.click(screen.getByTitle('Close POI panel'));
        expect(props.setPoiPanelOpen).toHaveBeenCalledWith(false);
    });

    // ── Marching order toggle ────────────────────────────────────────

    it('toggles the marching order panel open/closed', () => {
        renderToolbar({ marchingOrderOpen: false });
        fireEvent.click(screen.getByTitle('Manage marching order'));
        expect(props.setMarchingOrderOpen).toHaveBeenCalledWith(true);

        props.setMarchingOrderOpen.mockClear();
        renderToolbar({ marchingOrderOpen: true });
        fireEvent.click(screen.getByTitle('Close marching order'));
        expect(props.setMarchingOrderOpen).toHaveBeenCalledWith(false);
    });

    it('shows the marching order count on the toggle button', () => {
        renderToolbar({ marchingOrder: [{ id: 1 }, { id: 2 }] });
        const indicator = screen.getByText('2');
        expect(indicator).toBeInTheDocument();
    });

    it('hides the count indicator when marching order is empty', () => {
        renderToolbar({ marchingOrder: [] });
        expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
    });

    // ── Print button ─────────────────────────────────────────────────

    describe('print button', () => {
        beforeEach(() => {
            vi.spyOn(window, 'print').mockImplementation(() => {});
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('calls window.print when clicked', () => {
            renderToolbar();
            fireEvent.click(screen.getByTitle('Print map'));
            expect(window.print).toHaveBeenCalledTimes(1);
        });
    });
});
