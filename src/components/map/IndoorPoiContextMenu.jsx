/**
 * Indoor POI right-click menu (bug-ai-dress-poi-invisible-on-indoor-maps) —
 * the removal/visibility escape hatch the indoor board never had. Anchors and
 * chrome mirror the sibling indoor menus (ItemContextMenu.jsx,
 * PlayerContextMenu.jsx: gridCenter + 10, `.item-context-menu` styles); the
 * named-confirm on Delete mirrors the outdoor lane (POIContextMenu.jsx) so a
 * mis-click cannot silently orphan a POI row. Hex-only rename/link/road rows
 * are deliberately absent: the indoor dress producer authors plain labelled
 * landmark POIs (server dressMap.js addPoi).
 */
function IndoorPoiContextMenu({
    selectedPoi,
    pois,
    gridCenterX,
    gridCenterY,
    handleTogglePoiVisibility,
    handleDeletePoi,
    onClose,
}) {
    if (!selectedPoi) return null;
    const poi = (Array.isArray(pois) ? pois : []).find(p => p.id === selectedPoi.id);
    if (!poi) return null;

    const menuX = gridCenterX(selectedPoi.gridX) + 10;
    const menuY = gridCenterY(selectedPoi.gridY) + 10;
    const hidden = poi.visible === false;

    return (
        <g className="item-context-menu poi-context-menu" onClick={(e) => e.stopPropagation()}>
            <g>
                <rect x={menuX} y={menuY} width="120" height="54" rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
                <text
                    x={menuX + 8}
                    y={menuY + 20}
                    fill="#ccc"
                    fontSize="11"
                    className="menu-option"
                    onClick={() => { handleTogglePoiVisibility(poi.id); onClose(); }}
                >
                    {hidden ? 'Show' : 'Hide'}
                </text>
                <text
                    x={menuX + 8}
                    y={menuY + 42}
                    fill="#ccc"
                    fontSize="11"
                    className="menu-option"
                    onClick={() => {
                        if (window.confirm(`Delete POI "${poi.label || poi.id}"?`)) {
                            handleDeletePoi(poi.id);
                        }
                        onClose();
                    }}
                >
                    Delete
                </text>
                <text x={menuX + 108} y={menuY + 12} fill="#999" fontSize="10" className="menu-close" onClick={onClose}>✕</text>
            </g>
        </g>
    );
}

export default IndoorPoiContextMenu;
