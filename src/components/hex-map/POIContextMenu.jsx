import React from 'react';
import { HEX_SIZE } from '../../config/outdoorConfig';
import { hexToPixel } from '../../services/hexMapUtils';

function POIContextMenu({ selectedPoi, pois, showRename, onToggleVisibility, onDelete, onRename, setShowRename, onClose }) {
    if (!selectedPoi) return null;

    const center = hexToPixel(selectedPoi.q, selectedPoi.r, HEX_SIZE);
    const menuX = center.x + 10;
    const menuY = center.y + 10;
    const selectedItem = pois.find(i => i.id === selectedPoi.id);
    if (!selectedItem) return null;

    const menuHeight = 80; // Hide/Show + Rename + Delete = 3 rows

    return (
        <g className="poi-context-menu" onClick={(e) => e.stopPropagation()}>
            <g>
                <rect x={menuX} y={menuY} width="120" height={menuHeight} rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />

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
                    onClick={() => { setShowRename(selectedPoi.id); }}
                >
                    Rename
                </text>

                {showRename === selectedPoi.id && (
                    <foreignObject x={menuX + 4} y={menuY + 34} width="112" height="28">
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

                {/* Delete */}
                <text
                    x={menuX + 8}
                    y={menuY + 64}
                    fill="#ccc"
                    fontSize="11"
                    className="menu-option"
                    onClick={() => { onDelete(selectedPoi.id); onClose(); }}
                >
                    Delete
                </text>

                {/* Close button */}
                <text
                    x={menuX + 108}
                    y={menuY + 12}
                    fill="#999"
                    fontSize="10"
                    className="menu-close"
                    onClick={onClose}
                >
                    ✕
                </text>
            </g>
        </g>
    );
}

export default POIContextMenu;
