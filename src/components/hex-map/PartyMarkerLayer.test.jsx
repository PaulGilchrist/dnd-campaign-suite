// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PartyMarkerLayer from './PartyMarkerLayer.jsx';

vi.mock('../../services/maps/hexMapUtils.js', () => ({
    hexToPixel: vi.fn((q, r, size) => ({
        x: size * Math.sqrt(3) * (q + r / 2),
        y: size * 3 / 2 * r,
    })),
    pixelToHexSnapped: vi.fn((x, y, size) => ({
        q: Math.round(x / (size * Math.sqrt(3))),
        r: Math.round((2 / 3 * y) / size),
    })),
    hexToSVGPath: vi.fn((cx, cy, _size) => `M${cx},${cy} Z`),
}));

const defaultProps = {
    position: { q: 0, r: 0 },
    HEX_SIZE: 30,
    hexCols: 10,
    hexRows: 10,
    onPositionChange: vi.fn(),
    onEncounter: vi.fn(),
    onAdvance: vi.fn(),
    onCancelTravel: vi.fn(),
    travelMode: 'inactive',
    svgRef: { current: null },
    contextMenuOpen: false,
    onContextMenu: vi.fn(),
};

function renderMarker(overrideProps = {}) {
    return render(<PartyMarkerLayer {...defaultProps} {...overrideProps} />);
}

describe('PartyMarkerLayer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('null/undefined position', () => {
        it('should return null when position is null', () => {
            const { container } = renderMarker({ position: null });
            expect(container.querySelector('g.party-marker-layer')).not.toBeInTheDocument();
        });

        it('should render the party marker group when position is defined', () => {
            const { container } = renderMarker({ position: { q: 5, r: 3 } });
            expect(container.querySelector('g.party-marker-layer')).toBeInTheDocument();
            expect(container.querySelector('path')).toBeInTheDocument();
            expect(screen.getByText('P')).toBeInTheDocument();
        });
    });

    describe('context menu visibility', () => {
        it('should not render context menu when contextMenuOpen is false', () => {
            renderMarker({ contextMenuOpen: false });
            expect(screen.queryByText('Start Encounter')).not.toBeInTheDocument();
        });

        it('should render encounter menu when contextMenuOpen is true and travelMode is inactive', () => {
            renderMarker({ contextMenuOpen: true, travelMode: 'inactive' });
            expect(screen.getByText('Start Encounter')).toBeInTheDocument();
        });

        it('should render travel menu when contextMenuOpen is true and travelMode is active', () => {
            renderMarker({ contextMenuOpen: true, travelMode: 'active' });
            expect(screen.getByText('Advance One Hex')).toBeInTheDocument();
            expect(screen.getByText('Cancel Travel')).toBeInTheDocument();
            expect(screen.queryByText('Start Encounter')).not.toBeInTheDocument();
        });
    });

    describe('context menu interactions', () => {
        it('should call onContextMenu on right-click of marker', () => {
            const { container } = renderMarker({ contextMenuOpen: true });
            const path = container.querySelector('path');
            fireEvent.contextMenu(path, { preventDefault: () => {}, stopPropagation: () => {} });
            expect(defaultProps.onContextMenu).toHaveBeenCalledWith(0, 0);
        });

        it('should call onEncounter when Start Encounter is clicked', () => {
            renderMarker({ contextMenuOpen: true, travelMode: 'inactive' });
            const hitRects = document.querySelectorAll('.party-menu-hit');
            fireEvent.click(hitRects[0]);
            expect(defaultProps.onEncounter).toHaveBeenCalledWith(0, 0);
        });

        it('should call onAdvance when Advance One Hex is clicked', () => {
            renderMarker({ contextMenuOpen: true, travelMode: 'active' });
            const hitRects = document.querySelectorAll('.party-menu-hit');
            fireEvent.click(hitRects[0]);
            expect(defaultProps.onAdvance).toHaveBeenCalled();
        });

        it('should call onCancelTravel when Cancel Travel is clicked', () => {
            renderMarker({ contextMenuOpen: true, travelMode: 'active' });
            const hitRects = document.querySelectorAll('.party-menu-hit');
            fireEvent.click(hitRects[1]);
            expect(defaultProps.onCancelTravel).toHaveBeenCalled();
        });
    });

    describe('dragging behavior', () => {
        function createMockSvg() {
            return {
                current: {
                    createSVGPoint: vi.fn(() => ({
                        matrixTransform: vi.fn(() => ({ x: 10, y: 10 })),
                    })),
                    getScreenCTM: vi.fn(() => ({
                        inverse: vi.fn(() => null),
                    })),
                },
            };
        }

        it('should call onPositionChange when dragging the marker', () => {
            const mockSvg = createMockSvg();
            renderMarker({ svgRef: mockSvg });
            const path = document.querySelector('path');
            fireEvent.pointerDown(path, { button: 0, clientX: 100, clientY: 100 });
            fireEvent.pointerMove(document, { clientX: 100, clientY: 100 });
            expect(defaultProps.onPositionChange).toHaveBeenCalled();
        });

        it('should not start dragging on right-click', () => {
            const mockSvg = createMockSvg();
            renderMarker({ svgRef: mockSvg });
            const path = document.querySelector('path');
            fireEvent.pointerDown(path, { button: 2, clientX: 100, clientY: 100 });
            expect(defaultProps.onPositionChange).not.toHaveBeenCalled();
        });

        it('should disable dragging when travelMode is active', () => {
            const mockSvg = createMockSvg();
            renderMarker({ svgRef: mockSvg, travelMode: 'active' });
            const path = document.querySelector('path');
            fireEvent.pointerDown(path, { button: 0, clientX: 100, clientY: 100 });
            expect(defaultProps.onPositionChange).not.toHaveBeenCalled();
        });
    });
});
