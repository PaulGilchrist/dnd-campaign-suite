// @maintained-by-ai
// ─── Lane: ItemContextMenu — keyboard + focus semantics ───────────────────────
// OWNED here (backlog 2026-11-16 XC — the menu WAS pointer-only SVG chrome):
//   role=menu on the container, role=menuitem + tabIndex on every row
//   open moves focus to the first entry
//   Enter/Space on a focused row fires the SAME handler as a pointer click
//   (same dispatch contract as ItemContextMenu.test.jsx, per row)
//   Escape = dismiss-zero-write via the onClose seam (modal-family law of
//   3f41dc16b, mirroring the hex POI menu's shipped 2026-11-13 seam) —
//   answers with focus on a menuitem, the menu root, or the board behind
//   the menu, and NEVER activates the focused option
//   Arrow/Home/End roving navigation between rows
//   the pointer path is unchanged: a click on text.menu-option still activates
//
// NOT OWNED — cited to owner lanes:
//   menu label census + per-entry CLICK dispatch args   → ItemContextMenu.test.jsx (#918)
//   container anchor/swap/close wiring                  → Map-context-menus.test.jsx
//   contextmenu selection byte on the hit-rect          → PlacedItems-event-handlers.test.jsx
//   right-button capture guards (trusted contextmenu routing fix) → hooks tests
//   (useSelectMove.test.js / useWallDrawing.test.js)
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
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
    type: 'barrel',
    visible: true,
    open: false,
    name: 'Test NPC',
    ...overrides,
});

const renderMenu = (mocks, props = {}) => render(
    <svg>
        <ItemContextMenu
            selectedItem={SELECTED}
            placedItems={[placedItem()]}
            gridCenterX={gridCenterX}
            gridCenterY={gridCenterY}
            monsterFound={false}
            {...mocks}
            {...props}
        />
    </svg>
);

const menuItems = (container) =>
    Array.from(container.querySelectorAll('[role="menuitem"]'));

// Exact dispatch contract: one callback, once, with exact args; every other handler untouched.
const expectOnlyCall = (mocks, key, args) => {
    expect(mocks[key]).toHaveBeenCalledTimes(1);
    expect(mocks[key]).toHaveBeenCalledWith(...args);
    Object.entries(mocks)
        .filter(([k]) => k !== key)
        .forEach(([, spy]) => expect(spy).not.toHaveBeenCalled());
};

const expectOnlyCallNoHandlers = (mocks) => {
    Object.values(mocks).forEach(spy => expect(spy).not.toHaveBeenCalled());
};

describe('AX roles', () => {
    it('container is role=menu and every row is a tabIndex=0 menuitem', () => {
        const mocks = createMocks();
        const { container } = renderMenu(mocks, {
            placedItems: [placedItem({ type: 'npc', name: 'Marta' })],
        });
        expect(container.querySelector('.item-context-menu')).toHaveAttribute('role', 'menu');
        const rows = menuItems(container);
        expect(rows.map(r => r.textContent)).toEqual(['Hide', 'Delete', 'Rename', '✕']);
        rows.forEach(row => expect(row).toHaveAttribute('tabindex', '0'));
    });
});

describe('focus on open', () => {
    it('opening the menu moves focus into the first entry', () => {
        const mocks = createMocks();
        renderMenu(mocks);
        expect(document.activeElement).toBe(
            screen.getByRole('menuitem', { name: 'Hide', exact: true })
        );
        // Zero activation while focusing.
        expectOnlyCallNoHandlers(mocks);
    });

    it('re-opening for a different selection re-focuses the first entry', () => {
        const mocks = createMocks();
        const first = renderMenu(mocks);
        expect(document.activeElement).toBe(
            screen.getByRole('menuitem', { name: 'Hide', exact: true })
        );
        first.unmount();
        renderMenu(mocks, { selectedItem: { id: 'item-1', gridX: 4, gridY: 2 } });
        expect(document.activeElement).toBe(
            screen.getByRole('menuitem', { name: 'Hide', exact: true })
        );
    });
});

