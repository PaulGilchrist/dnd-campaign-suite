function usePlacedItems(setPlacedItems, setSelectedBarrel, setRepositioningId) {
    const handleToggleItemVisibility = (itemId) => {
        setPlacedItems(prev =>
            prev.map(item =>
                item.id === itemId ? { ...item, visible: !item.visible } : item
            )
        );
    };

    const handleDeleteBarrel = (itemId) => {
        setPlacedItems(prev => prev.filter(item => item.id !== itemId));
        setSelectedBarrel(null);
    };

    const handleRepositionBarrel = (itemId) => {
        setRepositioningId(itemId);
        setSelectedBarrel(null);
    };

    const handleRotateTable = (itemId) => {
        setPlacedItems(prev =>
            prev.map(item =>
                item.id === itemId ? { ...item, rotation: (item.rotation || 0) === 0 ? 90 : 0 } : item
            )
        );
        setSelectedBarrel(null);
    };

    const handleRotateBed = (itemId) => {
        setPlacedItems(prev =>
            prev.map(item =>
                item.id === itemId ? { ...item, rotation: ((item.rotation || 0) + 90) % 360 } : item
            )
        );
        setSelectedBarrel(null);
    };

    const handleRotateDoor = (id) => {
        setPlacedItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const currentRotation = item.rotation || 0;
            const newRotation = (currentRotation + 90) % 360;
            return { ...item, rotation: newRotation };
        }));
    };

    const handleRotateSecretDoor = (id) => {
        setPlacedItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const currentRotation = item.rotation || 0;
            const newRotation = (currentRotation + 90) % 360;
            return { ...item, rotation: newRotation };
        }));
    };

    const handleRotateStairs = (id) => {
        setPlacedItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const currentRotation = item.rotation || 0;
            const newRotation = (currentRotation + 90) % 360;
            return { ...item, rotation: newRotation };
        }));
    };

    return {
        handleToggleItemVisibility,
        handleDeleteBarrel,
        handleRepositionBarrel,
        handleRotateTable,
        handleRotateBed,
        handleRotateDoor,
        handleRotateSecretDoor,
        handleRotateStairs,
    };
}

export default usePlacedItems;
