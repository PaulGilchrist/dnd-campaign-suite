import { useState, useRef } from 'react';

// Human label for a placed token's named-confirm: NPCs carry `name`,
// furniture does not — its type key is the honest identifier there.
// Exported so the click-details dock (ItemDetailsDock.jsx) names the item
// with byte-identical bytes to the confirm it triggers — one label, one
// source of truth.
//
// Ambiguity fix (backlog 2026-10-25 pm): palette drops stamp EVERY new NPC
// token with the default name 'NPC' (useMapDrops.js), and furniture has no
// name at all — so several placed tokens can share one label in the dock and
// the delete confirm. While a token is still UNNAMED (no name, or the 'NPC'
// palette default) and carries numeric grid coords, disambiguate it by its
// cell: `NPC (12,8)`. A real rename wins (plain name, no coords); items
// without numeric gridX/gridY never gain a suffix, so no `undefined` renders.
const PALETTE_DEFAULT_NAME = 'NPC';

export function placedItemLabel(item) {
    if (!item) return 'placed item';
    const base = item.name || item.type || 'placed item';
    const unnamed = !item.name || item.name === PALETTE_DEFAULT_NAME;
    const hasCell = Number.isFinite(item.gridX) && Number.isFinite(item.gridY);
    if (unnamed && hasCell) {
        return `${base} (${item.gridX},${item.gridY})`;
    }
    return base;
}

// Named-confirm before removal (house pattern `Delete "<name>" from the map?`).
// Backlog 2026-11-01 AZ2: the confirm is no longer a NATIVE window.confirm — a
// delete request STAGES here as a `pendingDelete` descriptor
// { action?, label, confirm } and Map.jsx renders it through DeleteFromMapModal
// (shared DeleteConfirmModal — the same role="dialog" a11y tier as the
// MapsManager "Delete Map" dialog), verbatim copy spirit intact. Cancel
// (cancelDelete) is fully inert: the descriptor's `confirm` closure — the ONLY
// writer — never runs, so no setPlacedItems/setMapData write reaches the map's
// autosave PUT lane and the item survives on disk. Accept (confirmDelete) runs
// it exactly once; useMapLoader's debounce persists the filtered array via
// saveMapData (PUT /maps/:name). `requestDelete` is exported so the player-
// token lane ("Remove from Map", mapData.players) rides the SAME dialog — the
// action verb is the only thing that differs.
function usePlacedItems(setPlacedItems, setSelectedItem, placedItems) {
    const [pendingDelete, setPendingDelete] = useState(null);
    // Ref mirror: the dialog renders from state, but confirm/cancel must act on
    // the EXACTLY-armed descriptor even when invoked in the same tick as the
    // arm (before React commits the state re-render).
    const pendingRef = useRef(null);

    const requestDelete = (descriptor) => {
        pendingRef.current = descriptor;
        setPendingDelete(descriptor);
    };

    const cancelDelete = () => {
        pendingRef.current = null;
        setPendingDelete(null);
    };

    const confirmDelete = () => {
        const pending = pendingRef.current;
        pendingRef.current = null;
        setPendingDelete(null);
        if (pending) pending.confirm();
    };

    const handleToggleItemVisibility = (itemId) => {
        setPlacedItems(prev =>
            prev.map(item =>
                item.id === itemId ? { ...item, visible: !item.visible } : item
            )
        );
    };

    // Unknown ids still arm honestly with the generic 'placed item' label;
    // confirming then writes an inert filter and clears the selection
    // (unchanged seam semantics: the selection-clear rides the confirm).
    const handleDeleteItem = (itemId) => {
        const item = (placedItems || []).find(i => i.id === itemId);
        requestDelete({
            label: placedItemLabel(item),
            confirm: () => {
                setPlacedItems(prev => prev.filter(i => i.id !== itemId));
                setSelectedItem(null);
            },
        });
    };

    const handleRotate = (itemId) => {
        setPlacedItems(prev =>
            prev.map(item =>
                item.id === itemId ? { ...item, rotation: ((item.rotation || 0) + 90) % 360 } : item
            )
        );
    };

    const handleToggleDoor = (itemId) => {
        setPlacedItems(prev =>
            prev.map(item =>
                item.id === itemId && item.type === 'door'
                    ? { ...item, open: !item.open }
                    : item
            )
        );
        setSelectedItem(null);
    };

    return {
        handleToggleItemVisibility,
        handleDeleteItem,
        handleToggleDoor,
        handleRotate,
        requestDelete,
        pendingDelete,
        cancelDelete,
        confirmDelete,
    };
}

export default usePlacedItems;
