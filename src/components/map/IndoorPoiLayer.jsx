/**
 * Indoor POI marker layer (bug-ai-dress-poi-invisible-on-indoor-maps).
 *
 * Renders the map document's `pois` lane on the indoor square grid. Before
 * this lane existed the pois an AI Dress apply wrote (server
 * dressMap.js addPoi) were adopted into client state by useSSESync but drawn
 * by NOTHING — the whole POI surface lived only in hex-map/POILayer.jsx.
 * Mirrors that component's affordances on gridX/gridY geometry:
 *   - the shared `#poi-landmark` icon def + the label beneath it,
 *   - GM (localhost) hit area for the right-click menu,
 *   - hidden POIs (visible === false) stay invisible to players,
 *   - fogged cells hide the marker from players (same fog rule as
 *     PlacedItems.jsx:21) while the GM sees it through the veil dimmed by
 *     the shared HIDDEN_MARKER_OPACITY.
 */
import { HIDDEN_MARKER_OPACITY } from '../../config/mapConfig';

function IndoorPoiLayer({ pois, isLocalhost, fog, gridCenterX, gridCenterY, handlePoiContextMenu, selectedPoi }) {
    const rows = Array.isArray(pois) ? pois : [];

    const isVisible = (poi) => {
        if (poi.visible === false) return isLocalhost;
        return isLocalhost || !fog?.has(`${poi.gridX},${poi.gridY}`);
    };

    const isSelected = (poi) => selectedPoi?.id === poi.id;

    return (
        <g className="indoor-poi-layer">
            {rows.map(poi => {
                if (!isVisible(poi)) return null;
                const cx = gridCenterX(poi.gridX);
                const cy = gridCenterY(poi.gridY);
                const dimmed = poi.visible === false;
                return (
                    <g key={poi.id} className="poi-item">
                        {/* POI icon (shared LandmarkSVG def) + label */}
                        <use href="#poi-landmark" x={cx - 18} y={cy - 18} opacity={dimmed ? HIDDEN_MARKER_OPACITY : 1} />
                        {poi.label && (
                            <text
                                x={cx}
                                y={cy + 22}
                                textAnchor="middle"
                                fontSize="9"
                                fontWeight="bold"
                                className="poi-label"
                                opacity={dimmed ? HIDDEN_MARKER_OPACITY : 1}
                            >
                                {poi.label}
                            </text>
                        )}
                        {isLocalhost && (
                            <>
                                <rect
                                    x={cx - 18}
                                    y={cy - 18}
                                    width={36}
                                    height={44}
                                    className="poi-hit-area placed-hit-area"
                                    onContextMenu={(e) => handlePoiContextMenu(poi, e)}
                                />
                                {isSelected(poi) && (
                                    <rect x={cx - 20} y={cy - 20} width={40} height={40} fill="none" className="reposition-highlight" />
                                )}
                            </>
                        )}
                    </g>
                );
            })}
        </g>
    );
}

export default IndoorPoiLayer;
