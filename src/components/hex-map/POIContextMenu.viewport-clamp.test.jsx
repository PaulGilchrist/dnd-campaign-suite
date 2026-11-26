// @maintained-by-ai 2026-11-17
// ─── Lane: POIContextMenu — viewport clamp law ───────────────────────────────
// Backlog 2026-11-17 (indoor ItemContextMenu viewport-clamp improve): the
// shared law — a context menu anchored on a token/POI low on the board must
// clamp its origin into the viewport so the ENTIRE menu (Delete, Remove Roads,
// the open link picker included) renders inside the visible board. The hex
// menu already ships this clamp; this lane PINS it so the indoor twin and this
// sibling can never drift apart:
//   menuY ∈ [top + 4, bottom − menuHeight − 4], menuX ∈ [left + 4,
//   right − MENU_WIDTH − 4]; origin untouched when it already fits.
//
// NOT OWNED — cited to owner lanes:
//   option census / dispatch / rename editor → POIContextMenu.test.jsx
//   rove/open-focus/focus-restore tier       → POIContextMenu.keyboard.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import POIContextMenu from './POIContextMenu.jsx';
import { HEX_SIZE } from '../../config/outdoorConfig';
import { hexToPixel } from '../../services/maps/hexMapUtils';

const BASE_POI = { id: 'poi-1', type: 'city', q: 0, r: 0, label: 'City A', visible: true, linkedMap: null };

// 1200×941 visible world rect at the page origin — the jsdom analog of the
// live 941-px viewport from the backlog measurement.
const BOUNDS = { left: 0, top: 0, right: 1200, bottom: 941 };

const defaultProps = () => ({
    selectedPoi: { id: 'poi-1', q: 0, r: 0 },
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
    viewPortBounds: BOUNDS,
    roads: [],
});

const renderMenu = (props = {}, base = defaultProps()) => {
    const utils = render(<POIContextMenu {...base} {...props} />);
    return { ...utils, base };
};

const panelRect = (container) => container.querySelector('.poi-context-menu rect');
const rectAttrs = (el) => ['x', 'y', 'width', 'height'].reduce(
    (acc, a) => ({ ...acc, [a]: Number(el.getAttribute(a)) }), {});
const rowBaseline = (container, label) => {
    const row = [...container.querySelectorAll('.poi-context-menu [role="menuitem"]')]
        .find(r => r.textContent.trim() === label);
    return Number(row.querySelector('text').getAttribute('y'));
};

// Raw (pre-clamp) anchor the component derives from the POI hex center.
const rawAnchor = (q, r) => {
    const c = hexToPixel(q, r, HEX_SIZE);
    return { x: c.x + 10, y: c.y + 10 };
};

describe('viewport clamp — menu fully inside the visible board', () => {
    it('POI low on the board: panel bottom AND the last row clamp above the viewport bottom', () => {
        // q=0 r=20 → center y = 45*20 = 900 → raw menuY 910; the 4-row menu
        // (height 4*22+8 = 96) would end at 1006 — below the 941 fold.
        const low = { id: 'poi-1', q: 0, r: 20 };
        const { container, base } = renderMenu({
            selectedPoi: low,
            pois: [{ ...BASE_POI, q: 0, r: 20 }],
        });
        const rect = rectAttrs(panelRect(container));
        // Clamp: bottom − height − 4 = 941 − 96 − 4 = 841.
        expect(rect.y).toBe(841);
        expect(rect.y).toBeLessThan(rawAnchor(0, 20).y);
        expect(rect.y + rect.height).toBeLessThanOrEqual(BOUNDS.bottom);
        // Delete is the last row of an unlinked, road-free POI (menuY + 86).
        expect(rowBaseline(container, 'Delete')).toBe(841 + 86);
        expect(base.onDelete).not.toHaveBeenCalled();
    });

    it('Remove Roads row (extra row) keeps the taller menu clamped too', () => {
        const { container } = renderMenu({
            selectedPoi: { id: 'poi-1', q: 0, r: 20 },
            pois: [{ ...BASE_POI, q: 0, r: 20 }],
            roads: [{ fromPoiId: 'poi-1', toPoiId: 'poi-2' }],
        });
        const rect = rectAttrs(panelRect(container));
        // 5 rows → height 5*22+8 = 118 → clamp to 941 − 118 − 4 = 819.
        expect(rect.y).toBe(819);
        expect(rect.y + rect.height).toBeLessThanOrEqual(BOUNDS.bottom);
        expect(rowBaseline(container, 'Remove Roads (1)')).toBe(819 + 108);
    });

    it('opening the link picker near the bottom re-clamps the grown menu upward', () => {
        const { container } = renderMenu({
            selectedPoi: { id: 'poi-1', q: 0, r: 20 },
            pois: [{ ...BASE_POI, q: 0, r: 20 }],
            indoorMaps: ['dungeon-map.json'],
        });
        fireEvent.click(screen.getByText('Link to Map...'));
        const rect = rectAttrs(panelRect(container));
        // 1-item picker grows the menu by 1*20 + 8 = 28 → height 124 →
        // clamp to 941 − 124 − 4 = 813, and the picker + Delete rows ride up.
        expect(rect.y + rect.height).toBeLessThanOrEqual(BOUNDS.bottom);
        expect(rect.y).toBe(813);
        expect(rowBaseline(container, 'Delete')).toBe(813 + 86 + 20);
        expect(rowBaseline(container, 'Dungeon Map')).toBe(813 + 86 + 14);
    });

    it('menu at the top/right edge clamps back into view (same brackets as Y)', () => {
        const { container } = renderMenu({
            selectedPoi: { id: 'poi-1', q: 40, r: -20 },
            pois: [{ ...BASE_POI, q: 40, r: -20 }],
            viewPortBounds: { left: 200, top: 300, right: 1400, bottom: 1200 },
        });
        const raw = rawAnchor(40, -20);
        const rect = rectAttrs(panelRect(container));
        expect(rect.y).toBe(304); // top + 4 wins over the raw anchor above view
        expect(rect.x).toBe(Math.max(204, Math.min(raw.x, 1400 - 160 - 4)));
        expect(rect.y).toBeGreaterThanOrEqual(300);
    });
});

describe('unchanged when the menu fits (no regression near the top/middle)', () => {
    it('room below → raw anchor byte-identical to the unclamped placement', () => {
        const { container } = renderMenu({
            selectedPoi: { id: 'poi-1', q: 0, r: 5 },
            pois: [{ ...BASE_POI, q: 0, r: 5 }],
        });
        const raw = rawAnchor(0, 5);
        const rect = rectAttrs(panelRect(container));
        expect(rect).toEqual({ x: raw.x, y: raw.y, width: 160, height: 96 });
    });

    it('null viewPortBounds → raw anchor (host without bounds keeps old placement)', () => {
        const { container } = renderMenu({
            selectedPoi: { id: 'poi-1', q: 0, r: 20 },
            pois: [{ ...BASE_POI, q: 0, r: 20 }],
            viewPortBounds: null,
        });
        expect(rectAttrs(panelRect(container)).y).toBe(rawAnchor(0, 20).y);
    });
});
