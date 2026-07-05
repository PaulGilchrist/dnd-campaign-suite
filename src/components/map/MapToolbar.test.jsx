// @cleaned-by-ai
import { render, screen, fireEvent, within } from '@testing-library/react';
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
        onBack: vi.fn(),
        rulerMode: false,
        setRulerMode: vi.fn(),
        spellOverlayState: createMockSpellOverlayState(),
        ...props,
    };
    return render(<MapToolbar {...defaultProps} />);
};

describe('MapToolbar', () => {
    describe('rendering', () => {
        it('should render the map name formatted correctly', () => {
            renderMapToolbar();
            expect(screen.getByText('Dungeon Map')).toBeInTheDocument();
        });

        it('should render without onBack button when onBack is not provided', () => {
            renderMapToolbar({ onBack: undefined, isLocalhost: false });
            expect(screen.queryByTitle('Back')).not.toBeInTheDocument();
        });

        it('should render back button when onBack is provided', () => {
            renderMapToolbar();
            expect(screen.getByTitle('Back')).toBeInTheDocument();
        });

        it('should render grid size input with correct attributes when isLocalhost is true', () => {
            renderMapToolbar({ isLocalhost: true });
            const gridInput = screen.getByRole('spinbutton');
            expect(gridInput).toBeInTheDocument();
            expect(gridInput).toHaveValue(5);
            expect(gridInput).toHaveAttribute('min', '5');
            expect(gridInput).toHaveAttribute('max', '100');
        });

        it('should not render grid size input or label when isLocalhost is false', () => {
            renderMapToolbar({ isLocalhost: false });
            expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
            expect(screen.queryByText('Grid Size')).not.toBeInTheDocument();
        });

        it('should render localhost-specific tools when isLocalhost is true', () => {
            renderMapToolbar({ isLocalhost: true });
            expect(screen.getByText('Paint')).toBeInTheDocument();
            expect(screen.getByText('Erase')).toBeInTheDocument();
            expect(screen.getByText('Select')).toBeInTheDocument();
            expect(screen.getByText('Room')).toBeInTheDocument();
            expect(screen.getByText('Items')).toBeInTheDocument();
        });

        it('should not render localhost-specific tools when isLocalhost is false', () => {
            renderMapToolbar({ isLocalhost: false });
            expect(screen.queryByText('Paint')).not.toBeInTheDocument();
            expect(screen.queryByText('Erase')).not.toBeInTheDocument();
            expect(screen.queryByText('Select')).not.toBeInTheDocument();
            expect(screen.queryByText('Room')).not.toBeInTheDocument();
            expect(screen.queryByText('Items')).not.toBeInTheDocument();
        });

        it('should render Spell and Ruler buttons', () => {
            renderMapToolbar();
            expect(screen.getByText('Spell')).toBeInTheDocument();
            expect(screen.getByText('Ruler')).toBeInTheDocument();
        });

        it('should render SpellOverlayControls when spellMode is active', () => {
            const mockState = createMockSpellOverlayState({ spellMode: 'sphere' });
            renderMapToolbar({ spellOverlayState: mockState });
            expect(screen.getByText('Spell Overlay')).toBeInTheDocument();
        });

        it('should render ruler hint with icon when rulerMode is true', () => {
            renderMapToolbar({ rulerMode: true });
            expect(screen.getByText('Click two points to measure distance')).toBeInTheDocument();
        });
    });

    describe('tool button active states', () => {
        it('should apply active class to tool buttons when their tool is active', () => {
            const tools = ['paint', 'erase', 'select', 'room'];
            for (const tool of tools) {
                const { container } = renderMapToolbar({ tool });
                const btn = within(container).getByText(tool.charAt(0).toUpperCase() + tool.slice(1));
                expect(btn).toHaveClass('active');
            }
        });

        it('should not apply active class when tool is none', () => {
            renderMapToolbar({ tool: 'none' });
            expect(screen.getByText('Paint')).not.toHaveClass('active');
        });

        it('should apply active class to spell button when spellMode is set', () => {
            const mockState = createMockSpellOverlayState({ spellMode: 'sphere' });
            renderMapToolbar({ spellOverlayState: mockState });
            expect(screen.getByText('Spell')).toHaveClass('active');
        });

        it('should apply active class to ruler button when rulerMode is true', () => {
            renderMapToolbar({ rulerMode: true });
            expect(screen.getByText('Ruler')).toHaveClass('active');
        });
    });

    describe('spell overlay controls integration', () => {
        it('should call setSelectedShape and setSpellMode when shape is changed in SpellOverlayControls', () => {
            const mockSetSelectedShape = vi.fn();
            const mockSetSpellMode = vi.fn();
            const mockState = createMockSpellOverlayState({
                spellMode: 'sphere',
                setSelectedShape: mockSetSelectedShape,
                setSpellMode: mockSetSpellMode,
            });
            renderMapToolbar({ spellOverlayState: mockState });
            const select = screen.getByRole('combobox');
            fireEvent.change(select, { target: { value: 'cone' } });
            expect(mockSetSelectedShape).toHaveBeenCalledWith('cone');
            expect(mockSetSpellMode).toHaveBeenCalledWith('cone');
        });
    });

    describe('user interactions', () => {
        it('should call onBack when back button is clicked', () => {
            const mockOnBack = vi.fn();
            renderMapToolbar({ onBack: mockOnBack });
            fireEvent.click(screen.getByTitle('Back'));
            expect(mockOnBack).toHaveBeenCalledTimes(1);
        });

        it('should call zoomIn when zoom in button is clicked', () => {
            const mockZoomIn = vi.fn();
            renderMapToolbar({ zoomIn: mockZoomIn });
            const buttons = screen.getAllByRole('button');
            const zoomInBtn = buttons.find(btn =>
                btn.querySelector('i.fa-solid.fa-magnifying-glass-plus')
            );
            fireEvent.click(zoomInBtn);
            expect(mockZoomIn).toHaveBeenCalledTimes(1);
        });

        it('should call zoomOut when zoom out button is clicked', () => {
            const mockZoomOut = vi.fn();
            renderMapToolbar({ zoomOut: mockZoomOut });
            const buttons = screen.getAllByRole('button');
            const zoomOutBtn = buttons.find(btn =>
                btn.querySelector('i.fa-solid.fa-magnifying-glass-minus')
            );
            fireEvent.click(zoomOutBtn);
            expect(mockZoomOut).toHaveBeenCalledTimes(1);
        });

        it('should call resetView when reset view button is clicked', () => {
            const mockResetView = vi.fn();
            renderMapToolbar({ resetView: mockResetView });
            fireEvent.click(screen.getByText('Reset View'));
            expect(mockResetView).toHaveBeenCalledTimes(1);
        });

        it('should call setItemsPanelOpen when items button is clicked', () => {
            const mockSetItemsPanelOpen = vi.fn();
            renderMapToolbar({ setItemsPanelOpen: mockSetItemsPanelOpen });
            fireEvent.click(screen.getByText('Items'));
            expect(mockSetItemsPanelOpen).toHaveBeenCalled();
        });

        it('should toggle ruler mode on when clicked while false, off when clicked while true', () => {
            const toggleRulerMode = vi.fn();
            const { container } = renderMapToolbar({ rulerMode: false, setRulerMode: toggleRulerMode });
            fireEvent.click(within(container).getByText('Ruler'));
            expect(toggleRulerMode).toHaveBeenCalledWith(true);
        });

        it('should toggle ruler mode off when clicked while true', () => {
            const toggleRulerMode = vi.fn();
            const { container } = renderMapToolbar({ rulerMode: true, setRulerMode: toggleRulerMode });
            fireEvent.click(within(container).getByText('Ruler'));
            expect(toggleRulerMode).toHaveBeenCalledWith(false);
        });

        it('should deactivate spell mode when spell button clicked with active spellMode', () => {
            const mockSetSpellMode = vi.fn();
            const mockState = createMockSpellOverlayState({
                spellMode: 'sphere',
                setSpellMode: mockSetSpellMode,
            });
            renderMapToolbar({ spellOverlayState: mockState });
            fireEvent.click(screen.getByText('Spell'));
            expect(mockSetSpellMode).toHaveBeenCalledWith(null);
        });

        it('should activate spell mode when spell button clicked with no active spellMode', () => {
            const mockSetSpellMode = vi.fn();
            const mockSetTool = vi.fn();
            const mockState = createMockSpellOverlayState({
                spellMode: null,
                setSpellMode: mockSetSpellMode,
            });
            renderMapToolbar({
                spellOverlayState: mockState,
                setTool: mockSetTool,
            });
            fireEvent.click(screen.getByText('Spell'));
            expect(mockSetTool).toHaveBeenCalledWith('none');
            expect(mockSetSpellMode).toHaveBeenCalledWith('sphere');
        });

        it('should activate spell mode with selectedShape when spell button clicked', () => {
            const mockSetSpellMode = vi.fn();
            const mockSetTool = vi.fn();
            const mockState = createMockSpellOverlayState({
                spellMode: null,
                setSpellMode: mockSetSpellMode,
                selectedShape: 'cone',
            });
            renderMapToolbar({
                spellOverlayState: mockState,
                setTool: mockSetTool,
            });
            fireEvent.click(screen.getByText('Spell'));
            expect(mockSetSpellMode).toHaveBeenCalledWith('cone');
        });

        it('should toggle paint, erase, select, and room tools on and off when clicked', () => {
            const tools = ['paint', 'erase', 'select', 'room'];
            for (const tool of tools) {
                const mockSetTool = vi.fn();
                const { container: c1 } = renderMapToolbar({ tool, setTool: mockSetTool });
                fireEvent.click(within(c1).getByText(tool.charAt(0).toUpperCase() + tool.slice(1)));
                expect(mockSetTool).toHaveBeenCalledWith('none');
                const { container: c2 } = renderMapToolbar({ tool: 'none', setTool: mockSetTool });
                fireEvent.click(within(c2).getByText(tool.charAt(0).toUpperCase() + tool.slice(1)));
                expect(mockSetTool).toHaveBeenCalledWith(tool);
            }
        });
    });
});
