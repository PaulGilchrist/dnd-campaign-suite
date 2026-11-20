import { tokenStackTransform, CREATURE_ITEM_TYPES } from '../../services/maps/tokenStackOffsets.js';
import TokenStatusIndicators from './TokenStatusIndicators.jsx';

/**
 * The token status chip layer (backlog RG 2026-11-19 occlusion fix): every
 * token's chip row paints in ONE <g> that Map.jsx renders AFTER the Players
 * and PlacedItems layers, so a chip row is never buried under a token disc
 * in the cell below (the old seam painted chips inside the owning token's
 * <g>, and any later-drawn token — every monster paints after every player —
 * covered them).
 *
 * Paint-above-by-document-order mirrors the existing top-layer idiom in the
 * same SVG (FogOverlay, SpellOverlayRenderer and RulerOverlay all render
 * after the token layers). Binding law: a row is positioned at its OWN
 * token's cell centre and carries the SAME stack transform a buried token
 * rides (tokenStackOffsets), so chips stay glued to the art they describe.
 *
 * Visibility laws are the token lanes' own predicates, re-stated here at the
 * single place chips are now derived (render-only, zero writes):
 *  - a player token fogged away from LAN clients paints no row;
 *  - a creature row LAN clients cannot see (visible:false or fogged truth
 *    cell) paints no row — which is also the ghost law: .token-ghost only
 *    ever paints on a cell the client cannot currently see, so a ghost
 *    leaks no status chips (the check reads the TRUE cell, never the
 *    last-seen one the ghost art sits on).
 *
 * Still presentational per row: TokenStatusIndicators keeps its own
 * useRuntimeValue subscriptions, so live SSE repaints flow with zero host
 * plumbing and a position storm never rebuilds an unchanged chip set.
 */
function tokenChipTargets({ players, placedItems, isLocalhost, fog, gridCenterX, gridCenterY, playerOffsets, itemOffsets }) {
    const foggedAt = (gridX, gridY) => !!fog?.has(`${gridX},${gridY}`);
    const rows = [];
    const push = (key, token, offsets) => rows.push({
        key,
        creatureName: token.name,
        cx: gridCenterX(token.gridX),
        cy: gridCenterY(token.gridY),
        stack: tokenStackTransform(offsets, token.id),
    });

    for (const player of players || []) {
        if (!isLocalhost && foggedAt(player.gridX, player.gridY)) continue;
        push(`player-${player.id}`, player, playerOffsets);
    }
    for (const item of placedItems || []) {
        if (!CREATURE_ITEM_TYPES.includes(item.type)) continue;
        if (!isLocalhost && (!item.visible || foggedAt(item.gridX, item.gridY))) continue;
        push(`item-${item.id}`, item, itemOffsets);
    }
    return rows;
}

function TokenStatusLayer({
    campaignName,
    players,
    placedItems,
    isLocalhost,
    fog,
    gridCenterX,
    gridCenterY,
    playerOffsets,
    itemOffsets,
}) {
    const rows = tokenChipTargets({
        players, placedItems, isLocalhost, fog, gridCenterX, gridCenterY, playerOffsets, itemOffsets,
    });
    return (
        <g className="token-status-layer">
            {rows.map(row => (
                <TokenStatusIndicators
                    key={row.key}
                    campaignName={campaignName}
                    creatureName={row.creatureName}
                    cx={row.cx}
                    cy={row.cy}
                    stack={row.stack}
                />
            ))}
        </g>
    );
}

export default TokenStatusLayer;
