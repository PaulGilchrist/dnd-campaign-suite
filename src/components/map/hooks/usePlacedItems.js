// Human label for a placed token's named-confirm: NPCs carry `name`,
// furniture does not — its type key is the honest identifier there.
function deleteLabel(item) {
    return item?.name || item?.type || 'placed item';
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
        if (!window.confirm(`Delete "${deleteLabel(item)}" from the map?`)) return;
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
