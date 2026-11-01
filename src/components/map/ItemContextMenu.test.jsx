// @maintained-by-ai
// ─── Lane: ItemContextMenu — GM context menu on placed map items ─────────────
// OWNED here: menu open content (exact ordered label census by item state) and
// action dispatch (each entry click → consumer callback, exact args, exactly once).
//
// Menu label census (exact render order; close glyph '✕' is always last):
//   state                        labels
//   token visible              → ['Hide','Delete','Rotate','✕']
//   token hidden             → ['Show','Delete','Rotate','✕']
//   monster token            → ['Hide','Delete','✕']          (no Rotate — rotation-invariant lane)
//   npc, monster not found   → ['Hide','Delete','Rename','✕'] (no Rotate)
//   npc, monster found       → ['Hide','Delete','Rename','View Stats','✕'] (no Rotate)
//   rotatable prop (table)   → ['Hide','Delete','Rotate','✕']
//   door closed              → ['Hide','Delete','Open Door','Rotate','✕']
//   door open                → ['Hide','Delete','Close Door','Rotate','✕']
//   unknown type             → ['Hide','Delete','Rotate','✕']
//   id not in placedItems    → ['Hide','Delete','Rotate','✕']
//   no selection (null)      → renders nothing
//
// Rotate visibility is type-derived (showRotateOption, mirroring
// showRenameOption): creature types npc/monster have zero transform consumers
// in either render lane (2D PlacedItems renderCreature, 3D map3dScene
// _buildNpcs), so Rotate is hidden for them — silent persisted knob
// (backlog 2026-11-01 BA).
//
// NOT OWNED — cited to owner lanes (dispatch args pinned here only):
//   door open/closed pane swap + resulting placed state → PlacedItems lanes (#899/#909)
//   toggle/delete/rotate state mutations                → hooks/usePlacedItems.test.js (#906/#909)
//   door SVG pixels                                     → DoorSVG.test.jsx (#890-#902)
//   wall/fog rendering                                  → GridAndWalls #903, fog #901/#904/#915
//   end-to-end rename/modal flows                     → Map-context-menus.test.jsx
//   player context menu                               → PlayerContextMenu.test.jsx
//
// Old→new: 20 one-label exists/click tests consolidated into
//   null-render(1) + census table(8) + per-handler dispatch table(6) + rename(2) + click containment(1).
//   Cut: rect x/y layout internals (menu anchor pinned behaviorally by the '✕' → onClose(30,30) byte);
//   redundant Rotate/NPC-absence exists-checks (subsumed by ordered census rows).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ItemContextMenu from './ItemContextMenu';

const gridCenterX = (gx) => gx * 40 + 20;
const gridCenterY = (gy) => gy * 40 + 20;

const SELECTED = { id: 'item-1', gridX: 0, gridY: 0 };

const createMocks = () => ({
    handleToggleItemVisibility: vi.fn(),
    handleDeleteItem: vi.fn(),
    handleRotate: vi.fn(),
    handleToggleDoor: vi.fn(),
    handleViewStats: vi.fn(),
    onRenameClicked: vi.fn(),
    onClose: vi.fn(),
});

const placedItem = (overrides = {}) => ({
    id: 'item-1',
    type: 'token',
    visible: true,
    open: false,
    name: 'Test NPC',
    ...overrides,
});

const renderMenu = (mocks, props = {}) => render(
    <ItemContextMenu
        selectedItem={SELECTED}
        placedItems={[placedItem()]}
        gridCenterX={gridCenterX}
        gridCenterY={gridCenterY}
        monsterFound={false}
        {...mocks}
        {...props}
    />
);

// Exact ordered text census of the rendered menu, including the close glyph.
const menuLabels = (container) =>
    Array.from(container.querySelectorAll('text')).map(t => t.textContent);

// Exact dispatch contract: one callback, once, with exact args; every other handler untouched.
const expectOnlyCall = (mocks, key, args) => {
    expect(mocks[key]).toHaveBeenCalledTimes(1);
    expect(mocks[key]).toHaveBeenCalledWith(...args);
    Object.entries(mocks)
        .filter(([k]) => k !== key)
        .forEach(([, spy]) => expect(spy).not.toHaveBeenCalled());
};

// ── Selection contract ─────────────────────────────────────────

describe('no selection', () => {
    it('renders nothing when selectedItem is null or undefined', () => {
        const mocks = createMocks();
        const withNull = renderMenu(mocks, { selectedItem: null });
        expect(withNull.container.innerHTML).toBe('');
        withNull.unmount();

        const withUndefined = renderMenu(mocks, { selectedItem: undefined });
        expect(withUndefined.container.innerHTML).toBe('');
    });
});

// ── Menu content: exact ordered census per item state ──────────

describe('menu content census', () => {
    it.each([
        ['token visible', { type: 'token', visible: true }, false, ['Hide', 'Delete', 'Rotate', '✕']],
        ['token hidden', { type: 'token', visible: false }, false, ['Show', 'Delete', 'Rotate', '✕']],
        ['npc monster not found', { type: 'npc' }, false, ['Hide', 'Delete', 'Rename', '✕']],
        ['npc monster found', { type: 'npc' }, true, ['Hide', 'Delete', 'Rename', 'View Stats', '✕']],
        ['monster token', { type: 'monster', name: 'Goblin' }, false, ['Hide', 'Delete', '✕']],
        ['monster token hidden', { type: 'monster', name: 'Goblin', visible: false }, false, ['Show', 'Delete', '✕']],
        ['rotatable prop (table)', { type: 'table' }, false, ['Hide', 'Delete', 'Rotate', '✕']],
        ['door closed, monster found', { type: 'door', open: false }, true, ['Hide', 'Delete', 'Open Door', 'Rotate', '✕']],
        ['door open', { type: 'door', open: true }, false, ['Hide', 'Delete', 'Close Door', 'Rotate', '✕']],
        ['unknown type', { type: 'chest' }, true, ['Hide', 'Delete', 'Rotate', '✕']],
    ])('%s → exact labels', (_state, item, monsterFound, expected) => {
        const mocks = createMocks();
        const { container } = renderMenu(mocks, {
            placedItems: [placedItem(item)],
            monsterFound,
        });
        expect(menuLabels(container)).toEqual(expected);
    });

    it('id not in placedItems → base menu, no crash', () => {
        const mocks = createMocks();
        const { container } = renderMenu(mocks, { placedItems: [] });
        expect(menuLabels(container)).toEqual(['Hide', 'Delete', 'Rotate', '✕']);
    });
});

