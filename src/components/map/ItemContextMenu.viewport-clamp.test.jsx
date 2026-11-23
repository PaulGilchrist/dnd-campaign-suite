// @maintained-by-ai
// ─── Lane: ItemContextMenu — viewport clamp law ──────────────────────────────
// Backlog 2026-11-17 (live FI): a token low on the board anchored the SVG menu
// so its tail rows rendered BELOW the visible board — clipped by the svg
// viewport, unreachable by mouse (locator clicks intercepted on `.map`). The
// menu now clamps its origin into `viewPortBounds` — the visible world rect
// (the viewBox) that Map.jsx computes — carrying the SAME law the hex
// POIContextMenu has shipped:
//   menuY ∈ [top + 4, bottom − height − 4] (and menuX ∈ [left + 4,
//   right − MENU_WIDTH − 4]); an origin that already fits is untouched.
// Because every row offset is menuY-relative, clamping the origin keeps the
// WHOLE menu — last entry included — inside the viewport.
//
// NOT OWNED — cited to owner lanes:
//   label census / dispatch args / panel heights → ItemContextMenu.test.jsx
//   rove/open-focus/focus-restore tier           → ItemContextMenu.keyboard.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ItemContextMenu from './ItemContextMenu';

const gridCenterX = (gx) => gx * 40 + 20;
const gridCenterY = (gy) => gy * 40 + 20;

const mocks = () => ({
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

const renderMenu = (props = {}, m = mocks()) => {
    const utils = render(
        <svg>
            <ItemContextMenu
                selectedItem={{ id: 'item-1', gridX: 0, gridY: 0 }}
                placedItems={[placedItem()]}
                gridCenterX={gridCenterX}
                gridCenterY={gridCenterY}
                monsterFound={false}
                {...m}
                {...props}
            />
        </svg>
    );
    return { ...utils, m };
};

const panelRect = (container) => container.querySelector('.item-context-menu rect');
const attrs = (el) => ['x', 'y', 'width', 'height'].reduce(
    (acc, a) => ({ ...acc, [a]: Number(el.getAttribute(a)) }), {});
// Baselines of every row (entries + ✕) — the last one is what was off-fold.
const rowBaselines = (container) =>
    [...container.querySelectorAll('.item-context-menu text')].map(t => Number(t.getAttribute('y')));

// A board whose visible world rect is 1200×800 at the page top (jsdom analog of
// the live 941-px viewport: rows must land above `bottom`).
const BOUNDS = { left: 0, top: 0, right: 1200, bottom: 800 };

describe('viewport clamp — menu fully inside the visible board', () => {
    it('token low on the board: panel AND every row baseline stay within the viewport bottom', () => {
        // npc + found monster → tallest family (height 138 with the plan-C
        // Light row). gridY 18 anchors raw menuY = 18*40+20+10 = 750;
        // 750 + 138 overflows the 800 bottom.
        const { container } = renderMenu({
            selectedItem: { id: 'item-1', gridX: 0, gridY: 18 },
            placedItems: [placedItem({ type: 'npc' })],
            monsterFound: true,
            viewPortBounds: BOUNDS,
        });
        const rect = attrs(panelRect(container));
        // Clamped to bottom − height − 4 = 800 − 138 − 4 = 658.
        expect(rect.y).toBe(658);
        expect(rect.y + rect.height).toBeLessThanOrEqual(BOUNDS.bottom);
        expect(rect.y).toBeGreaterThanOrEqual(BOUNDS.top);
        // Last entry (View Stats at menuY + 108 — one row lower since the
        // Light row joined; Rotate never renders for creature tokens) lands
        // fully inside.
        const maxBaseline = Math.max(...rowBaselines(container));
        expect(maxBaseline).toBe(658 + 108);
        expect(maxBaseline).toBeLessThanOrEqual(BOUNDS.bottom);
    });

    it('a menu taller than the viewport pins to the TOP edge (top ≥ 0, never a negative origin)', () => {
        const { container } = renderMenu({
            selectedItem: { id: 'item-1', gridX: 0, gridY: 40 },
            viewPortBounds: { left: 0, top: 50, right: 1200, bottom: 90 },
        });
        // bottom − height − 4 is negative (76 too tall for the 40-px slot) —
        // the top bracket wins: 50 + 4.
        expect(attrs(panelRect(container)).y).toBe(54);
    });

    it('menu at the top edge of a panned board clamps DOWN into view (top ≥ 0)', () => {
        const { container } = renderMenu({
            viewPortBounds: { left: 0, top: 200, right: 1200, bottom: 1000 },
        });
        // raw menuY = 30 sits above the visible rect (board panned down).
        expect(attrs(panelRect(container)).y).toBe(204);
    });

    it('menu at the right edge clamps LEFT into view (same x law as the hex menu)', () => {
        const { container } = renderMenu({
            selectedItem: { id: 'item-1', gridX: 6, gridY: 0 },
            viewPortBounds: { left: 0, top: 0, right: 300, bottom: 1000 },
        });
        // raw menuX = 270; 300 − 120 (width) − 4 = 176.
        expect(attrs(panelRect(container)).x).toBe(176);
    });
});

describe('unchanged when the menu fits (no regression near the top/middle)', () => {
    it('room below → byte-identical origin and rows to the unclamped anchor', () => {
        const { container } = renderMenu({
            selectedItem: { id: 'item-1', gridX: 5, gridY: 10 },
            viewPortBounds: BOUNDS,
        });
        const rect = attrs(panelRect(container));
        expect(rect).toEqual({
            x: gridCenterX(5) + 10,
            y: gridCenterY(10) + 10,
            width: 120,
            height: 76,
        });
        expect(rowBaselines(container)).toEqual([rect.y + 20, rect.y + 42, rect.y + 64, rect.y + 12]);
    });

    it('absent viewPortBounds → raw anchor (host without bounds keeps the old placement)', () => {
        const { container } = renderMenu({
            selectedItem: { id: 'item-1', gridX: 0, gridY: 18 },
        });
        expect(attrs(panelRect(container)).y).toBe(750);
    });
});

describe('keyboard tier survives the clamp (criterion: existing law unchanged)', () => {
    it('a clamped-open menu still pulls focus into the first entry, arrowing roves the rows', () => {
        const { container } = renderMenu({
            selectedItem: { id: 'item-1', gridX: 0, gridY: 18 },
            viewPortBounds: BOUNDS,
        });
        const rows = [...container.querySelectorAll('[role="menuitem"]')];
        expect(document.activeElement).toBe(rows[0]);
        expect(screen.getByRole('menuitem', { name: 'Delete', exact: true })).toBeInTheDocument();
    });
});
