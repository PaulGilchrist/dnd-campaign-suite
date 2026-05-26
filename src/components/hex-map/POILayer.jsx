import { HEX_SIZE } from '../../config/outdoorConfig';
import { hexToPixel, hexDistance } from '../../services/hexMapUtils';

function POILayer({ pois, onPoiPointerDown, onPoiContextMenu, poiDragging, poiHover, isLocalhost = false, partyPosition, onPoiEnter, validLinkedMaps, roadStartPoiId }) {
    const isAdjacentToParty = (poi) => {
        if (!partyPosition) return false;
        const dist = hexDistance(partyPosition, { q: poi.q, r: poi.r });
        return dist === 1;
    };

    const isEnterable = (poi) => {
        if (poi.visible === false) return false;
        if (!poi.linkedMap) return false;
        if (!validLinkedMaps || !validLinkedMaps.has(poi.linkedMap)) return false;
        return isAdjacentToParty(poi);
    };

    return (
        <g className="poi-layer">
            {pois.map(poi => {
                const center = hexToPixel(poi.q, poi.r, HEX_SIZE);
                const cx = center.x;
                const cy = center.y;
                const isDragging = poiDragging?.poiId === poi.id;
                const enterable = isEnterable(poi);

                // Players cannot see hidden POIs at all
                if (!isLocalhost && poi.visible === false) return null;

                return (
                    <g
                        key={poi.id}
                        className={`poi-item${enterable ? ' poi-item-enterable' : ''}`}
                        opacity={poi.visible !== false ? 1 : 0.4}
                    >
                        {/* Road-start selection ring */}
                        {roadStartPoiId === poi.id && (
                            <circle
                                cx={cx}
                                cy={cy}
                                r={22}
                                fill="none"
                                stroke="#A08060"
                                strokeWidth={2.5}
                                strokeDasharray="4 3"
                                opacity={0.9}
                                pointerEvents="none"
                            />
                        )}

                        {/* Golden glow ring for enterable POIs */}
                        {enterable && (
                            <circle
                                cx={cx}
                                cy={cy}
                                r={22}
                                fill="none"
                                stroke="#FFD700"
                                strokeWidth={2.5}
                                strokeDasharray="5 3"
                                opacity={0.9}
                                pointerEvents="none"
                            />
                        )}

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

                        {/* "Enter" badge for enterable POIs */}
                        {enterable && (
                            <g>
                                <rect
                                    x={cx - 16}
                                    y={cy + 24}
                                    width={32}
                                    height={14}
                                    rx={3}
                                    fill="#FFD700"
                                    opacity={0.9}
                                />
                                <text
                                    x={cx}
                                    y={cy + 35}
                                    textAnchor="middle"
                                    fill="#1a1a1a"
                                    fontSize="8"
                                    fontWeight="bold"
                                >
                                    Enter
                                </text>
                            </g>
                        )}

                        {/* Hit area for drag and context menu (non-enterable) or click-to-enter */}
                        {enterable ? (
                            <rect
                                x={cx - 18}
                                y={cy - 18}
                                width={36}
                                height={50}
                                fill="transparent"
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => { e.stopPropagation(); onPoiEnter(poi); }}
                                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onPoiContextMenu(poi.id, e); }}
                            />
                        ) : (
                            <rect
                                x={cx - 18}
                                y={cy - 18}
                                width={36}
                                height={36}
                                fill="transparent"
                                onPointerDown={(e) => onPoiPointerDown(poi.id, e)}
                                onClick={(e) => e.stopPropagation()}
                                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onPoiContextMenu(poi.id, e); }}
                                style={{ cursor: 'grab' }}
                            />
                        )}

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
