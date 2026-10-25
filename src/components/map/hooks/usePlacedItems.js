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

function usePlacedItems(setPlacedItems, setSelectedItem, placedItems) {
    const handleToggleItemVisibility = (itemId) => {
        setPlacedItems(prev =>
            prev.map(item =>
                item.id === itemId ? { ...item, visible: !item.visible } : item
            )
        );
    };

    // Named-confirm before removal (house pattern: `Delete "<name>" from ...?`,
    // cf. PartyInventory's party-inventory twin). Cancel is fully inert: the
    // token stays on the board AND no setPlacedItems write reaches the map's
    // autosave PUT lane. Accept filters placedItems; useMapLoader's debounce
    // persists the filtered array via saveMapData (PUT /maps/:name).
    const handleDeleteItem = (itemId) => {
        const item = (placedItems || []).find(i => i.id === itemId);
        if (!window.confirm(`Delete "${placedItemLabel(item)}" from the map?`)) return;
        setPlacedItems(prev => prev.filter(i => i.id !== itemId));
        setSelectedItem(null);
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
    };
}

export default usePlacedItems;
