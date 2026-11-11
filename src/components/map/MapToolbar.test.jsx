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
            fireEvent.click(screen.getByTitle('Back to maps'));
            expect(onBack).toHaveBeenCalledTimes(1);
            unmount();
            renderMapToolbar({ onBack: undefined });
            expect(screen.queryByTitle('Back to maps')).not.toBeInTheDocument();
        });

        // Dynamic back label (backlog 2026-11-11 JV): while the App map-history
        // stack is armed the button names the map its press pops — title AND
        // aria-label — instead of lying about landing on the manager. Press
        // routing itself is unchanged (still a bare onBack click).
        it('names the popped map in title + aria-label when backMapTarget is armed', () => {
            const onBack = vi.fn();
            renderMapToolbar({ onBack, backMapTarget: { mapName: 'dungeon-1', mapDisplayName: 'Dungeon 1' } });
            const button = screen.getByRole('button', { name: 'Back to Dungeon 1' });
            expect(button).toHaveAttribute('title', 'Back to Dungeon 1');
            expect(screen.queryByTitle('Back to maps')).not.toBeInTheDocument();
            fireEvent.click(button);
            expect(onBack).toHaveBeenCalledTimes(1);
        });

        it('title-cases a slug-only history entry for the armed label', () => {
            renderMapToolbar({ backMapTarget: { mapName: 'inner-cave' } });
            expect(screen.getByTitle('Back to Inner Cave'))
                .toHaveAttribute('aria-label', 'Back to Inner Cave');
        });

        it('null/absent backMapTarget keeps the byte-identical "Back to maps" face', () => {
            const { unmount } = renderMapToolbar({ backMapTarget: null });
            expect(screen.getByTitle('Back to maps')).toHaveAttribute('aria-label', 'Back to maps');
            unmount();
            // Legacy host: prop never passed at all — same static chrome.
            renderMapToolbar();
            expect(screen.getByTitle('Back to maps')).toHaveAttribute('aria-label', 'Back to maps');
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

        it('gives every toolbar button an aria-label (GM census)', () => {
            const { container } = renderMapToolbar({ onEnter3D: vi.fn() });
            // Acceptance query: zero unlabelled buttons in the toolbar.
            expect(container.querySelectorAll('.toolbar button:not([aria-label])')).toHaveLength(0);
            expect(container.querySelector('.toolbar-back-btn')).toHaveAttribute('aria-label', 'Back to maps');
            // Texted buttons mirror their visible label; icon-only/3D carry functional ones.
            for (const label of ['Paint', 'Erase', 'Select', 'Spell', 'Ruler', 'Items', 'Reset Fog']) {
                expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-label', label);
            }
            expect(screen.getByRole('button', { name: 'View map in 3D' })).toHaveAttribute('aria-label', 'View map in 3D');
            expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();
        });

        it('labels every network-player toolbar button too (Reset View arm)', () => {
            const { container } = renderMapToolbar({ isLocalhost: false });
            expect(container.querySelectorAll('.toolbar button:not([aria-label])')).toHaveLength(0);
            expect(screen.getByRole('button', { name: 'Reset View' })).toHaveAttribute('aria-label', 'Reset View');
        });
    });

    describe('missing spellOverlayState arms — Spell click is inert, never throws (#928a)', () => {
        // Producers: Map.jsx:395 is the only production site and always sends a
        // full object, so null/undefined/{} are defensive-only. Honest behavior of
        // a Spell click with no overlay state is a total no-op: no TypeError, no
        // half-action (setTool must NOT fire because the mode can never engage).
        it.each([
            ['null', null],
            ['undefined', undefined],
            ['empty object', {}],
            ['object without setters', { spellMode: null, selectedShape: 'sphere' }],
        ])('%s: click dispatches nothing and stays inactive', (_label, state) => {
            const setTool = vi.fn();
            renderMapToolbar({ spellOverlayState: state, setTool });
            const spellBtn = screen.getByRole('button', { name: 'Spell' });
            expect(spellBtn).not.toHaveClass('active');
            expect(() => fireEvent.click(spellBtn)).not.toThrow();
            expect(setTool).not.toHaveBeenCalled();
            expect(screen.getByRole('button', { name: 'Spell' })).not.toHaveClass('active');
            expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        });
    });

    describe('spellMode falsy-arm unification — null, undefined and "" render identically (#928b)', () => {
        // Census: spellMode producers emit ONLY null or non-empty OverlayShape
        // strings (Map.jsx init/clear, toggleSpellMode, onSelectShape, Cancel);
        // '' is never produced and every downstream consumer (usePlayerDragging,
        // useItemDragging, useSpellHandlers) tests truthiness, so '' means
        // inactive. Verdict: the mount gate unifies to truthy — '' mounts
        // nothing, exactly like null.
        it.each([
            ['null', null],
            ['undefined', undefined],
            ['empty string', ''],
        ])('%s: button inactive, controls not mounted', (_label, spellMode) => {
            const setTool = vi.fn();
            renderMapToolbar({ spellOverlayState: createMockSpellOverlayState({ spellMode }), setTool });
            const spellBtn = screen.getByRole('button', { name: 'Spell' });
            expect(spellBtn.getAttribute('class')).toBe('');
            expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
            expect(screen.queryByText('Spell Overlay')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
            // Truthy arm re-arms normally from the unified inactive state.
            fireEvent.click(spellBtn);
            expect(setTool).toHaveBeenCalledWith('none');
            expect(setTool).toHaveBeenCalledTimes(1);
        });

        it('active shape mounts controls active: button class byte and Cancel present', () => {
            renderMapToolbar({
                spellOverlayState: createMockSpellOverlayState({ spellMode: OverlayShape.SPHERE }),
            });
            expect(screen.getByRole('button', { name: 'Spell' })).toHaveClass('active');
            expect(screen.getByRole('combobox')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
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

        // Spell toggle must announce on/off to screen readers and harnesses.
        // aria-pressed mirrors the .active class — both driven by the same
        // spellMode prop (HexMapToolbar travel-button + SessionSection.jsx
        // aria-pressed={boolean} pattern) — and renders for the false state
        // too (never null/absent).
        it('Spell button exposes pressed state via aria-pressed across arm/disarm', () => {
            const setSpellMode = vi.fn();

            // Inactive: attribute present and false.
            const { unmount, getByRole } = renderMapToolbar({
                spellOverlayState: createMockSpellOverlayState({ spellMode: null, setSpellMode }),
            });
            const idle = getByRole('button', { name: 'Spell' });
            expect(idle).toHaveAttribute('aria-pressed', 'false');
            expect(idle).not.toHaveClass('active');

            // Arm: click requests the default shape; parent re-render makes it pressed.
            fireEvent.click(idle);
            expect(setSpellMode).toHaveBeenCalledWith(OverlayShape.SPHERE);
            unmount();

            const armedRender = renderMapToolbar({
                spellOverlayState: createMockSpellOverlayState({ spellMode: OverlayShape.SPHERE, setSpellMode }),
            });
            const armed = armedRender.getByRole('button', { name: 'Spell' });
            expect(armed).toHaveAttribute('aria-pressed', 'true');
            expect(armed).toHaveClass('active');

            // Disarm (button toggle or panel Cancel flips spellMode to null): false again.
            fireEvent.click(armed);
            expect(setSpellMode).toHaveBeenLastCalledWith(null);
            armedRender.unmount();

            const { getByRole: getIdle } = renderMapToolbar({
                spellOverlayState: createMockSpellOverlayState({ spellMode: null, setSpellMode }),
            });
            expect(getIdle('button', { name: 'Spell' })).toHaveAttribute('aria-pressed', 'false');
        });

        // Defensive arm: with no overlay state the mode can never engage, so
        // the button must still honestly report pressed=false (never absent).
        it('Spell button reports aria-pressed=false with a null spellOverlayState', () => {
            renderMapToolbar({ spellOverlayState: null });
            expect(screen.getByRole('button', { name: 'Spell' })).toHaveAttribute('aria-pressed', 'false');
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

        // Ruler toggle must announce on/off to screen readers and harnesses
        // (a11y parity with the Spell button): aria-pressed mirrors the .active
        // class — both driven by the same rulerMode prop — and renders for the
        // false state too (never null/absent).
        it('Ruler button exposes pressed state via aria-pressed across arm/disarm', () => {
            const setRulerMode = vi.fn();

            // Inactive: attribute present and false.
            const { unmount, getByRole } = renderMapToolbar({ rulerMode: false, setRulerMode });
            const idle = getByRole('button', { name: 'Ruler' });
            expect(idle).toHaveAttribute('aria-pressed', 'false');
            expect(idle).not.toHaveClass('active');

            // Arm: click requests ruler mode; parent re-render makes it pressed.
            fireEvent.click(idle);
            expect(setRulerMode).toHaveBeenCalledWith(true);
            unmount();

            const armedRender = renderMapToolbar({ rulerMode: true, setRulerMode });
            const armed = armedRender.getByRole('button', { name: 'Ruler' });
            expect(armed).toHaveAttribute('aria-pressed', 'true');
            expect(armed).toHaveClass('active');

            // Disarm: click flips rulerMode back to false.
            fireEvent.click(armed);
            expect(setRulerMode).toHaveBeenLastCalledWith(false);
            armedRender.unmount();

            const { getByRole: getIdle } = renderMapToolbar({ rulerMode: false, setRulerMode });
            expect(getIdle('button', { name: 'Ruler' })).toHaveAttribute('aria-pressed', 'false');
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

        // Mount condition (backlog 2026-11-01 BB): overlays on the board surface
        // the management panel WITHOUT ever arming the toolbar Spell toggle.
        it('mounts manage-only controls when overlays exist with spellMode null', () => {
            const removeOverlay = vi.fn();
            const clearOverlays = vi.fn();
            const setSpellMode = vi.fn();
            const { container } = renderMapToolbar({
                spellOverlayState: createMockSpellOverlayState({
                    spellMode: null,
                    setSpellMode,
                    // Renderable rows only (transport shape guard, 2026-11-02):
                    // malformed items would now be skipped by the panel.
                    overlays: [
                        { id: 'o1', shape: OverlayShape.SPHERE, startGridX: 1, startGridY: 2, radiusFt: 20, color: 'rgba(255,80,60,0.07)' },
                        { id: 'o2', shape: OverlayShape.CONE, startGridX: 3, startGridY: 4, distanceFt: 60, coneAngle: 53, color: 'rgba(255,80,60,0.07)' },
                    ],
                    removeOverlay,
                    clearOverlays,
                }),
            });
            // Panel present with the full management face.
            expect(container.querySelector('.spell-overlay-controls')).toBeInTheDocument();
            expect(screen.getByText('Active (2)')).toBeInTheDocument();
            expect(container.querySelectorAll('.spell-overlay-item')).toHaveLength(2);
            // Manage-only: placement chrome stays hidden, toggle stays disarmed,
            // and the whole param section is inert (disabled/dimmed — backlog
            // 2026-11-09 ER: nothing may imply a map click will place a zone).
            expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
            expect(screen.queryByText(/Click map to place/)).not.toBeInTheDocument();
            expect(screen.queryByText('Params apply to the next placement only')).not.toBeInTheDocument();
            // Scope to the panel: the GM toolbar's own grid-size input is a live spinbutton.
            expect(screen.getByRole('combobox')).toBeDisabled();
            container
                .querySelectorAll('.spell-overlay-row input[type="number"]')
                .forEach((input) => expect(input).toBeDisabled());
            const spellBtn = screen.getByRole('button', { name: 'Spell' });
            expect(spellBtn).toHaveAttribute('aria-pressed', 'false');
            expect(spellBtn).not.toHaveClass('active');
            // Remove/Clear route straight to the hook without arming.
            fireEvent.click(container.querySelector('.spell-overlay-item button'));
            expect(removeOverlay).toHaveBeenCalledWith('o1');
            expect(setSpellMode).not.toHaveBeenCalled();
            fireEvent.click(container.querySelector('.spell-overlay-clear-btn'));
            expect(clearOverlays).toHaveBeenCalledTimes(1);
            expect(setSpellMode).not.toHaveBeenCalled();
        });

        it('mounts nothing when overlays are empty and placement mode is not armed', () => {
            const { container } = renderMapToolbar({
                spellOverlayState: createMockSpellOverlayState({ spellMode: null, overlays: [] }),
            });
            expect(container.querySelector('.spell-overlay-controls')).not.toBeInTheDocument();
            expect(screen.queryByText('Spell Overlay')).not.toBeInTheDocument();
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
