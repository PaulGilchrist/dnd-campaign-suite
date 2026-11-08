// @maintained-by-ai
/**
 * Deactivated-map advisory chip in the map view header (backlog 2026-11-05 CW):
 * when the mounted map is NOT the campaign's active map (GM deactivated it, or
 * switched to another, while this view stayed open), MapToolbar renders a
 * subtle status hint — and NOTHING renders while the map is table-active.
 *
 * The App-level derivation (mapIsActive from the '__map__' SSE seam) is pinned
 * in src/App.map-deactivated-advisory.test.jsx; this file pins only the
 * presentational contract: prop false → hint copy present; true/omitted → absent.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MapToolbar from './MapToolbar.jsx';

const createMockSpellOverlayState = (overrides = {}) => ({
    spellMode: null,
    setSpellMode: vi.fn(),
    selectedShape: 'sphere',
    setSelectedShape: vi.fn(),
    shapeParams: {},
    setShapeParams: vi.fn(),
    overlays: [],
    removeOverlay: vi.fn(),
    clearOverlays: vi.fn(),
    ...overrides,
});

const renderMapToolbar = (props = {}) => {
    const defaultProps = {
        mapName: 'dungeon-map.json',
        isLocalhost: true,
        tool: 'none',
        setTool: vi.fn(),
        gridSize: 5,
        setGridSize: vi.fn(),
        setItemsPanelOpen: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        resetView: vi.fn(),
        resetFog: vi.fn(),
        onBack: vi.fn(),
        rulerMode: false,
        setRulerMode: vi.fn(),
        spellOverlayState: createMockSpellOverlayState(),
        ...props,
    };
    return render(<MapToolbar {...defaultProps} />);
};

const HINT_COPY = 'GM deactivated this map — view continues read-only';

describe('MapToolbar deactivated-map advisory', () => {
    it('renders the subtle hint when the mounted map is no longer the active map', () => {
        renderMapToolbar({ mapIsActive: false, isLocalhost: false });
        const hint = screen.getByRole('status');
        expect(hint).toHaveTextContent(HINT_COPY);
        expect(hint.className).toContain('map-deactivated-hint');
    });

    it('renders nothing while the mounted map IS the active map', () => {
        renderMapToolbar({ mapIsActive: true });
        expect(screen.queryByText(HINT_COPY)).not.toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('defaults to active — existing callers that pass no prop never show the hint', () => {
        const { container } = renderMapToolbar();
        expect(container.querySelector('.map-deactivated-hint')).toBeNull();
        expect(screen.queryByText(HINT_COPY)).not.toBeInTheDocument();
    });

    // "View the new map" affordance (backlog 2026-11-08): the jump button
    // lives INSIDE the advisory chip and only ever renders when the host
    // (App.jsx MapsAreaView) supplies a handler — i.e. a different map is
    // table-active while this visitor's board is orphaned.

    it('shows no jump button while no new map is active (deactivation face)', () => {
        renderMapToolbar({ mapIsActive: false, isLocalhost: false });
        expect(screen.getByRole('status')).toHaveTextContent(HINT_COPY);
        expect(screen.queryByRole('button', { name: /View the new map/i })).not.toBeInTheDocument();
    });

    it('renders the "View the new map" button in the chip and fires the handler on click', () => {
        const onViewNewMap = vi.fn();
        renderMapToolbar({ mapIsActive: false, isLocalhost: false, onViewNewMap });
        // Honest advisory copy survives alongside the button (criterion 1+2).
        const hint = screen.getByRole('status');
        expect(hint).toHaveTextContent(HINT_COPY);
        const button = screen.getByRole('button', { name: /View the new map/i });
        expect(hint).toContainElement(button);
        // Never-hijack: nothing happens until the explicit click.
        expect(onViewNewMap).not.toHaveBeenCalled();
        fireEvent.click(button);
        expect(onViewNewMap).toHaveBeenCalledTimes(1);
    });

    it('an active mounted map never shows the button, handler or not', () => {
        renderMapToolbar({ mapIsActive: true, onViewNewMap: vi.fn() });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /View the new map/i })).not.toBeInTheDocument();
    });
});
