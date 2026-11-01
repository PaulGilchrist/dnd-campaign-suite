// @maintained-by-ai
// ─── Lane: placed-token DELETE via the item context menu ──────────────────────
// OWNED here — the end-to-end removal affordance for a placedItems token:
//   - GM (localhost): right-click token → menu offers Delete → clicking Delete
//     opens the IN-APP named modal (backlog 2026-11-01 AZ2: replaces the native
//     window.confirm) — role="dialog" + aria-modal, heading "Delete from Map",
//     copy naming the token verbatim (`Delete "QA Marta" from the map?`).
//     Confirming removes it from the board immediately AND persists: the app's
//     own PUT lane (useMapLoader autosave → mapsService.saveMapData →
//     PUT /maps/:name) receives the filtered placedItems. The real useMapLoader
//     is mounted here (only mapsService is mocked) so the persistence claim is
//     pinned through the same code the running app uses — not a mocked setter.
//   - Cancel/× is inert: the token stays on the board, every PUT payload the
//     lane emits still carries the token, and no native confirm ever fires.
//   - LAN player (non-localhost): NO delete affordance renders at all —
//     tokens carry no context hit-area, right-click opens no menu.
//
// NOT OWNED — cited to owner lanes:
//   dialog a11y tier (focus-in/Tab-trap)             → common/DeleteConfirmModal.test.jsx
//   descriptor→copy mapping + Remove verb           → DeleteFromMapModal.test.jsx
//   label descriptor bytes at the hook seam         → hooks/usePlacedItems.test.js
//   menu label census + per-entry dispatch          → ItemContextMenu.test.jsx
//   right-click select payload + defaultPrevented   → PlacedItems-event-handlers.test.jsx
//   container anchor/swap/close wiring              → Map-context-menus.test.jsx
//   autosave debounce mechanics (walls, load, clobber) → hooks/useMapLoader.test.js
import { render, fireEvent, act, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Map from './Map.jsx';
import { clearRuntimeState } from '../../hooks/runtime/useRuntimeState.js';

class MockEventSource {
    static instances = [];
    constructor() {
        this.onmessage = null;
        this.onerror = null;
        MockEventSource.instances.push(this);
    }
    close() {}
}
globalThis.EventSource = MockEventSource;

globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true }));

const npcToken = { id: 'npc-qa', type: 'npc', name: 'QA Marta', gridX: 5, gridY: 5, visible: true };

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadMonsters: () => Promise.resolve([]),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(() => Promise.resolve(null)),
    saveMapData: vi.fn(() => Promise.resolve({})),
    formatMapName: vi.fn((name) => name),
    loadMaps: vi.fn(() => Promise.resolve({ maps: [] })),
}));

import * as mapsService from '../../services/maps/mapsService.js';

vi.mock('../../hooks/runtime/useLog.js', () => ({
    default: vi.fn(() => ({ logEntries: [], initialized: true, addEntry: vi.fn() })),
}));

const gridCenterX = (gx) => gx * 40 + 20;
const gridCenterY = (gy) => gy * 40 + 20;

vi.mock('./hooks/useZoomPan.js', () => ({
    default: vi.fn(() => ({
        zoom: 1,
        panX: 0,
        panY: 0,
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        resetView: vi.fn(),
        gridCenterX,
        gridCenterY,
        getGridFromEvent: vi.fn(() => ({ gridX: 5, gridY: 5 })),
        panning: false,
        handlePanStart: vi.fn(),
        handlePanMove: vi.fn(),
        handlePanEnd: vi.fn(),
        handleWheel: vi.fn(),
        clientToSVG: vi.fn(),
    })),
}));

vi.mock('./hooks/useWallDrawing.js', () => ({
    default: vi.fn(() => ({
        painting: false,
        handleGridPointerDown: vi.fn(),
        handleGridPointerMove: vi.fn(),
        handleGridPointerUp: vi.fn(),
        handleGridPointerLeave: vi.fn(),
    })),
}));

