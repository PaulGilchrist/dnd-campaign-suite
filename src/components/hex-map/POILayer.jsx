import React from 'react';
import { HEX_SIZE } from '../../config/outdoorConfig';
import { hexToPixel } from '../../services/hexMapUtils';

function POILayer({ pois, onPoiPointerDown, onPoiContextMenu, poiDragging, poiHover }) {
    return (
        <g className="poi-layer">
            {pois.map(poi => {
                const center = hexToPixel(poi.q, poi.r, HEX_SIZE);
                const cx = center.x;
                const cy = center.y;
                const isDragging = poiDragging?.poiId === poi.id;

                return (
                    <g key={poi.id} className="poi-item" opacity={poi.visible !== false ? 1 : 0.4}>
                        {/* The POI SVG icon */}
                        <use href={`#poi-${poi.type}`} x={cx - 18} y={cy - 18} />

                        {/* Label text below the POI */}
                        {poi.label && (
                            <text
                                x={cx}
                                y={cy + 22}
                                textAnchor="middle"
                                fill="#fff"
                                fontSize="9"
                                fontWeight="bold"
                                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)', pointerEvents: 'none' }}
                            >
                                {poi.label}
                            </text>
                        )}

                        {/* Hit area for drag and context menu */}
                        <rect
                            x={cx - 18}
                            y={cy - 18}
                            width={36}
                            height={36}
                            fill="transparent"
                            onPointerDown={(e) => onPoiPointerDown(poi.id, e)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onPoiContextMenu(poi.id, e); }}
                            style={{ cursor: 'grab' }}
                        />

                        {/* Drag highlight */}
                        {isDragging && (
                            <rect x={cx - 20} y={cy - 20} width={40} height={40} fill="none" stroke="#FFD700" strokeWidth={2} rx={4} />
                        )}
                    </g>
                );
            })}

            {/* Drop preview when hovering new hex with a POI being placed */}
            {poiHover && (
                <rect
                    x={poiHover.x - 18}
                    y={poiHover.y - 18}
                    width={36}
                    height={36}
                    fill="rgba(255,215,0,0.2)"
                    stroke="#FFD700"
                    strokeWidth={2}
                    rx={4}
                    strokeDasharray="4 2"
                    pointerEvents="none"
                />
            )}
        </g>
    );
}

export default POILayer;
