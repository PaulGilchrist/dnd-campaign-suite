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

describe('MapToolbar title', () => {
    it('renders the stored displayName instead of re-deriving from the slug', () => {
        renderMapToolbar({ displayName: 'QA Fog Map' });
        expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('QA Fog Map');
        expect(screen.queryByText('Qa Fog Map')).not.toBeInTheDocument();
    });

    it('preserves acronym capitalisation in displayName', () => {
        renderMapToolbar({ mapName: 'qa-fog-map', displayName: 'QA Fog Map' });
        expect(screen.getByText('QA Fog Map')).toBeInTheDocument();
    });

    it('falls back to formatMapName(slug) when displayName is absent', () => {
        renderMapToolbar({ displayName: undefined });
        expect(screen.getByText('Qa Fog Map')).toBeInTheDocument();
    });

    it('falls back to formatMapName(slug) when displayName is empty', () => {
        renderMapToolbar({ displayName: '' });
        expect(screen.getByText('Qa Fog Map')).toBeInTheDocument();
    });

    it('falls back to "Map" when neither displayName nor mapName is provided', () => {
        renderMapToolbar({ mapName: undefined, displayName: undefined });
        expect(screen.getByText('Map')).toBeInTheDocument();
    });
});