vi.mock('./hooks/useSelectMove.js', () => ({
    default: vi.fn(() => ({
        selectionRect: null,
        selectedWalls: new Set(),
        selectedItems: new Set(),
        moveOffset: null,
        selectedWallsRef: { current: new Set() },
        selectedItemsRef: { current: new Set() },
        selectStart: { current: null },
        moveStartGrid: { current: null },
        placedItemsRef: { current: [] },
        mapDataRef: { current: null },
        handleSelectPointerDown: vi.fn(),
        handleSelectPointerMove: vi.fn(),
        handleSelectPointerUp: vi.fn(),
    })),
}));

vi.mock('./hooks/useRuler.js', () => ({
    default: vi.fn(() => ({
        rulerMode: false,
        setRulerMode: vi.fn(),
        rulerStart: null,
        rulerEnd: null,
        rulerPreview: null,
        resetRuler: vi.fn(),
        handleRulerPointerDown: vi.fn(),
        handleRulerPointerMove: vi.fn(),
        handleRulerPointerUp: vi.fn(),
    })),
}));

vi.mock('./hooks/useSpellOverlay.js', () => ({
    default: vi.fn(() => ({
        overlays: [],
        addOverlay: vi.fn(),
        updateOverlay: vi.fn(),
        updateOverlayImmediate: vi.fn(),
        removeOverlay: vi.fn(),
        clearOverlays: vi.fn(),
        handleSSEEvent: vi.fn(),
    })),
}));

vi.mock('./hooks/useSpellHandlers.js', () => ({
    default: vi.fn(() => ({
        spellDraft: null,
        dragOverlay: null,
        rotateOverlay: null,
        spellDragActiveRef: { current: false },
        handleSpellPointerDown: vi.fn(),
        handleSpellPointerMove: vi.fn(),
        handleSpellPointerUp: vi.fn(),
        handleSpellDragMove: vi.fn(),
        handleSpellDragEnd: vi.fn(),
    })),
}));

vi.mock('./hooks/usePlayerDragging.js', () => ({
    default: vi.fn(() => ({
        dragging: null,
        handlePointerDown: vi.fn(),
        handlePointerMove: vi.fn(),
        handlePointerUp: vi.fn(),
    })),
}));

vi.mock('./hooks/useItemDragging.js', () => ({
    default: vi.fn(() => ({
        itemDragging: null,
        handleItemPointerDown: vi.fn(),
        handleItemPointerMove: vi.fn(),
        handleItemPointerUp: vi.fn(),
        handleItemPointerLeave: vi.fn(),
    })),
}));

vi.mock('./hooks/useSSESync.js', () => ({
    default: vi.fn(() => ({ handleSSEEvent: vi.fn() })),
}));

vi.mock('./hooks/useFogOfWar.js', () => ({
    default: vi.fn(() => ({ fog: new Set(), visible: new Set() })),
}));

vi.mock('./hooks/useMapDrops.js', () => ({
    default: vi.fn(() => ({ handleDrop: vi.fn() })),
}));

vi.mock('../hex-map/HexMap.jsx', () => ({ default: vi.fn(() => <div data-testid="hex-map" />) }));

vi.mock('../encounter/MonsterCardModal.jsx', () => ({
    default: () => <div data-testid="monster-card-modal" />,
}));

const renderMap = (overrides = {}) =>
    render(
        <Map
            campaignName="test-campaign"
            characters={[]}
            isLocalhost
            mapName="battle-arena"
            onBack={vi.fn()}
            onEncounterCreated={vi.fn()}
            onPoiEntered={vi.fn()}
            {...overrides}
        />
    );

// useMapLoader's AUTOSAVE_DEBOUNCE_MS is 1000 — real timers here: the PUT is
// the lane's own scheduled save, not a hand-rolled flush.
const settleAutosave = () => act(async () => { await new Promise(r => setTimeout(r, 1300)); });

const npcHitAreas = (container) => container.querySelectorAll('g.npc-group rect[fill="transparent"]');

let confirmSpy;