describe('Enter/Space activation (same action as a pointer click)', () => {
    // [label, spyKey, args, render props] — mirrors the click contract pinned
    // by ItemContextMenu.test.jsx; rename's event slot is undefined because
    // keydown activation never synthesises an event object (Map's
    // handleRenameClicked ignores its first arg).
    it.each([
        ['Hide', 'handleToggleItemVisibility', ['item-1'], 'Enter', {}],
        ['Delete', 'handleDeleteItem', ['item-1'], ' ', {}],
        ['Rotate', 'handleRotate', ['item-1'], 'Enter', {}],
        ['Open Door', 'handleToggleDoor', ['item-1'], 'Enter', { placedItems: [placedItem({ type: 'door', open: false })] }],
        ['View Stats', 'handleViewStats', ['item-1'], ' ', { placedItems: [placedItem({ type: 'npc' })], monsterFound: true }],
        ['✕', 'onClose', [30, 30], 'Enter', {}],
    ])('%s via %s calls %s with %j and nothing else', (label, spyKey, args, key, props) => {
        const mocks = createMocks();
        renderMenu(mocks, props);
        const row = screen.getByRole('menuitem', { name: label, exact: true });
        row.focus();
        fireEvent.keyDown(row, { key });
        expectOnlyCall(mocks, spyKey, args);
    });

    it('Rename via Enter dispatches (undefined-event, selectedItem, name) exactly as the click lane minus the event', () => {
        const mocks = createMocks();
        renderMenu(mocks, { placedItems: [placedItem({ type: 'npc', name: 'Goblin' })] });
        fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Rename', exact: true }), { key: 'Enter' });
        expectOnlyCall(mocks, 'onRenameClicked', [undefined, SELECTED, 'Goblin']);
    });

    it('Enter fires exactly once (a keydown on SVG g never synthesises a click)', () => {
        const mocks = createMocks();
        renderMenu(mocks);
        fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Delete', exact: true }), { key: 'Enter' });
        expect(mocks.handleDeleteItem).toHaveBeenCalledTimes(1);
    });

    it('the pointer path is unchanged: a click on text.menu-option still activates', () => {
        const mocks = createMocks();
        const { container } = renderMenu(mocks);
        fireEvent.click(container.querySelector('text.menu-option'));
        expectOnlyCall(mocks, 'handleToggleItemVisibility', ['item-1']);
    });

    it('Enter/Space preventDefault (never scrolls the page behind the menu)', () => {
        const mocks = createMocks();
        renderMenu(mocks);
        const row = screen.getByRole('menuitem', { name: 'Hide', exact: true });
        const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
        row.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(mocks.handleToggleItemVisibility).toHaveBeenCalledTimes(1);
    });
});

describe('Escape dismissal (zero-write)', () => {
    it.each([
        { name: 'a menuitem', getTarget: () => screen.getByRole('menuitem', { name: 'Delete', exact: true }) },
        { name: 'the menu root', getTarget: (container) => container.querySelector('.item-context-menu') },
        { name: 'the board behind the menu', getTarget: () => window },
    ])('Escape on $name dismisses via onClose with zero activation', ({ getTarget }) => {
        const mocks = createMocks();
        const { container } = renderMenu(mocks);
        fireEvent.keyDown(getTarget(container), { key: 'Escape' });
        expectOnlyCall(mocks, 'onClose', [30, 30]);
    });

    it('never activates the focused option on the way out', () => {
        const mocks = createMocks();
        renderMenu(mocks);
        screen.getByRole('menuitem', { name: 'Delete', exact: true }).focus();
        fireEvent.keyDown(document.activeElement, { key: 'Escape' });
        expect(mocks.handleDeleteItem).not.toHaveBeenCalled();
        expect(mocks.onClose).toHaveBeenCalledTimes(1);
    });

    it('unmounts the menu immediately (stateful parent: onClose nulls the selection)', () => {
        const mocks = createMocks();
        function Board() {
            const [selected, setSelected] = useState(SELECTED);
            return (
                <svg>
                    <ItemContextMenu
                        {...mocks}
                        selectedItem={selected}
                        placedItems={[placedItem()]}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        monsterFound={false}
                        onClose={() => setSelected(null)}
                    />
                </svg>
            );
        }
        const { container } = render(<Board />);
        expect(container.querySelector('.item-context-menu')).toBeInTheDocument();
        act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
        expect(container.querySelector('.item-context-menu')).not.toBeInTheDocument();
        expect(mocks.handleDeleteItem).not.toHaveBeenCalled();
        expect(mocks.handleToggleItemVisibility).not.toHaveBeenCalled();
    });

    it('leaves no live listener once the menu is closed (Escape dispatches nothing)', () => {
        const mocks = createMocks();
        const { rerender } = renderMenu(mocks);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(mocks.onClose).toHaveBeenCalledTimes(1);
        rerender(
            <svg>
                <ItemContextMenu
                    {...mocks}
                    selectedItem={null}
                    placedItems={[placedItem()]}
                    gridCenterX={gridCenterX}
                    gridCenterY={gridCenterY}
                    monsterFound={false}
                />
            </svg>
        );
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(mocks.onClose).toHaveBeenCalledTimes(1);
    });
});

