/**
 * Monster-token placement for battle maps (extracted VERBATIM from
 * hooks/useEncounterGeneration.js by the encounter-playtest lane, 2026-11-25,
 * so the travel-event staging and the Encounter Builder playtest share ONE
 * placement rule instead of a second copy). Polar random ring 6–12 cells from
 * the grid centre — the enemy spawn ring the staging cover layout flanks.
 */
export function generateMonsterPlacements(monsters, gridSize) {
    const center = Math.floor(gridSize / 2);
    const items = [];
    let idCounter = 0;
    const occupied = new Set();

    for (const group of monsters) {
        for (let i = 0; i < group.qty; i++) {
            let attempts = 0;
            let gx, gy, key;
            do {
                const angle = Math.random() * Math.PI * 2;
                const distance = 6 + Math.random() * 6;
                gx = Math.round(center + Math.cos(angle) * distance);
                gy = Math.round(center + Math.sin(angle) * distance);
                gx = Math.max(1, Math.min(gridSize - 2, gx));
                gy = Math.max(1, Math.min(gridSize - 2, gy));
                key = `${gx},${gy}`;
                attempts++;
            } while (occupied.has(key) && attempts < 20);

            occupied.add(key);
            items.push({
                id: `enc-monster-${idCounter++}`,
                type: 'npc',
                name: group.name,
                gridX: gx,
                gridY: gy,
                visible: true,
            });
        }
    }

    return items;
}
