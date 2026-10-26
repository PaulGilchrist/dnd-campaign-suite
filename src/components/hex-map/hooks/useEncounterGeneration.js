import { useCallback } from 'react';
import * as mapsService from '../../../services/maps/mapsService.js';
import { hexKey } from '../../../services/maps/hexMapUtils.js';
import { generateOutdoorEncounter } from '../../../services/encounters/outdoorEncounterGenerator.js';
import { buildEncounterMapDisplayName } from '../../../services/encounters/encounterMapNaming.js';
import { stageEventEncounterMap } from '../../../services/encounters/encounterStagingService.js';

function useEncounterGeneration({
    campaignName,
    mapName,
    terrain,
    marchingOrder,
    onEncounterCreated,
    parentDisplayName,
}) {
    const generateMonsterPlacements = useCallback((monsters, gridSize) => {
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
    }, []);

    const handleStartEncounter = useCallback(async (q, r, extraPlacedItems = [], eventTitle = null) => {
        const terrainType = terrain[hexKey(q, r)] || 'plains';
        const grid = 30;
        const encounterData = generateOutdoorEncounter(terrainType, grid, marchingOrder, q, r);

        try {
            if (eventTitle) {
                // Accepted travel event (backlog 2026-10-26 run E): reuse the
                // campaign's single staging map instead of spawning a
                // per-event arena — the write wipes the previous placed items
                // and seeds a fresh randomized 1/2 + 3/4 + full cover layout
                // around the combatant spawn zone.
                const { label } = await stageEventEncounterMap({
                    campaignName,
                    terrainType,
                    q,
                    r,
                    gridSize: grid,
                    decorItems: encounterData.placedItems,
                    monsterItems: extraPlacedItems,
                    players: encounterData.players,
                    bgFill: encounterData.bgFill,
                });
                if (onEncounterCreated) {
                    onEncounterCreated(label);
                }
                return label;
            }

            // Manual party-marker spawn keeps the per-encounter arena lane.
            // Readable display label ("Test Map - Ambush from the Brush at (5,5)")
            // — shared with the auto-encounter log copy so the Maps list and the
            // log name the arena identically (backlog 2026-10-25 pm). The parent's
            // AUTHORED displayName wins verbatim when the caller knows it, so a
            // map like "QA Hex 2" is never re-title-cased into "Qa Hex 2"
            // (backlog 2026-10-25 eve). The server still slugs this into the
            // on-disk fileName unchanged in kind.
            const encounterName = buildEncounterMapDisplayName({ parentMapName: mapName, q, r, eventTitle, parentDisplayName });

            if (extraPlacedItems.length > 0) {
                encounterData.placedItems = [...encounterData.placedItems, ...extraPlacedItems];
            }

            const result = await mapsService.createMap(campaignName, encounterName, {
                type: 'indoor',
                gridSize: grid,
                placedItems: encounterData.placedItems,
                players: encounterData.players,
                fog: [],
                walls: [],
                parentTerrain: terrainType,
                parentHex: { q, r },
                bgFill: encounterData.bgFill,
            });

            if (!result?.alreadyExists) {
                // The PUT route persists the body verbatim, so the authored
                // display metadata must ride IN the save payload or the label
                // created above is wiped and the Maps list falls back to the
                // raw kebab slug (2026-10-25 backlog).
                await mapsService.saveMapData(campaignName, encounterName, {
                    ...encounterData,
                    displayName: encounterName,
                    name: mapsService.toKebabCase(encounterName),
                });
            }

            if (onEncounterCreated) {
                onEncounterCreated(encounterName);
            }

            return encounterName;
        } catch (err) {
            console.error('[handleStartEncounter] FAILED:', err);
            return null;
        }
    }, [campaignName, mapName, terrain, marchingOrder, onEncounterCreated, parentDisplayName]);

    return { generateMonsterPlacements, handleStartEncounter };
}

export default useEncounterGeneration;
