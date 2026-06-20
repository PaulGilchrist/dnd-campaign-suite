// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as hexMapUtils from '../../services/maps/hexMapUtils.js';
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

        it('should return null when position is undefined', () => {
            const { container } = renderMarker({ position: undefined });
            expect(container.querySelector('g.party-marker-layer')).not.toBeInTheDocument();
        });
    });

    describe('rendering', () => {
        it('should render the party-marker-layer group', () => {
            const { container } = renderMarker();
            expect(container.querySelector('g.party-marker-layer')).toBeInTheDocument();
        });

        it('should render a path element for the hex shape', () => {
            const { container } = renderMarker();
            expect(container.querySelector('path')).toBeInTheDocument();
        });

        it('should render the P text label', () => {
            renderMarker();
            expect(screen.getByText('P')).toBeInTheDocument();
        });

        it('should render the P text at the hex center position', () => {
            const { container } = renderMarker();
            const text = container.querySelector('text');
            expect(text.getAttribute('x')).toBe('0');
            expect(text.getAttribute('y')).toBe('4');
        });

        it('should pass hex coordinates to hexToPixel', () => {
            renderMarker({ position: { q: 5, r: 3 } });
            expect(hexMapUtils.hexToPixel).toHaveBeenCalledWith(5, 3, 30);
        });

        it('should render marker at correct pixel position for non-zero hex coordinates', () => {
            const size = 30;
            const q = 2;
            const r = 1;
            const expectedX = size * Math.sqrt(3) * (q + r / 2);
            const expectedY = size * 3 / 2 * r;
            const { container } = renderMarker({ position: { q, r } });
            const text = container.querySelector('text');
            expect(parseFloat(text.getAttribute('x'))).toBeCloseTo(expectedX);
            expect(parseFloat(text.getAttribute('y'))).toBeCloseTo(expectedY + 4);
        });
    });

    describe('context menu rendering', () => {
        it('should not render context menu when contextMenuOpen is false', () => {
            renderMarker({ contextMenuOpen: false, travelMode: 'inactive' });
            expect(screen.queryByText('Start Encounter')).not.toBeInTheDocument();
        });

        it('should render encounter menu when contextMenuOpen is true and travelMode is inactive', () => {
            renderMarker({ contextMenuOpen: true, travelMode: 'inactive' });
            expect(screen.getByText('Start Encounter')).toBeInTheDocument();
        });

        it('should render travel menu when contextMenuOpen is true and travelMode is not inactive', () => {
            renderMarker({ contextMenuOpen: true, travelMode: 'active' });
            expect(screen.getByText('Advance One Hex')).toBeInTheDocument();
            expect(screen.getByText('Cancel Travel')).toBeInTheDocument();
            expect(screen.queryByText('Start Encounter')).not.toBeInTheDocument();
        });

        it('should not render context menu when travelMode is active even if contextMenuOpen is true', () => {
            // travelMode='active' with contextMenuOpen shows travel menu, not encounter menu
            renderMarker({ contextMenuOpen: true, travelMode: 'active' });
            expect(screen.queryByText('Start Encounter')).not.toBeInTheDocument();
            expect(screen.getByText('Advance One Hex')).toBeInTheDocument();
        });
    });

    describe('context menu callbacks', () => {
        it('should call onContextMenu on right-click of marker', () => {
            const { container } = renderMarker({ contextMenuOpen: true });
            const path = container.querySelector('path');
            fireEvent.contextMenu(path, { preventDefault: () => {}, stopPropagation: () => {} });
            expect(defaultProps.onContextMenu).toHaveBeenCalledWith(0, 0);
        });

        it('should call onEncounter when Start Encounter is clicked', () => {
            renderMarker({ contextMenuOpen: true, travelMode: 'inactive' });
            const allRects = document.querySelectorAll('.party-menu-hit');
            fireEvent.click(allRects[0]);
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

    describe('callback safety with missing handlers', () => {
        it('should not throw when onContextMenu is not provided', () => {
            const { container } = renderMarker({ onContextMenu: undefined });
            const path = container.querySelector('path');
            expect(() => {
                fireEvent.contextMenu(path, { preventDefault: () => {}, stopPropagation: () => {} });
            }).not.toThrow();
        });

        it('should not throw when onEncounter is not provided', () => {
            renderMarker({ onEncounter: undefined, contextMenuOpen: true, travelMode: 'inactive' });
            const hitRect = document.querySelector('.party-menu-hit');
            expect(() => {
                fireEvent.click(hitRect);
            }).not.toThrow();
        });

        it('should not throw when onAdvance is not provided', () => {
            renderMarker({ onAdvance: undefined, contextMenuOpen: true, travelMode: 'active' });
            const hitRects = document.querySelectorAll('.party-menu-hit');
            expect(() => {
                fireEvent.click(hitRects[0]);
            }).not.toThrow();
        });

        it('should not throw when onCancelTravel is not provided', () => {
            renderMarker({ onCancelTravel: undefined, contextMenuOpen: true, travelMode: 'active' });
            const hitRects = document.querySelectorAll('.party-menu-hit');
            expect(() => {
                fireEvent.click(hitRects[1]);
            }).not.toThrow();
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
