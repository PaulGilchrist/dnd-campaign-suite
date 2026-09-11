export function getSelectionBounds(selectedWalls, selectedItems, placedItems) {
    let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
    for (const key of selectedWalls) {
        const [x, y] = key.split(',').map(Number);
        mnX = Math.min(mnX, x); mxX = Math.max(mxX, x);
        mnY = Math.min(mnY, y); mxY = Math.max(mxY, y);
    }
    for (const id of selectedItems) {
        const item = placedItems.find(i => i.id === id);
        if (item) {
            mnX = Math.min(mnX, item.gridX); mxX = Math.max(mxX, item.gridX);
            mnY = Math.min(mnY, item.gridY); mxY = Math.max(mxY, item.gridY);
        }
    }
    if (mnX === Infinity) return null;
    return { mnX, mxX, mnY, mxY };
}
