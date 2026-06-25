import { useState } from 'react';
import { HEX_SIZE } from '../../config/outdoorConfig';
import { hexToPixel } from '../../services/maps/hexMapUtils';
import * as mapsService from '../../services/maps/mapsService.js';

function POIContextMenu({ selectedPoi, pois, showRename, onToggleVisibility, onDelete, onRename, onLinkMap, onUnlinkMap, onRemoveRoads, setShowRename, onClose, indoorMaps = [], viewPortBounds, roads = [] }) {
    const [showLinkPicker, setShowLinkPicker] = useState(false);

    if (!selectedPoi) return null;

    const center = hexToPixel(selectedPoi.q, selectedPoi.r, HEX_SIZE);
    let menuX = center.x + 10;
    let menuY = center.y + 10;
    const selectedItem = pois.find(i => i.id === selectedPoi.id);
    if (!selectedItem) return null;

    const hasLink = !!selectedItem.linkedMap;
    const connectedRoads = roads.filter(r => r.fromPoiId === selectedPoi.id || r.toPoiId === selectedPoi.id);
    const hasRoads = connectedRoads.length > 0;
    const rowCount = (hasLink ? 5 : 4) + (hasRoads ? 1 : 0);
    const baseMenuHeight = rowCount * 22 + 8; // 22px per row + padding
    const pickerItemCount = showLinkPicker ? (indoorMaps.length === 0 ? 1 : Math.min(indoorMaps.length, 6)) : 0;
    const menuHeight = baseMenuHeight + (showLinkPicker ? pickerItemCount * 20 + 8 : 0);
    const menuWidth = 160;

    // Clamp to viewport so menu doesn't overflow the visible SVG area
    if (viewPortBounds) {
        menuX = Math.max(viewPortBounds.left + 4, Math.min(menuX, viewPortBounds.right - menuWidth - 4));
        menuY = Math.max(viewPortBounds.top + 4, Math.min(menuY, viewPortBounds.bottom - menuHeight - 4));
    }

    const handleLinkMap = (mapName) => {
        onLinkMap(selectedPoi.id, mapName);
        setShowLinkPicker(false);
        onClose();
    };

    const handleUnlinkMap = () => {
        onUnlinkMap(selectedPoi.id);
        onClose();
    };

    return (
        <g className="poi-context-menu" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <g>
                <rect x={menuX} y={menuY} width={menuWidth} height={menuHeight} rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />

                {/* Hide/Show */}
                <text
                    x={menuX + 8}
                    y={menuY + 20}
                    fill="#ccc"
                    fontSize="11"
                    className="menu-option"
                    onClick={() => { onToggleVisibility(selectedPoi.id); onClose(); }}
                >
                    {selectedItem.visible !== false ? 'Hide' : 'Show'}
                </text>

                {/* Rename */}
                <text
                    x={menuX + 8}
                    y={menuY + 42}
                    fill="#ccc"
                    fontSize="11"
                    className="menu-option"
                    onClick={() => { setShowRename(selectedPoi.id); setShowLinkPicker(false); }}
                >
                    Rename
                </text>

                {showRename === selectedPoi.id && (
                    <foreignObject x={menuX + 4} y={menuY + 34} width={menuWidth - 8} height="28">
                        <input
                            type="text"
                            defaultValue={selectedItem.label || ''}
                            className="context-menu-input"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    onRename(selectedPoi.id, e.target.value);
                                    onClose();
                                }
                            }}
                            onBlur={(e) => {
                                onRename(selectedPoi.id, e.target.value);
                                onClose();
                            }}
                            autoFocus
                        />
                    </foreignObject>
                )}

                {/* Link to Map / Unlink Map */}
                {hasLink ? (
                    <text
                        x={menuX + 8}
                        y={menuY + 64}
                        fill="#e8a040"
                        fontSize="11"
                        className="menu-option"
                        onClick={handleUnlinkMap}
                    >
                                    Unlink Map ({mapsService.formatMapName(selectedItem.linkedMap)})
                                </text>
                ) : (
                    <text
                        x={menuX + 8}
                        y={menuY + 64}
                        fill="#ccc"
                        fontSize="11"
                        className="menu-option"
                        onClick={() => setShowLinkPicker(true)}
                    >
                        Link to Map...
                    </text>
                )}

                {/* Link picker dropdown (uses SVG text for reliable event handling) */}
                {showLinkPicker && (() => {
                    const pickerStart = menuY + 86;
                    const pickerBgHeight = pickerItemCount * 20 + 8;
                    return (
                        <g>
                            <rect x={menuX + 4} y={pickerStart - 4} width={menuWidth - 8} height={pickerBgHeight} rx="2" fill="#383838" />
                            {indoorMaps.length === 0 ? (
                                <text x={menuX + 10} y={pickerStart + 14} fill="#888" fontSize="10">No indoor maps available</text>
                            ) : indoorMaps.slice(0, 6).map((m, i) => (
                                <text
                                    key={m}
                                    x={menuX + 10}
                                    y={pickerStart + 14 + i * 20}
                                    fill="#ccc"
                                    fontSize="11"
                                    className="menu-option"
                                    onClick={() => handleLinkMap(m)}
                                >
                                    {mapsService.formatMapName(m)}
                                </text>
                            ))}
                        </g>
                    );
                })()}

                {/* Delete */}
                <text
                    x={menuX + 8}
                    y={showLinkPicker ? menuY + 86 + pickerItemCount * 20 : menuY + 86}
                    fill="#ccc"
                    fontSize="11"
                    className="menu-option"
                    onClick={() => { onDelete(selectedPoi.id); onClose(); }}
                >
                    Delete
                </text>

                {/* Remove Roads */}
                {hasRoads && (
                    <text
                        x={menuX + 8}
                        y={showLinkPicker ? menuY + 108 + pickerItemCount * 20 : menuY + 108}
                        fill="#e8a040"
                        fontSize="11"
                        className="menu-option"
                        onClick={() => { onRemoveRoads(selectedPoi.id); onClose(); }}
                    >
                        Remove Roads ({connectedRoads.length})
                    </text>
                )}

                {/* Close button */}
                <text
                    x={menuX + menuWidth - 12}
                    y={menuY + 12}
                    fill="#999"
                    fontSize="10"
                    className="menu-close"
                    onClick={() => { setShowLinkPicker(false); onClose(); }}
                >
                    ✕
                </text>
            </g>
        </g>
    );
}

export default POIContextMenu;
