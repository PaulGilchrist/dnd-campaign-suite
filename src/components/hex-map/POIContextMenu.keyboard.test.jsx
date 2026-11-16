// @maintained-by-ai
// ─── Lane: POIContextMenu — the keyboard tier the hex menu was MISSING ────────
// bug-hex-poi-menu-no-keyboard-rove-or-focus-first: 77ef39387 shipped the
// full ARIA menu tier (open-focuses the first entry, Arrow/Home/End rove
// with wrap) only inside the indoor ItemContextMenu; the hex twin mounted
// role=menu + MenuOption rows but never adopted the rove machinery. These
// pins lock the exact broken behaviors, mirrored from the indoor twin's
// ItemContextMenu.keyboard.test.jsx faces now that both hosts ride the
// shared useMenuRoving seam.
// XF-backlog restore tier (2026-11-16): EVERY dismissal path re-focuses the
// element focused before open (fallback: the board <svg> when focus was on
// <body>) — the restore lives in the shared hook and is pinned here through
// both the dismissal paths and the rename-lane yield faces.
//
// NOT OWNED — cited to owner lanes:
//   label census + per-option CLICK dispatch/close contract → POIContextMenu.test.jsx
//   Enter/Space activation + Escape dismissal + rename commit/revert  → POIContextMenu.test.jsx
//   open-focus/rove machinery unit behavior is pinned HERE through both hosts
//   (the indoor faces live in ../map/ItemContextMenu.keyboard.test.jsx).
import { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import POIContextMenu from './POIContextMenu.jsx';

const BASE_POI = { id: 'poi-1', type: 'city', q: 0, r: 0, label: 'City A', visible: true, linkedMap: null };
const SELECTED = { id: 'poi-1', q: 0, r: 0 };

describe('POIContextMenu keyboard tier (useMenuRoving)', () => {
    let defaultProps;
    beforeEach(() => {
        defaultProps = {
            selectedPoi: SELECTED,
            pois: [BASE_POI],
            onToggleVisibility: vi.fn(),
            onDelete: vi.fn(),
            onRename: vi.fn(),
            onLinkMap: vi.fn(),
            onUnlinkMap: vi.fn(),
            onRemoveRoads: vi.fn(),
            setShowRename: vi.fn(),
            onClose: vi.fn(),
            indoorMaps: [],
            viewPortBounds: null,
            roads: [],
        };
    });

    const renderMenu = (props = {}) => render(<POIContextMenu {...defaultProps} {...props} />);

    const menuItems = (container) => Array.from(container.querySelectorAll('[role="menuitem"]'));

    const expectNoHandlers = () => {
        Object.values(defaultProps)
            .filter((v) => typeof v === 'function')
            .forEach((fn) => expect(fn).not.toHaveBeenCalled());
    };

    describe('focus on open', () => {
        it('opening the menu moves focus into the first entry with zero activation', () => {
            renderMenu();
            expect(document.activeElement).toBe(
                screen.getByRole('menuitem', { name: 'Hide', exact: true })
            );
            expectNoHandlers();
        });

        it('re-opening after a dismissal (null → selected) re-focuses the first entry', () => {
            const { rerender } = renderMenu({ selectedPoi: null });
            expect(document.activeElement).toBe(document.body);
            rerender(<POIContextMenu {...defaultProps} />);
            expect(document.activeElement).toBe(
                screen.getByRole('menuitem', { name: 'Hide', exact: true })
            );
            expectNoHandlers();
        });

        it('opening while the rename editor is armed leaves focus on the input (autoFocus not stolen)', () => {
            renderMenu({ showRename: 'poi-1' });
            expect(document.activeElement).toBe(screen.getByRole('textbox'));
            expectNoHandlers();
        });
    });

    describe('arrow-key roving navigation', () => {
        it('ArrowDown/ArrowUp walk the rows and wrap at both ends', () => {
            const { container } = renderMenu();
            const rows = menuItems(container); // Hide, Rename, Link to Map..., Delete, ✕
            expect(rows.map((r) => r.textContent.trim())).toEqual([
                'Hide', 'Rename', 'Link to Map...', 'Delete', '✕',
            ]);
            expect(document.activeElement).toBe(rows[0]);
            fireEvent.keyDown(rows[0], { key: 'ArrowDown' });
            expect(document.activeElement).toBe(rows[1]);
            fireEvent.keyDown(rows[1], { key: 'ArrowDown' });
            expect(document.activeElement).toBe(rows[2]);
            fireEvent.keyDown(rows[2], { key: 'ArrowDown' });
            expect(document.activeElement).toBe(rows[3]);
            fireEvent.keyDown(rows[3], { key: 'ArrowDown' });
            expect(document.activeElement).toBe(rows[4]);
            fireEvent.keyDown(rows[4], { key: 'ArrowDown' }); // wrap to top
            expect(document.activeElement).toBe(rows[0]);
            fireEvent.keyDown(rows[0], { key: 'ArrowUp' }); // wrap to bottom
            expect(document.activeElement).toBe(rows[4]);
        });

        it('ArrowRight/ArrowLeft navigate too, and Home/End jump to the ends', () => {
            const { container } = renderMenu();
            const rows = menuItems(container);
            fireEvent.keyDown(rows[0], { key: 'ArrowRight' });
            expect(document.activeElement).toBe(rows[1]);
            fireEvent.keyDown(rows[1], { key: 'ArrowLeft' });
            expect(document.activeElement).toBe(rows[0]);
            fireEvent.keyDown(rows[0], { key: 'End' });
            expect(document.activeElement).toBe(rows[4]);
            fireEvent.keyDown(rows[4], { key: 'Home' });
            expect(document.activeElement).toBe(rows[0]);
        });

        it('arrowing from the menu root (focus not on a row) starts at the top and never fires a handler', () => {
            const { container } = renderMenu();
            document.activeElement.blur();
            fireEvent.keyDown(container.querySelector('.poi-context-menu'), { key: 'ArrowDown' });
            expect(document.activeElement).toBe(
                screen.getByRole('menuitem', { name: 'Hide', exact: true })
            );
            expectNoHandlers();
        });

        it('ArrowDown is preventDefault-ed (the page never scrolls behind the menu)', () => {
            renderMenu();
            const row = screen.getByRole('menuitem', { name: 'Hide', exact: true });
            const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
            row.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(
                screen.getByRole('menuitem', { name: 'Rename', exact: true })
            );
            expectNoHandlers();
        });

        it('the rove re-queries rows per commit face: an opened link picker joins the walk', () => {
            const { container } = renderMenu({ indoorMaps: ['dungeon-map.json'] });
            fireEvent.click(screen.getByText('Link to Map...'));
            const rows = menuItems(container); // ..., Link to Map..., Dungeon Map, Delete, ✕
            expect(rows.map((r) => r.textContent.trim())).toEqual([
                'Hide', 'Rename', 'Link to Map...', 'Dungeon Map', 'Delete', '✕',
            ]);
            const linkRow = screen.getByRole('menuitem', { name: 'Link to Map...', exact: true });
            linkRow.focus();
            fireEvent.keyDown(linkRow, { key: 'ArrowDown' });
            expect(document.activeElement).toBe(
                screen.getByRole('menuitem', { name: 'Dungeon Map', exact: true })
            );
            fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' });
            expect(document.activeElement).toBe(
                screen.getByRole('menuitem', { name: 'Delete', exact: true })
            );
        });

        it('a focused row answers exactly one Enter after arrow navigation (rename lane live shape)', () => {
            renderMenu();
            const rows = menuItems(document.body);
            fireEvent.keyDown(rows[0], { key: 'ArrowDown' }); // Hide → Rename
            expect(document.activeElement).toBe(rows[1]);
            fireEvent.keyDown(rows[1], { key: 'Enter' });
            expect(defaultProps.setShowRename).toHaveBeenCalledTimes(1);
            expect(defaultProps.setShowRename).toHaveBeenCalledWith('poi-1');
            expect(defaultProps.onClose).not.toHaveBeenCalled();
        });

        it('the hex visibility lane (activating closes the menu) leaves a roved row firing exactly one activation', () => {
            renderMenu();
            const rows = menuItems(document.body);
            fireEvent.keyDown(rows[0], { key: 'End' }); // walk to ✕
            expect(document.activeElement).toBe(rows[4]);
            fireEvent.keyDown(rows[4], { key: 'Enter' });
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
            expect(defaultProps.onToggleVisibility).not.toHaveBeenCalled();
        });
    });

    describe('rename input keeps its own keys', () => {
        // Stateful parent mirrors HexMap.jsx: Rename arms showRename while the
        // menu stays mounted, then the input owns arrows/Home/End.
        function Board() {
            const [renameId, setRenameId] = useState(null);
            return (
                <POIContextMenu
                    {...defaultProps}
                    showRename={renameId}
                    setShowRename={setRenameId}
                />
            );
        }

        it('Enter on a roved-to Rename row moves focus into the editor and rove keys stay native there', () => {
            const { container } = render(<Board />);
            const hideRow = screen.getByRole('menuitem', { name: 'Hide', exact: true });
            expect(document.activeElement).toBe(hideRow);
            fireEvent.keyDown(hideRow, { key: 'ArrowDown' });
            fireEvent.keyDown(document.activeElement, { key: 'Enter' }); // Rename
            const input = container.querySelector('input.context-menu-input');
            expect(input).toBeInTheDocument();
            expect(document.activeElement).toBe(input);
            // Arrows inside the input are NOT rove/preventDefault-ed (caret movement).
            const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
            input.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
            expect(document.activeElement).toBe(input);
            // Home/End likewise.
            const endEvent = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true });
            input.dispatchEvent(endEvent);
            expect(endEvent.defaultPrevented).toBe(false);
            expect(document.activeElement).toBe(input);
        });
    });

    describe('focus restore on close (useMenuRoving restore tier, XF backlog 2026-11-16)', () => {
        // Anchor stands in for whatever had focus before the pointer opened
        // the menu (sidebar button, hit-area neighbour…). Appended to body,
        // outside the svg, like real page chrome.
        const focusAnchor = () => {
            const anchor = document.createElement('button');
            anchor.textContent = 'pre-open anchor';
            anchor.dataset.focusAnchor = '';
            document.body.appendChild(anchor);
            anchor.focus();
            return anchor;
        };
        afterEach(() => {
            document.querySelectorAll('[data-focus-anchor]').forEach((el) => el.remove());
        });

        // Stateful parent mirrors HexMap.jsx: onClose nulls selectedPoiMenu
        // AND showRename together — EVERY dismissal path funnels through that
        // single menuOpen true→false transition, which is what the hook keys
        // its restore on.
        function Board({ poiProps = {} } = {}) {
            const [selected, setSelected] = useState(SELECTED);
            const [renameId, setRenameId] = useState(null);
            return (
                <svg data-testid="hex-board">
                    <POIContextMenu
                        {...defaultProps}
                        {...poiProps}
                        selectedPoi={selected}
                        showRename={renameId}
                        setShowRename={setRenameId}
                        onClose={() => { setSelected(null); setRenameId(null); }}
                    />
                </svg>
            );
        }

        const row = (name) => screen.getByRole('menuitem', { name, exact: true });
        // Restore lands in a microtask (so same-commit autoFocus wins) — let
        // it run before asserting.
        const flushRestore = () => act(async () => {});

        it('Escape dismiss returns focus to the pre-open anchor, not body', async () => {
            const anchor = focusAnchor();
            render(<Board />);
            expect(document.activeElement).toBe(row('Hide'));
            fireEvent.keyDown(document.activeElement, { key: 'Escape' });
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
            await flushRestore();
            expect(document.activeElement).toBe(anchor);
        });

        it('menu-item activation (Hide closes the hex lane) returns focus to the pre-open anchor', async () => {
            const anchor = focusAnchor();
            render(<Board />);
            fireEvent.keyDown(row('Hide'), { key: 'Enter' });
            expect(defaultProps.onToggleVisibility).toHaveBeenCalledTimes(1);
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
            await flushRestore();
            expect(document.activeElement).toBe(anchor);
        });

        it('the ✕ close row returns focus to the pre-open anchor', async () => {
            const anchor = focusAnchor();
            render(<Board />);
            fireEvent.keyDown(row('✕'), { key: 'Enter' });
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
            await flushRestore();
            expect(document.activeElement).toBe(anchor);
        });

        it('rename-commit (Enter in the editor) restores to the anchor and rename-arming alone does not', async () => {
            const anchor = focusAnchor();
            const { container } = render(<Board />);
            fireEvent.keyDown(row('Rename'), { key: 'Enter' });
            const input = container.querySelector('input.context-menu-input');
            expect(document.activeElement).toBe(input);
            // Arming the editor nulls openKey while the menu stays mounted:
            // the restore must NOT pull focus out of the live input.
            await flushRestore();
            expect(document.activeElement).toBe(input);
            fireEvent.keyDown(input, { key: 'Enter' });
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
            await flushRestore();
            expect(document.activeElement).toBe(anchor);
        });

        it('rename-revert (Escape in the editor) restores to the anchor with zero rename writes', async () => {
            const anchor = focusAnchor();
            const { container } = render(<Board />);
            fireEvent.keyDown(row('Rename'), { key: 'Enter' });
            const input = container.querySelector('input.context-menu-input');
            fireEvent.keyDown(input, { key: 'Escape' });
            expect(defaultProps.onRename).not.toHaveBeenCalled();
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
            await flushRestore();
            expect(document.activeElement).toBe(anchor);
        });

        it('a dismiss after a body-focus open lands on the board svg fallback (tabindex=-1), never throws', async () => {
            const { getByTestId } = render(<Board />);
            expect(document.activeElement).toBe(row('Hide'));
            fireEvent.keyDown(document.activeElement, { key: 'Escape' });
            await flushRestore();
            const board = getByTestId('hex-board');
            expect(board).toHaveAttribute('tabindex', '-1');
            expect(document.activeElement).toBe(board);
        });

        it('a dismiss after the anchor died mid-ride falls back to the board svg instead of throwing', async () => {
            const anchor = focusAnchor();
            render(<Board />);
            fireEvent.keyDown(row('Hide'), { key: 'Enter' }); // menu closed in state
            anchor.remove(); // anchor detached before the restore microtask lands
            await flushRestore();
            expect(document.activeElement).toBe(screen.getByTestId('hex-board'));
        });
    });
});
