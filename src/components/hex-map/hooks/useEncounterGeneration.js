import { useCallback } from 'react';
import * as mapsService from '../../../services/maps/mapsService.js';
import { hexKey } from '../../../services/maps/hexMapUtils.js';
import { generateOutdoorEncounter } from '../../../services/encounters/outdoorEncounterGenerator.js';

function useEncounterGeneration(campaignName, mapName, terrain, marchingOrder, onEncounterCreated) {
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

    const handleStartEncounter = useCallback(async (q, r, extraPlacedItems = []) => {
        const terrainType = terrain[hexKey(q, r)] || 'plains';
        const grid = 30;
        const encounterData = generateOutdoorEncounter(terrainType, grid, marchingOrder, q, r);
        const baseMapName = mapName.replace(/\.json$/, '');
        const encounterName = `${baseMapName} - Encounter at ${q},${r}`;

        if (extraPlacedItems.length > 0) {
            encounterData.placedItems = [...encounterData.placedItems, ...extraPlacedItems];
        }

        try {
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
                await mapsService.saveMapData(campaignName, encounterName, encounterData);
            }

            if (onEncounterCreated) {
                onEncounterCreated(encounterName);
            }
        } catch (err) {
            console.error('[handleStartEncounter] FAILED:', err);
        }
    }, [campaignName, mapName, terrain, marchingOrder, onEncounterCreated]);

    return { generateMonsterPlacements, handleStartEncounter };
}

export default useEncounterGeneration;
