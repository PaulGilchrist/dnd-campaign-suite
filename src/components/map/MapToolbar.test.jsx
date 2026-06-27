// @improved-by-ai
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

        it('should render formatted map name from kebab-case', () => {
            renderMapToolbar({ mapName: 'boss-room-1.json' });
            expect(screen.getByText('Boss Room 1')).toBeInTheDocument();
        });

        it('should render "Map" when mapName is empty', () => {
            renderMapToolbar({ mapName: '' });
            expect(screen.getByText('Map')).toBeInTheDocument();
        });

        it('should render "Map" when mapName is null', () => {
            renderMapToolbar({ mapName: null });
            expect(screen.getByText('Map')).toBeInTheDocument();
        });

        it('should render without onBack button when onBack is not provided', () => {
            renderMapToolbar({ onBack: undefined, isLocalhost: false });
            expect(screen.queryByTitle('Back')).not.toBeInTheDocument();
        });

        it('should render back button when onBack is provided', () => {
            renderMapToolbar();
            const backBtn = screen.getByTitle('Back');
            expect(backBtn).toBeInTheDocument();
            expect(backBtn.querySelector('i.fa-solid.fa-arrow-left')).toBeInTheDocument();
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
        });

        it('should not render localhost-specific tools when isLocalhost is false', () => {
            renderMapToolbar({ isLocalhost: false });
            expect(screen.queryByText('Paint')).not.toBeInTheDocument();
            expect(screen.queryByText('Erase')).not.toBeInTheDocument();
            expect(screen.queryByText('Select')).not.toBeInTheDocument();
            expect(screen.queryByText('Room')).not.toBeInTheDocument();
        });

        it('should render Items button when isLocalhost is true', () => {
            renderMapToolbar({ isLocalhost: true });
            expect(screen.getByText('Items')).toBeInTheDocument();
        });

        it('should not render Items button when isLocalhost is false', () => {
            renderMapToolbar({ isLocalhost: false });
            expect(screen.queryByText('Items')).not.toBeInTheDocument();
        });

        it('should always render Spell and Ruler buttons', () => {
            renderMapToolbar();
            expect(screen.getByText('Spell')).toBeInTheDocument();
            expect(screen.getByText('Ruler')).toBeInTheDocument();
        });

        it('should render zoom and reset view buttons', () => {
            renderMapToolbar();
            expect(screen.getByText('Reset View')).toBeInTheDocument();
        });

        it('should render SpellOverlayControls when spellMode is active', () => {
            const mockState = createMockSpellOverlayState({ spellMode: 'sphere' });
            renderMapToolbar({ spellOverlayState: mockState });
            expect(screen.getByText('Spell Overlay')).toBeInTheDocument();
        });

        it('should not render SpellOverlayControls when spellMode is null', () => {
            renderMapToolbar();
            expect(screen.queryByText('Spell Overlay')).not.toBeInTheDocument();
        });

        it('should render ruler hint with icon when rulerMode is true', () => {
            renderMapToolbar({ rulerMode: true });
            const rulerHint = screen.getByText('Click two points to measure distance');
            expect(rulerHint).toBeInTheDocument();
            expect(rulerHint.querySelector('i.fa-solid.fa-ruler')).toBeInTheDocument();
        });

        it('should not render ruler hint when rulerMode is false', () => {
            renderMapToolbar();
            expect(screen.queryByText('Click two points to measure distance')).not.toBeInTheDocument();
        });
    });

    describe('button icons', () => {
        it('should render Spell button with wand icon', () => {
            renderMapToolbar();
            const spellBtn = screen.getByText('Spell');
            expect(spellBtn.querySelector('i.fa-solid.fa-wand-magic-sparkles')).toBeInTheDocument();
        });

        it('should render Ruler button with ruler icon', () => {
            renderMapToolbar();
            const rulerBtn = screen.getByText('Ruler');
            expect(rulerBtn.querySelector('i.fa-solid.fa-ruler')).toBeInTheDocument();
        });

        it('should render zoom in button with magnifying glass plus icon', () => {
            renderMapToolbar();
            const buttons = screen.getAllByRole('button');
            const zoomInBtn = buttons.find(btn =>
                btn.querySelector('i.fa-solid.fa-magnifying-glass-plus')
            );
            expect(zoomInBtn).toBeInTheDocument();
        });

        it('should render zoom out button with magnifying glass minus icon', () => {
            renderMapToolbar();
            const buttons = screen.getAllByRole('button');
            const zoomOutBtn = buttons.find(btn =>
                btn.querySelector('i.fa-solid.fa-magnifying-glass-minus')
            );
            expect(zoomOutBtn).toBeInTheDocument();
        });

        it('should render reset view button with rotate icon', () => {
            renderMapToolbar();
            const resetBtn = screen.getByText('Reset View');
            expect(resetBtn.querySelector('i.fa-solid.fa-rotate-left')).toBeInTheDocument();
        });
    });

    describe('tool button active states', () => {
        it('should apply active class to paint button when tool is paint', () => {
            renderMapToolbar({ tool: 'paint' });
            expect(screen.getByText('Paint')).toHaveClass('active');
        });

        it('should apply active class to erase button when tool is erase', () => {
            renderMapToolbar({ tool: 'erase' });
            expect(screen.getByText('Erase')).toHaveClass('active');
        });

        it('should apply active class to select button when tool is select', () => {
            renderMapToolbar({ tool: 'select' });
            expect(screen.getByText('Select')).toHaveClass('active');
        });

        it('should apply active class to room button when tool is room', () => {
            renderMapToolbar({ tool: 'room' });
            expect(screen.getByText('Room')).toHaveClass('active');
        });

        it('should not apply active class when tool is none', () => {
            renderMapToolbar({ tool: 'none' });
            expect(screen.getByText('Paint')).not.toHaveClass('active');
        });
    });

    describe('spell and ruler button active states', () => {
        it('should apply active class to spell button when spellMode is set', () => {
            const mockState = createMockSpellOverlayState({ spellMode: 'sphere' });
            renderMapToolbar({ spellOverlayState: mockState });
            expect(screen.getByText('Spell')).toHaveClass('active');
        });

        it('should not apply active class to spell button when spellMode is null', () => {
            renderMapToolbar();
            expect(screen.getByText('Spell')).not.toHaveClass('active');
        });

        it('should apply active class to ruler button when rulerMode is true', () => {
            renderMapToolbar({ rulerMode: true });
            expect(screen.getByText('Ruler')).toHaveClass('active');
        });

        it('should not apply active class to ruler button when rulerMode is false', () => {
            renderMapToolbar({ rulerMode: false });
            expect(screen.getByText('Ruler')).not.toHaveClass('active');
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

        it('should not render SpellOverlayControls when spellMode is undefined', () => {
            const mockState = createMockSpellOverlayState({ spellMode: undefined });
            renderMapToolbar({ spellOverlayState: mockState });
            expect(screen.queryByText('Spell Overlay')).not.toBeInTheDocument();
        });

        it('should render without crashing when spellOverlayState is null', () => {
            renderMapToolbar({ spellOverlayState: null });
            expect(screen.getByText('Dungeon Map')).toBeInTheDocument();
        });

        it('should render without crashing when spellOverlayState is undefined', () => {
            renderMapToolbar({ spellOverlayState: undefined });
            expect(screen.getByText('Dungeon Map')).toBeInTheDocument();
        });
    });

    describe('user interactions', () => {
        it('should call onBack when back button is clicked', () => {
            const mockOnBack = vi.fn();
            renderMapToolbar({ onBack: mockOnBack });
            fireEvent.click(screen.getByTitle('Back'));
            expect(mockOnBack).toHaveBeenCalledTimes(1);
        });

        it('should call setGridSize with new value when grid input changes', () => {
            const mockSetGridSize = vi.fn();
            renderMapToolbar({ setGridSize: mockSetGridSize, gridSize: 10 });
            const gridInput = screen.getByRole('spinbutton');
            fireEvent.change(gridInput, { target: { value: '15' } });
            expect(mockSetGridSize).toHaveBeenCalledWith(15);
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

        it('should toggle ruler mode on when clicked while false', () => {
            const toggleRulerMode = vi.fn();
            renderMapToolbar({ rulerMode: false, setRulerMode: toggleRulerMode });
            fireEvent.click(screen.getByText('Ruler'));
            expect(toggleRulerMode).toHaveBeenCalledWith(true);
        });

        it('should toggle ruler mode off when clicked while true', () => {
            const toggleRulerMode = vi.fn();
            renderMapToolbar({ rulerMode: true, setRulerMode: toggleRulerMode });
            fireEvent.click(screen.getByText('Ruler'));
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

        it('should toggle paint tool off when already active', () => {
            const mockSetTool = vi.fn();
            renderMapToolbar({ tool: 'paint', setTool: mockSetTool });
            const paintBtn = screen.getByText('Paint');
            fireEvent.click(paintBtn);
            expect(mockSetTool).toHaveBeenCalledWith('none');
        });

        it('should toggle paint tool on when inactive', () => {
            const mockSetTool = vi.fn();
            renderMapToolbar({ tool: 'none', setTool: mockSetTool });
            const paintBtn = screen.getByText('Paint');
            fireEvent.click(paintBtn);
            expect(mockSetTool).toHaveBeenCalledWith('paint');
        });

        it('should toggle erase tool off when already active', () => {
            const mockSetTool = vi.fn();
            renderMapToolbar({ tool: 'erase', setTool: mockSetTool });
            const eraseBtn = screen.getByText('Erase');
            fireEvent.click(eraseBtn);
            expect(mockSetTool).toHaveBeenCalledWith('none');
        });

        it('should toggle erase tool on when inactive', () => {
            const mockSetTool = vi.fn();
            renderMapToolbar({ tool: 'none', setTool: mockSetTool });
            const eraseBtn = screen.getByText('Erase');
            fireEvent.click(eraseBtn);
            expect(mockSetTool).toHaveBeenCalledWith('erase');
        });

        it('should toggle select tool off when already active', () => {
            const mockSetTool = vi.fn();
            renderMapToolbar({ tool: 'select', setTool: mockSetTool });
            const selectBtn = screen.getByText('Select');
            fireEvent.click(selectBtn);
            expect(mockSetTool).toHaveBeenCalledWith('none');
        });

        it('should toggle select tool on when inactive', () => {
            const mockSetTool = vi.fn();
            renderMapToolbar({ tool: 'none', setTool: mockSetTool });
            const selectBtn = screen.getByText('Select');
            fireEvent.click(selectBtn);
            expect(mockSetTool).toHaveBeenCalledWith('select');
        });

        it('should toggle room tool off when already active', () => {
            const mockSetTool = vi.fn();
            renderMapToolbar({ tool: 'room', setTool: mockSetTool });
            const roomBtn = screen.getByText('Room');
            fireEvent.click(roomBtn);
            expect(mockSetTool).toHaveBeenCalledWith('none');
        });

        it('should toggle room tool on when inactive', () => {
            const mockSetTool = vi.fn();
            renderMapToolbar({ tool: 'none', setTool: mockSetTool });
            const roomBtn = screen.getByText('Room');
            fireEvent.click(roomBtn);
            expect(mockSetTool).toHaveBeenCalledWith('room');
        });
    });
});