// ── Rotation-invariant creature tokens: Rotate menu is unreachable ──
// Backlog 2026-11-01 BA: npc/monster render lanes (2D PlacedItems
// renderCreature, 3D map3dScene._buildNpcs) never consume `rotation`, so the
// menu must not advertise Rotate for them — every creature-menu click must
// leave handleRotate unfired (no silent persisted knob).

describe('creature tokens never dispatch rotate', () => {
    it.each([
        ['npc', { type: 'npc', name: 'Marta' }],
        ['monster', { type: 'monster', name: 'Goblin' }],
    ])('%s dress-token row: clicking every menu entry leaves handleRotate untouched', (_label, item) => {
        const mocks = createMocks();
        const { container } = renderMenu(mocks, { placedItems: [placedItem(item)] });
        expect(screen.queryByText('Rotate')).not.toBeInTheDocument();
        container.querySelectorAll('.menu-option').forEach(option => fireEvent.click(option));
        expect(mocks.handleRotate).not.toHaveBeenCalled();
        // Sanity: the menu is live, not a dead render — sibling entries fired.
        expect(mocks.handleToggleItemVisibility).toHaveBeenCalledTimes(1);
        expect(mocks.handleDeleteItem).toHaveBeenCalledTimes(1);
    });
});

// ── Panel height tracks the entry count (Rotate row removed ⇒ −22) ──

describe('menu panel height', () => {
    const menuRectHeight = (container) =>
        Number(container.querySelector('.item-context-menu rect').getAttribute('height'));

    it.each([
        ['monster (Hide/Delete only)', { type: 'monster', name: 'Goblin' }, false, 54],
        ['npc (Rename, no Rotate)', { type: 'npc' }, false, 98],
        ['npc + stats (no Rotate)', { type: 'npc' }, true, 116],
        ['rotatable prop keeps Rotate row', { type: 'table' }, false, 76],
        ['door keeps Rotate row', { type: 'door' }, false, 116],
    ])('%s', (_label, item, monsterFound, expected) => {
        const mocks = createMocks();
        const { container } = renderMenu(mocks, {
            placedItems: [placedItem(item)],
            monsterFound,
        });
        expect(menuRectHeight(container)).toBe(expected);
    });
});

// ── Dispatch: one row per handler, exact args, nothing else fires ──

describe('action dispatch', () => {
    it.each([
        ['Hide', 'handleToggleItemVisibility', ['item-1'], {}],
        ['Delete', 'handleDeleteItem', ['item-1'], {}],
        ['Rotate', 'handleRotate', ['item-1'], {}],
        ['Open Door', 'handleToggleDoor', ['item-1'], { placedItems: [placedItem({ type: 'door', open: false })] }],
        ['View Stats', 'handleViewStats', ['item-1'], { placedItems: [placedItem({ type: 'npc' })], monsterFound: true }],
        // Anchor byte: grid (0,0) → center (20,20) + offset 10 → onClose(30, 30).
        ['✕', 'onClose', [30, 30], {}],
    ])('clicking %s calls %s with %j and nothing else', (label, spyKey, args, props) => {
        const mocks = createMocks();
        renderMenu(mocks, props);
        fireEvent.click(screen.getByText(label));
        expectOnlyCall(mocks, spyKey, args);
    });
});

// ── Rename payload (distinct signature: event, selectedItem, name) ──

describe('rename dispatch', () => {
    it.each([
        ['named npc', 'Goblin', 'Goblin'],
        ['nameless npc', null, 'NPC'],
    ])('%s: Rename dispatches (event, selectedItem, %s)', (_label, name, expectedName) => {
        const mocks = createMocks();
        renderMenu(mocks, { placedItems: [placedItem({ type: 'npc', name })] });
        fireEvent.click(screen.getByText('Rename'));
        expectOnlyCall(mocks, 'onRenameClicked', [expect.anything(), SELECTED, expectedName]);
    });
});

// ── Click containment ──────────────────────────────────────────

describe('click containment', () => {
    it('menu panel absorbs clicks so the canvas surface below never fires', () => {
        const mocks = createMocks();
        const onCanvasClick = vi.fn();
        const { container } = render(
            <svg onClick={onCanvasClick}>
                <rect className="canvas-surface" x="0" y="0" width="400" height="400" />
                <ItemContextMenu
                    selectedItem={SELECTED}
                    placedItems={[placedItem()]}
                    gridCenterX={gridCenterX}
                    gridCenterY={gridCenterY}
                    monsterFound={false}
                    {...mocks}
                />
            </svg>
        );

        fireEvent.click(container.querySelector('.item-context-menu rect'));
        expect(onCanvasClick).not.toHaveBeenCalled();
        expect(mocks.handleDeleteItem).not.toHaveBeenCalled();

        // Sanity: containment is real, not a dead listener — sibling click bubbles.
        fireEvent.click(container.querySelector('.canvas-surface'));
        expect(onCanvasClick).toHaveBeenCalledTimes(1);
    });
});
