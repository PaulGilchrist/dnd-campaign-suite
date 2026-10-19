// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MapToolbar from './MapToolbar.jsx';
import { OverlayShape } from '../../models/SpellOverlay.js';

// Lane: toolbar-unit owner (#924 cited). Split with siblings:
//   - displayName verbatim / 'Map' fallback / '' falsy bytes → MapToolbar.display-name.test.jsx
//   - undefined-displayName formatMapName byte ('dungeon-map.json' → 'Dungeon Map') → this file
//   - container mount + HexMap props-down → Map.test.jsx; event routing/handlers → Map-tool-handlers.test.jsx
//   - SpellOverlayControls internals (own props) → SpellOverlayControls.test.jsx;
//     the toolbar's onSelectShape dual-setter wiring + mount gating → this file
//   - items panel palettes → ItemsPanel (#919); menus → #920/#921
// Contract pinned here: exact ordered button census + icon bytes (#789), click → callback
// exact args once (#786/#744), active-tool selected byte both directions (toolbar-only),
// localhost gating bytes, null-state honesty (#927 trim: Spell button face only).

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

describe('MapToolbar', () => {
    describe('rendering', () => {
        it('formats the map name when no displayName is provided', () => {
            renderMapToolbar();
            expect(screen.getByText('Dungeon Map')).toBeInTheDocument();
        });

        it('renders the full GM toolbar in exact order with pinned icons', () => {
            const { container } = renderMapToolbar({ onEnter3D: vi.fn() });
            const buttons = [...container.querySelectorAll('.toolbar button')];
            expect(buttons.map(b => b.textContent.trim())).toEqual([
                'Paint', 'Erase', 'Select', 'Spell', 'Ruler', '3D', 'Items', '', '', 'Reset Fog',
            ]);
            expect(buttons.map(b => b.querySelector('i')?.className)).toEqual([
                'fa-solid fa-paint-brush',
                'fa-solid fa-eraser',
                'fa-solid fa-arrow-pointer',
                'fa-solid fa-wand-magic-sparkles',
                'fa-solid fa-ruler',
                'fa-solid fa-cube',
                'fa-solid fa-box',
                'fa-solid fa-magnifying-glass-plus',
                'fa-solid fa-magnifying-glass-minus',
                'fa-solid fa-rotate-left',
            ]);
            // Resting state: no overlay controls, no ruler hint.
            expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
            expect(screen.queryByText('Click two points to measure distance')).not.toBeInTheDocument();
        });

        it('gates GM-only controls for network players and swaps Reset Fog for Reset View', () => {
            const resetView = vi.fn();
            const resetFog = vi.fn();
            const { container } = renderMapToolbar({ isLocalhost: false, resetView, resetFog });
            const buttons = [...container.querySelectorAll('.toolbar button')];
            expect(buttons.map(b => b.textContent.trim())).toEqual([
                'Spell', 'Ruler', '', '', 'Reset View',
            ]);
            expect(screen.queryByText('Paint')).not.toBeInTheDocument();
            expect(screen.queryByText('Erase')).not.toBeInTheDocument();
            expect(screen.queryByText('Select')).not.toBeInTheDocument();
            expect(screen.queryByText('Items')).not.toBeInTheDocument();
            expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
            expect(screen.queryByTitle('View map in 3D')).not.toBeInTheDocument();
            fireEvent.click(screen.getByTitle('Reset view'));
            expect(resetView).toHaveBeenCalledTimes(1);
            expect(resetFog).not.toHaveBeenCalled();
        });

        it('renders the back button only when onBack is provided and invokes it once', () => {
            const onBack = vi.fn();
            const { unmount } = renderMapToolbar({ onBack });
            fireEvent.click(screen.getByTitle('Back'));
            expect(onBack).toHaveBeenCalledTimes(1);
            unmount();
            renderMapToolbar({ onBack: undefined });
            expect(screen.queryByTitle('Back')).not.toBeInTheDocument();
        });

        it('renders the 3D button only when onEnter3D is provided and invokes it once', () => {
            const { unmount } = renderMapToolbar();
            expect(screen.queryByTitle('View map in 3D')).not.toBeInTheDocument();
            unmount();
            const onEnter3D = vi.fn();
            renderMapToolbar({ onEnter3D });
            fireEvent.click(screen.getByTitle('View map in 3D'));
            expect(onEnter3D).toHaveBeenCalledTimes(1);
        });

        it('survives a null spellOverlayState — Spell button renders, inactive', () => {
            renderMapToolbar({ spellOverlayState: null });
            expect(screen.getByRole('button', { name: 'Spell' })).not.toHaveClass('active');
            expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        });
    });

    describe('tool buttons toggle with exact args and active byte both directions', () => {
        it.each([
            ['paint', 'Paint'],
            ['erase', 'Erase'],
            ['select', 'Select'],
        ])('%s: click dispatches setTool(%s), click again dispatches none', (tool, label) => {
            const setTool = vi.fn();
            const { unmount, getByRole } = renderMapToolbar({ tool: 'none', setTool });
            const btn = getByRole('button', { name: label });
            expect(btn).not.toHaveClass('active');
            fireEvent.click(btn);
            expect(setTool).toHaveBeenCalledWith(tool);
            unmount();

            const { getByRole: getActive } = renderMapToolbar({ tool, setTool });
            expect(getActive('button', { name: label })).toHaveClass('active');
            fireEvent.click(getActive('button', { name: label }));
            expect(setTool).toHaveBeenLastCalledWith('none');
        });

        it('toggles spell mode: inactive activates with default shape, active deactivates to null', () => {
            const setSpellMode = vi.fn();
            const setTool = vi.fn();
            const { unmount, getByRole } = renderMapToolbar({
                spellOverlayState: createMockSpellOverlayState({ spellMode: null, setSpellMode }),
                setTool,
            });
            const spellBtn = getByRole('button', { name: 'Spell' });
            expect(spellBtn).not.toHaveClass('active');
            fireEvent.click(spellBtn);
            expect(setTool).toHaveBeenCalledWith('none');
            expect(setSpellMode).toHaveBeenCalledWith(OverlayShape.SPHERE);
            unmount();

            const { getByRole: getActive } = renderMapToolbar({
                spellOverlayState: createMockSpellOverlayState({ spellMode: OverlayShape.SPHERE, setSpellMode }),
            });
            const activeBtn = getActive('button', { name: 'Spell' });
            expect(activeBtn).toHaveClass('active');
            fireEvent.click(activeBtn);
            expect(setSpellMode).toHaveBeenCalledWith(null);
        });

        it('toggles ruler mode and shows the ruler hint while active', () => {
            const setRulerMode = vi.fn();
            const { unmount, getByRole } = renderMapToolbar({ rulerMode: false, setRulerMode });
            expect(getByRole('button', { name: 'Ruler' })).not.toHaveClass('active');
            expect(screen.queryByText('Click two points to measure distance')).not.toBeInTheDocument();
            fireEvent.click(getByRole('button', { name: 'Ruler' }));
            expect(setRulerMode).toHaveBeenCalledWith(true);
            unmount();

            const { getByRole: getActive } = renderMapToolbar({ rulerMode: true, setRulerMode });
            expect(getActive('button', { name: 'Ruler' })).toHaveClass('active');
            expect(screen.getByText('Click two points to measure distance')).toBeInTheDocument();
            fireEvent.click(getActive('button', { name: 'Ruler' }));
            expect(setRulerMode).toHaveBeenLastCalledWith(false);
        });

        it('toggles the items panel via a functional updater', () => {
            const setItemsPanelOpen = vi.fn();
            renderMapToolbar({ setItemsPanelOpen });
            fireEvent.click(screen.getByRole('button', { name: 'Items' }));
            expect(setItemsPanelOpen).toHaveBeenCalledTimes(1);
            const updater = setItemsPanelOpen.mock.calls[0][0];
            expect(updater(false)).toBe(true);
            expect(updater(true)).toBe(false);
        });

        it('dispatches zoomIn and zoomOut once each from their pinned icons', () => {
            const zoomIn = vi.fn();
            const zoomOut = vi.fn();
            const { container } = renderMapToolbar({ zoomIn, zoomOut });
            fireEvent.click(container.querySelector('.toolbar i.fa-magnifying-glass-plus').closest('button'));
            expect(zoomIn).toHaveBeenCalledTimes(1);
            expect(zoomOut).not.toHaveBeenCalled();
            fireEvent.click(container.querySelector('.toolbar i.fa-magnifying-glass-minus').closest('button'));
            expect(zoomOut).toHaveBeenCalledTimes(1);
        });

        it('GM Reset Fog click resets view and fog', () => {
            const resetView = vi.fn();
            const resetFog = vi.fn();
            renderMapToolbar({ resetView, resetFog });
            fireEvent.click(screen.getByRole('button', { name: 'Reset Fog' }));
            expect(resetView).toHaveBeenCalledTimes(1);
            expect(resetFog).toHaveBeenCalledTimes(1);
        });
    });

    describe('spell overlay wiring', () => {
        it('mounts controls when spellMode is set and shape choice dispatches to both setters', () => {
            const setSelectedShape = vi.fn();
            const setSpellMode = vi.fn();
            renderMapToolbar({
                spellOverlayState: createMockSpellOverlayState({
                    spellMode: OverlayShape.SPHERE,
                    setSelectedShape,
                    setSpellMode,
                }),
            });
            expect(screen.getByText('Spell Overlay')).toBeInTheDocument();
            // Toolbar-owned wiring: onSelectShape fans one change out to both setters.
            fireEvent.change(screen.getByRole('combobox'), { target: { value: OverlayShape.CONE } });
            expect(setSelectedShape).toHaveBeenCalledWith(OverlayShape.CONE);
            expect(setSpellMode).toHaveBeenCalledWith(OverlayShape.CONE);
        });
    });

    describe('grid size input', () => {
        it('exposes value/min/max bytes and dispatches numeric updates', () => {
            const setGridSize = vi.fn();
            renderMapToolbar({ gridSize: 10, setGridSize });
            const gridInput = screen.getByRole('spinbutton');
            expect(gridInput).toHaveValue(10);
            expect(gridInput).toHaveAttribute('min', '5');
            expect(gridInput).toHaveAttribute('max', '100');
            fireEvent.change(gridInput, { target: { value: '20' } });
            expect(setGridSize).toHaveBeenCalledWith(20);
        });
    });
});
