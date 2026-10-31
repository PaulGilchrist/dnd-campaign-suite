/**
 * AI Dress map-view mount wiring (backlog ai-dress-belongs-in-map-view).
 *
 * The open map views (indoor Map.jsx, outdoor HexMap.jsx) need THREE pieces
 * that share one ephemeral state — the live proposal ops:
 *   button   → the toolbar's docked AiDressButton (GM-only: null for LAN
 *              players, so both toolbars just render the slot verbatim),
 *   markers/overlay → the DressPreviewOverlay element painting ops on the
 *              canvas above fog/tokens (null once the proposal clears —
 *              close/Apply/toolbar-unmount all wipe it),
 * plus name/coordinate resolution per surface (square grid vs hex q,r).
 *
 * Living in a hook keeps the two already cap-crowded map components free of
 * the branches (createElement instead of JSX keeps this a plain .js hook).
 * Server calls still happen ONLY inside AiDressButton — this is pure wiring.
 */
import { useState, createElement } from 'react';
import AiDressButton from '../../components/maps-manager/AiDressButton.jsx';
import DressPreviewOverlay from '../../components/common/DressPreviewOverlay.jsx';
import {
    indoorDressMarkers,
    squareDressGeometry,
    hexDressMarkers,
    hexDressGeometry,
} from '../../services/maps/dressPreview.js';

function buildSurfaceMarkers(surface, ops, ctx) {
    if (surface === 'hex') return hexDressMarkers(ops, { pois: ctx.pois, terrain: ctx.terrain });
    return indoorDressMarkers(ops, ctx.mapData, ctx.placedItems, ctx.gridSize);
}

/**
 * @param {object} p
 * @param {'square'|'hex'} p.surface           map kind → geometry + validation lane
 * @param {boolean} p.isLocalhost              GM gate (AI dress is a GM-only authoring tool)
 * @param {object} [p.mapData]                 loaded document (indoor lanes + displayName)
 * @param {Array} [p.placedItems] [p.pois] [p.terrain] [p.gridSize]
 * @param {(x:number)=>number} [p.gridCenterX] [p.gridCenterY] indoor cell-centre math
 * @returns {{ button: object|null, overlay: object|null }}
 */
export function useDressMount({
    surface = 'square',
    campaignName, mapName, mapDisplayName, isLocalhost,
    mapData, placedItems, pois, terrain, gridSize,
    gridCenterX, gridCenterY,
}) {
    // Ephemeral display wiring — never game state (eslint server-first safe:
    // the ops list mirrors a proposal the server already holds; disk writes
    // only ever ride AiDressButton's Apply through the normal map PUT lane).
    const [dressOps, setDressOps] = useState(null);

    if (!isLocalhost) return { button: null, overlay: null };

    const map = {
        name: mapData?.displayName || mapDisplayName || mapName,
        slug: mapName,
    };
    const button = createElement(AiDressButton, {
        campaignName, map, mount: 'map', onProposalChange: setDressOps,
    });
    const markers = buildSurfaceMarkers(surface, dressOps, { mapData, placedItems, pois, terrain, gridSize });
    if (!markers) return { button, overlay: null };
    const geometry = surface === 'hex' ? hexDressGeometry() : squareDressGeometry(gridCenterX, gridCenterY);
    return {
        button,
        overlay: createElement(DressPreviewOverlay, {
            markers, cellCenter: geometry.cellCenter, cellPath: geometry.cellPath,
        }),
    };
}

export default useDressMount;