describe('arrow-key roving navigation', () => {
    it('ArrowDown/ArrowUp walk the rows and wrap at both ends', () => {
        const mocks = createMocks();
        const { container } = renderMenu(mocks);
        const rows = menuItems(container); // Hide, Delete, Rotate, ✕
        expect(document.activeElement).toBe(rows[0]);
        fireEvent.keyDown(rows[0], { key: 'ArrowDown' });
        expect(document.activeElement).toBe(rows[1]);
        fireEvent.keyDown(rows[1], { key: 'ArrowDown' });
        expect(document.activeElement).toBe(rows[2]);
        fireEvent.keyDown(rows[2], { key: 'ArrowDown' });
        expect(document.activeElement).toBe(rows[3]);
        fireEvent.keyDown(rows[3], { key: 'ArrowDown' }); // wrap to top
        expect(document.activeElement).toBe(rows[0]);
        fireEvent.keyDown(rows[0], { key: 'ArrowUp' }); // wrap to bottom
        expect(document.activeElement).toBe(rows[3]);
    });

    it('ArrowRight/ArrowLeft navigate too, and Home/End jump to the ends', () => {
        const mocks = createMocks();
        const { container } = renderMenu(mocks);
        const rows = menuItems(container);
        fireEvent.keyDown(rows[0], { key: 'ArrowRight' });
        expect(document.activeElement).toBe(rows[1]);
        fireEvent.keyDown(rows[1], { key: 'ArrowLeft' });
        expect(document.activeElement).toBe(rows[0]);
        fireEvent.keyDown(rows[0], { key: 'End' });
        expect(document.activeElement).toBe(rows[3]);
        fireEvent.keyDown(rows[3], { key: 'Home' });
        expect(document.activeElement).toBe(rows[0]);
    });

    it('arrowing from the menu root (focus not on a row) starts at the top and never fires a handler', () => {
        const mocks = createMocks();
        const { container } = renderMenu(mocks);
        document.activeElement.blur();
        fireEvent.keyDown(container.querySelector('.item-context-menu'), { key: 'ArrowDown' });
        expect(document.activeElement).toBe(
            screen.getByRole('menuitem', { name: 'Hide', exact: true })
        );
        expectOnlyCallNoHandlers(mocks);
    });

    it('a focused row answers exactly one Enter after arrow navigation (rename lane live shape)', () => {
        const mocks = createMocks();
        renderMenu(mocks, { placedItems: [placedItem({ type: 'npc', name: 'Marta' })] });
        const rows = menuItems(document.body);
        fireEvent.keyDown(rows[0], { key: 'ArrowDown' }); // Hide → Delete
        fireEvent.keyDown(rows[1], { key: 'ArrowDown' }); // Delete → Rename
        expect(document.activeElement).toBe(rows[2]);
        fireEvent.keyDown(rows[2], { key: 'Enter' });
        expectOnlyCall(mocks, 'onRenameClicked', [undefined, SELECTED, 'Marta']);
    });
});
