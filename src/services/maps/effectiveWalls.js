
// A secret door is its own category of cell, not a door. Hidden
// (visible === false) it is disguised as a wall, so it blocks sight and
// renders as a wall. Discovered (visible !== false) the party knows it is
// a fake wall they can pass, so it is an empty cell. This returns the
// effective wall set: base walls + hidden secret-door cells - discovered
// secret-door cells. Used by line-of-sight and wall rendering so a hidden
// secret door is indistinguishable from a real wall.
export function computeEffectiveWalls(walls, placedItems) {
    const base = walls instanceof Set ? walls : new Set(walls || []);
    const effective = new Set(base);
    for (const item of placedItems || []) {
        if (item.type !== 'secretDoor') continue;
        const key = `${item.gridX},${item.gridY}`;
        if (item.visible === false) effective.add(key);
        else effective.delete(key);
    }
    return effective;
}
