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
import { render, screen } from '@testing-library/react';
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
});
