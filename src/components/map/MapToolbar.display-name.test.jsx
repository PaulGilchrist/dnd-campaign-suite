// @maintained-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MapToolbar from './MapToolbar.jsx';

// Lane: regression pin for the map-editor title slug-capitalization fix —
// the toolbar title must show the stored displayName verbatim, never a
// re-derivation from the slug (which mangled 'QA Fog Map' → 'Qa Fog Map').
// Pins only the three distinct title bytes of MapToolbar.jsx's
// `displayName || formatMapName(mapName) || 'Map'` expression that
// siblings do not cover. Split with MapToolbar.test.jsx:
//   - undefined-displayName formatMapName path ('dungeon-map.json' → 'Dungeon Map') → MapToolbar.test.jsx "should render the map name formatted correctly" (skip here)
//   - displayName precedence, acronym preservation, and negative slug byte → this file
//   - empty-string displayName falsy byte → this file (sibling never passes '')
//   - 'Map' final fallback when both props absent → this file (sibling always passes mapName)
// Toolbar routing/lint lane: MapToolbar.test.jsx; Map container HexMap props → Map.test.jsx.

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
        mapName: 'qa-fog-map',
        isLocalhost: true,
        tool: 'none',
        setTool: vi.fn(),
        gridSize: 20,
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

const getTitle = () => screen.getByRole('heading', { level: 4 });

describe('MapToolbar title', () => {
    it('shows the stored displayName verbatim, not re-derived from the slug', () => {
        renderMapToolbar({ displayName: 'QA Fog Map' });
        // Acronym capitalisation must survive; the mangled slug-derived
        // title is the exact regression this lane exists to catch.
        expect(getTitle().textContent).toBe('QA Fog Map');
        expect(screen.queryByText('Qa Fog Map')).not.toBeInTheDocument();
    });

    it('falls back to formatMapName(slug) when displayName is an empty string', () => {
        // Sibling covers displayName absent (undefined); the '' falsy
        // byte is unique here — a stricter falsy that a !== undefined
        // guard would let slip through as a blank title.
        renderMapToolbar({ displayName: '' });
        expect(getTitle().textContent).toBe('Qa Fog Map');
    });

    it('falls back to "Map" when neither displayName nor mapName is provided', () => {
        renderMapToolbar({ mapName: undefined, displayName: undefined });
        expect(getTitle().textContent).toBe('Map');
    });
});
