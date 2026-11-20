// Shared per-origin visibility predicates for the 3D map (extracted from
// map3dScene.js so the header census in Map3D.jsx can consume the SAME rules
// the scene's build dispatch uses — never a second source of truth).

// Mirrors src/components/map/PlacedItems.jsx visibility rules:
// the GM sees everything; a player sees an item only when it is not hidden
// (visible === false) and not inside fogged cells.
export function isItemVisible(item, fog, isLocalhost) {
    return isLocalhost || (item.visible && !fog.has(`${item.gridX},${item.gridY}`));
}

// Creature markers share the token render lane (2D PlacedItems parity):
// palette/AI-Dress npc rows and AI-Dress monster rows become token meshes,
// everything else is a placed prop model.
export function isCreatureToken(item) {
    return item.type === 'npc' || item.type === 'monster';
}

// Mirrors src/components/map/Players.jsx: the GM sees every player; a player
// cannot see a player token standing in a fogged cell.
export function isPlayerVisible(player, fog, isLocalhost) {
    return isLocalhost || !fog.has(`${player.gridX},${player.gridY}`);
}