const openDeleteDialog = async (container) => {
    await act(async () => { fireEvent.contextMenu(npcHitAreas(container)[0]); });
    await act(async () => { fireEvent.click(screen.getByText('Delete')); });
    return screen.getByRole('dialog', { name: 'Delete from Map' });
};

describe('placed-token delete via context menu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
        clearRuntimeState('campaign');
        MockEventSource.instances.length = 0;
        mapsService.loadMapData.mockResolvedValue({
            players: [],
            walls: [],
            revealed: [],
            gridSize: 30,
            placedItems: [npcToken],
        });
        mapsService.saveMapData.mockResolvedValue({});
        // The seam must NEVER ask a native confirm (backlog 2026-11-01 AZ2):
        // spy true so an accidental confirm would silently proceed — the
        // not.toHaveBeenCalled assertions are the real pin.
        confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    afterEach(() => {
        confirmSpy.mockRestore();
    });

    it('GM: Delete menu option opens the named in-app dialog — no native confirm', async () => {
        const { container } = await act(async () => renderMap());
        await settleAutosave();

        const dialog = await openDeleteDialog(container);

        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveTextContent('Delete "QA Marta" from the map?');
        expect(confirmSpy).not.toHaveBeenCalled();
        // Nothing written yet — the token is still on the board while the
        // dialog is open, and focus started inside the dialog on Cancel.
        expect(container.querySelectorAll('g.npc-group')).toHaveLength(1);
        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });

    it('GM: confirming the dialog filters placedItems exactly once and persists through the autosave PUT lane', async () => {
        const { container } = await act(async () => renderMap());
        await settleAutosave();

        await openDeleteDialog(container);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Yes, Delete' }));
        });

        // Token gone from the board, dialog dismissed, menu closed.
        expect(container.querySelectorAll('g.npc-group')).toHaveLength(0);
        expect(screen.queryByRole('dialog', { name: 'Delete from Map' })).not.toBeInTheDocument();
        expect(container.querySelectorAll('.item-context-menu')).toHaveLength(0);

        // The lane already has an autosave schedule (mount save carries the token);
        // the delete write must produce a LATER save with placedItems filtered.
        await settleAutosave();
        expect(mapsService.saveMapData).toHaveBeenCalled();
        const lastPayload = mapsService.saveMapData.mock.calls.at(-1)[2];
        expect(lastPayload.placedItems).toEqual([]);
        // Flat document on the PUT (double-wrap poison trap guard):
        expect(lastPayload.map).toBeUndefined();
    });

    it('GM: canceling the dialog is inert — token stays on board and in every persisted payload', async () => {
        const { container } = await act(async () => renderMap());
        await settleAutosave();

        await openDeleteDialog(container);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        });

        expect(screen.queryByRole('dialog', { name: 'Delete from Map' })).not.toBeInTheDocument();
        expect(container.querySelectorAll('g.npc-group')).toHaveLength(1);
        expect(confirmSpy).not.toHaveBeenCalled();
        await settleAutosave();
        // No save ever drops the token (mount autosave keeps it — disk intact).
        mapsService.saveMapData.mock.calls.forEach(([, , payload]) =>
            expect(payload.placedItems).toEqual([expect.objectContaining({ id: 'npc-qa' })])
        );
    });

    it('LAN player: no delete affordance renders — no hit-area, no menu on right-click', async () => {
        const { container } = await act(async () => renderMap({ isLocalhost: false }));
        await settleAutosave();

        expect(container.querySelectorAll('g.npc-group')).toHaveLength(1);
        // Tokens render for players but carry no context hit-area (GM-only chrome).
        expect(npcHitAreas(container)).toHaveLength(0);
        const npcGroup = container.querySelector('g.npc-group');
        await act(async () => { fireEvent.contextMenu(npcGroup); });
        expect(container.querySelectorAll('.item-context-menu')).toHaveLength(0);
        expect(screen.queryByText('Delete')).not.toBeInTheDocument();
        // And the read-only lane never PUTs.
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
    });
});
