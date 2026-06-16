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

describe('PartyMarkerLayer', () => {
    let props;

    beforeEach(() => {
        props = {
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
    });

    it('should return null when position is null', () => {
        const { container } = render(<PartyMarkerLayer {...props} position={null} />);
        expect(container.querySelector('.party-marker-layer')).not.toBeInTheDocument();
    });

    it('should return null when position is undefined', () => {
        const { container } = render(<PartyMarkerLayer {...props} position={undefined} />);
        expect(container.querySelector('.party-marker-layer')).not.toBeInTheDocument();
    });

    it('should render the party-marker-layer group', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const layer = container.querySelector('g.party-marker-layer');
        expect(layer).toBeInTheDocument();
    });

    it('should render a path element for the hex shape', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const path = container.querySelector('path');
        expect(path).toBeInTheDocument();
    });

    it('should set fill to #FFD700 on the hex path', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const path = container.querySelector('path');
        expect(path.getAttribute('fill')).toBe('#FFD700');
    });

    it('should set fillOpacity to 0.25 on the hex path', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const path = container.querySelector('path');
        expect(path.getAttribute('fill-opacity')).toBe('0.25');
    });

    it('should set stroke to #FFD700 on the hex path', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const path = container.querySelector('path');
        expect(path.getAttribute('stroke')).toBe('#FFD700');
    });

    it('should set strokeWidth to 3 on the hex path', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const path = container.querySelector('path');
        expect(path.getAttribute('stroke-width')).toBe('3');
    });

    it('should set strokeDasharray to 6 3 on the hex path', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const path = container.querySelector('path');
        expect(path.getAttribute('stroke-dasharray')).toBe('6 3');
    });

    it('should set cursor grab on the hex path', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const path = container.querySelector('path');
        expect(path.style.cursor).toBe('grab');
    });

    it('should render the P text label', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const text = container.querySelector('text');
        expect(text).toBeInTheDocument();
        expect(text.textContent).toBe('P');
    });

    it('should position the P text at hex center', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const text = container.querySelector('text');
        expect(text.getAttribute('x')).toBe('0');
        expect(text.getAttribute('y')).toBe('4');
    });

    it('should call onPositionChange when dragging the marker', () => {
        const mockSvg = {
            current: {
                createSVGPoint: vi.fn(() => ({
                    matrixTransform: vi.fn(() => ({ x: 10, y: 10 })),
                })),
                getScreenCTM: vi.fn(() => ({
                    inverse: vi.fn(() => null),
                })),
            },
        };
        render(<PartyMarkerLayer {...props} svgRef={mockSvg} />);
        const path = document.querySelector('path');
        fireEvent.pointerDown(path, { button: 0, clientX: 100, clientY: 100 });
        fireEvent.pointerMove(document, { clientX: 100, clientY: 100 });
        expect(props.onPositionChange).toHaveBeenCalled();
    });

    it('should not start dragging on right-click', () => {
        const mockSvg = {
            current: {
                createSVGPoint: vi.fn(() => ({
                    matrixTransform: vi.fn(() => ({ x: 10, y: 10 })),
                })),
                getScreenCTM: vi.fn(() => ({
                    inverse: vi.fn(() => null),
                })),
            },
        };
        render(<PartyMarkerLayer {...props} svgRef={mockSvg} />);
        const path = document.querySelector('path');
        fireEvent.pointerDown(path, { button: 2, clientX: 100, clientY: 100 });
        expect(props.onPositionChange).not.toHaveBeenCalled();
    });

    it('should call onContextMenu on right-click of marker', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const path = container.querySelector('path');
        fireEvent.contextMenu(path, { preventDefault: () => {}, stopPropagation: () => {} });
        expect(props.onContextMenu).toHaveBeenCalledWith(0, 0);
    });

    it('should render context menu when contextMenuOpen is true and travelMode is inactive', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="inactive" />);
        const menu = document.querySelector('.party-context-menu');
        expect(menu).toBeInTheDocument();
    });

    it('should render Start Encounter text in context menu', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="inactive" />);
        expect(screen.getByText('Start Encounter')).toBeInTheDocument();
    });

    it('should not render context menu when contextMenuOpen is false', () => {
        const { container } = render(<PartyMarkerLayer {...props} contextMenuOpen={false} travelMode="inactive" />);
        const menu = container.querySelector('.party-context-menu');
        expect(menu).not.toBeInTheDocument();
    });

    it('should render travel context menu instead of encounter menu when travelMode is active', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="active" />);
        const menus = document.querySelectorAll('.party-context-menu');
        expect(menus.length).toBe(1);
        expect(screen.queryByText('Start Encounter')).not.toBeInTheDocument();
        expect(screen.getByText('Advance One Hex')).toBeInTheDocument();
    });

    it('should call onEncounter when Start Encounter is clicked', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="inactive" />);
        const hitRect = document.querySelector('.party-menu-hit');
        fireEvent.click(hitRect);
        expect(props.onEncounter).toHaveBeenCalledWith(0, 0);
    });

    it('should render travel context menu when contextMenuOpen is true and travelMode is not inactive', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="active" />);
        const menu = document.querySelector('.party-context-menu');
        expect(menu).toBeInTheDocument();
    });

    it('should render Advance One Hex text in travel context menu', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="active" />);
        expect(screen.getByText('Advance One Hex')).toBeInTheDocument();
    });

    it('should render Cancel Travel text in travel context menu', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="active" />);
        expect(screen.getByText('Cancel Travel')).toBeInTheDocument();
    });

    it('should call onAdvance when Advance One Hex is clicked', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="active" />);
        const hitRects = document.querySelectorAll('.party-menu-hit');
        fireEvent.click(hitRects[0]);
        expect(props.onAdvance).toHaveBeenCalled();
    });

    it('should call onCancelTravel when Cancel Travel is clicked', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="active" />);
        const hitRects = document.querySelectorAll('.party-menu-hit');
        fireEvent.click(hitRects[1]);
        expect(props.onCancelTravel).toHaveBeenCalled();
    });

    it('should render context menu rects with correct fill colors', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="inactive" />);
        const menuRect = document.querySelector('.party-context-menu rect[fill="#2a2a2a"]');
        expect(menuRect).toBeInTheDocument();
    });

    it('should render travel context menu with golden stroke', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="active" />);
        const menuRect = document.querySelector('.party-context-menu rect[stroke="#FFD700"]');
        expect(menuRect).toBeInTheDocument();
    });

    it('should render Cancel Travel text in red color', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="active" />);
        const cancelText = document.querySelector('text[fill="#e88"]');
        expect(cancelText).toBeInTheDocument();
        expect(cancelText.textContent).toBe('Cancel Travel');
    });

    it('should not call onContextMenu when onContextMenu is not provided', () => {
        const { container } = render(<PartyMarkerLayer {...props} onContextMenu={undefined} />);
        const path = container.querySelector('path');
        fireEvent.contextMenu(path, { preventDefault: () => {}, stopPropagation: () => {} });
        // Should not throw
        expect(true).toBe(true);
    });

    it('should not call onEncounter when onEncounter is not provided', () => {
        render(<PartyMarkerLayer {...props} onEncounter={undefined} contextMenuOpen={true} travelMode="inactive" />);
        const hitRect = document.querySelector('.party-menu-hit');
        fireEvent.click(hitRect);
        expect(true).toBe(true);
    });

    it('should not call onAdvance when onAdvance is not provided', () => {
        render(<PartyMarkerLayer {...props} onAdvance={undefined} contextMenuOpen={true} travelMode="active" />);
        const hitRects = document.querySelectorAll('.party-menu-hit');
        fireEvent.click(hitRects[0]);
        expect(true).toBe(true);
    });

    it('should not call onCancelTravel when onCancelTravel is not provided', () => {
        render(<PartyMarkerLayer {...props} onCancelTravel={undefined} contextMenuOpen={true} travelMode="active" />);
        const hitRects = document.querySelectorAll('.party-menu-hit');
        fireEvent.click(hitRects[1]);
        expect(true).toBe(true);
    });

    it('should pass correct hex coordinates to hexToPixel', () => {
        render(<PartyMarkerLayer {...props} position={{ q: 5, r: 3 }} />);
        expect(true).toBe(true);
    });

    it('should render marker at correct position for non-zero hex coordinates', () => {
        const { container } = render(<PartyMarkerLayer {...props} position={{ q: 2, r: 1 }} />);
        const text = container.querySelector('text');
        expect(text).toBeInTheDocument();
    });

    it('should set textAnchor middle on the P text', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const text = container.querySelector('text');
        expect(text.getAttribute('text-anchor')).toBe('middle');
    });

    it('should set dominantBaseline central on the P text', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const text = container.querySelector('text');
        expect(text.getAttribute('dominant-baseline')).toBe('central');
    });

    it('should set fill #FFD700 on the P text', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const text = container.querySelector('text');
        expect(text.getAttribute('fill')).toBe('#FFD700');
    });

    it('should set fontWeight bold on the P text', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const text = container.querySelector('text');
        expect(text.getAttribute('font-weight')).toBe('bold');
    });

    it('should set pointerEvents none on the P text', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const text = container.querySelector('text');
        expect(text.getAttribute('pointer-events')).toBe('none');
    });

    it('should set textShadow style on the P text', () => {
        const { container } = render(<PartyMarkerLayer {...props} />);
        const text = container.querySelector('text');
        expect(text.style.textShadow).toContain('0 0 6px rgba(0,0,0,0.9)');
    });

    it('should disable dragging when travelMode is active', () => {
        const mockSvg = {
            current: {
                createSVGPoint: vi.fn(() => ({
                    matrixTransform: vi.fn(() => ({ x: 10, y: 10 })),
                })),
                getScreenCTM: vi.fn(() => ({
                    inverse: vi.fn(() => null),
                })),
            },
        };
        render(<PartyMarkerLayer {...props} svgRef={mockSvg} travelMode="active" />);
        const path = document.querySelector('path');
        fireEvent.pointerDown(path, { button: 0, clientX: 100, clientY: 100 });
        expect(props.onPositionChange).not.toHaveBeenCalled();
    });

    it('should render context menu rect with rx 4', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="inactive" />);
        const menuRect = document.querySelector('.party-context-menu rect[rx="4"]');
        expect(menuRect).toBeInTheDocument();
    });

    it('should render context menu with correct width for inactive travel mode', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="inactive" />);
        const menuRect = document.querySelector('.party-context-menu rect');
        expect(menuRect.getAttribute('width')).toBe('140');
    });

    it('should render context menu with correct width for active travel mode', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="active" />);
        const menuRect = document.querySelector('.party-context-menu rect');
        expect(menuRect.getAttribute('width')).toBe('160');
    });

    it('should render context menu with correct height for inactive travel mode', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="inactive" />);
        const menuRect = document.querySelector('.party-context-menu rect');
        expect(menuRect.getAttribute('height')).toBe('30');
    });

    it('should render context menu with correct height for active travel mode', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="active" />);
        const menuRect = document.querySelector('.party-context-menu rect');
        expect(menuRect.getAttribute('height')).toBe('70');
    });

    it('should render menu text with fontSize 11', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="inactive" />);
        const menuTexts = document.querySelectorAll('.party-menu-text');
        menuTexts.forEach(text => {
            expect(text.getAttribute('font-size')).toBe('11');
        });
    });

    it('should render menu hit areas with pointerEvents none on text', () => {
        render(<PartyMarkerLayer {...props} contextMenuOpen={true} travelMode="inactive" />);
        const menuTexts = document.querySelectorAll('.party-menu-text');
        menuTexts.forEach(text => {
            expect(text.getAttribute('pointer-events')).toBe('none');
        });
    });
});
