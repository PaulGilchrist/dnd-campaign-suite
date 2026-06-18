import { rollExpression } from '../../../dice/diceRoller.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import * as mapsService from '../../../maps/mapsService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { getCurrentSorceryPoints, spendSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { getClassFeatures } from '../../../../services/character/classFeatures.js';
import { addEntry } from '../../../ui/logService.js';

const AREA_SHAPES = new Set(['emanation', 'cone', 'line', 'sphere', 'cube', 'cylinder', 'square', 'circle', 'wall', 'cage', 'floor', 'area']);

function isAreaShape(shape) {
    if (!shape) return false;
    const lower = shape.toLowerCase();
    return AREA_SHAPES.has(lower) || AREA_SHAPES.has(lower.split('_')[0]);
}

function getEmanationRange(auto, playerStats, playerName, campaignName) {
    const baseRange = rangeToFeet(auto.shape);
    if (baseRange && baseRange > 0) return baseRange;
    const fallback = auto.shape?.includes('emanation_30ft') ? 30 : 10;
    const aquaticAffinityRange = getRuntimeValue(playerName, 'aquaticAffinityEmanationRange', campaignName);
    if (aquaticAffinityRange != null) {
        const parsed = parseInt(aquaticAffinityRange, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return fallback;
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Warping Implosion';

    // Check SP-based restore availability
    const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
    const currentSP = getCurrentSorceryPoints(playerName, maxSP);
    const canRestore = currentSP >= (auto.restoreCost || 5);

    // Check if already used this long rest
    const usesKey = auto.resourceKey || (featureName.toLowerCase().replace(/\s+/g, '') + 'Uses');
    const usesMax = auto.uses ?? 1;
    const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0 && !canRestore) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: No remaining uses and cannot restore with Sorcery Points. Finish a Long Rest to regain.`,
                automation: auto,
            },
        };
    }

    const cs = await getCombatContext(campaignName);
    const attackerPos = cs ? { gridX: 0, gridY: 0 } : null;
    let mapData = null;
    if (mapName) {
        try {
            mapData = await mapsService.loadMapData(campaignName, mapName);
        } catch { /* positions unavailable */ }
    }

    const rangeFeet = getEmanationRange(auto, playerStats, playerName, campaignName);
    const saveDcValue = buildSaveDc(auto, playerStats);

    return {
        type: 'modal',
        modalName: 'warpingImplosion',
        payload: {
            action,
            playerStats,
            campaignName,
            mapData,
            attackerPos,
            saveDc: saveDcValue,
            saveType: auto.saveType || 'STR',
            rangeFeet,
            damageExpression: auto.damage || '',
            damageType: auto.damageType || '',
            teleportRange: 120,
            canRestore,
            restoreCost: auto.restoreCost || 5,
            hasRemaining: currentUses > 0,
        },
    };
}

export async function applyWarpingImplosion(action, playerStats, campaignName, targets, teleportTo, spentSP) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Warping Implosion';

    const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
    const currentSP = getCurrentSorceryPoints(playerName, maxSP);

    // Spend SP if restoring
    if (spentSP) {
        if (currentSP < (auto.restoreCost || 5)) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `Not enough Sorcery Points to restore ${featureName}. Need ${auto.restoreCost || 5} SP.`,
                    automation: auto,
                },
            };
        }
        spendSorceryPoints(playerName, auto.restoreCost || 5, campaignName);
    } else {
        // Use normal use
        const usesKey = auto.resourceKey || (featureName.toLowerCase().replace(/\s+/g, '') + 'Uses');
        const usesMax = auto.uses ?? 1;
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);
        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${featureName}: No remaining uses. Restore with Sorcery Points or finish a Long Rest.`,
                    automation: auto,
                },
            };
        }
        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
    }

    const damageResult = rollExpression(auto.damage || '3d10');
    const damageTotal = damageResult?.total || 0;

    const saveDcValue = buildSaveDc(auto, playerStats);

    // Log the ability use
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName}: Teleported up to 120 feet. ${targets?.length || 0} creature(s) in 30-foot emanation made STR save (DC ${saveDcValue}).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[warpingImplosion] Error:", e); throw e; });

    const descriptionParts = [
        `${featureName}: Teleported to an unoccupied space within 120 feet.`,
        `Each creature within 30 feet of the space you left makes a STR saving throw (DC ${saveDcValue}).`,
    ];

    if (isAreaShape(auto.shape)) {
        descriptionParts.push(`Magical Darkness in the area is dispelled.`);
    }

    if (damageResult) {
        descriptionParts.push(`On a failed save, a creature takes ${damageTotal} Force damage and is pulled toward the space you left.`);
    }

    if (spentSP) {
        descriptionParts.push(`Restored with ${auto.restoreCost || 5} Sorcery Points.`);
    }

    return {
        type: 'roll',
        payload: {
            rollType: 'damage',
            name: featureName,
            formula: auto.damage || '3d10',
            total: damageTotal,
            rolls: damageResult?.rolls || [],
            modifier: damageResult?.modifier || 0,
            notes: descriptionParts.join(' '),
            contextConfig: {
                damageType: auto.damageType || 'Force',
                saveDc: saveDcValue,
                saveType: auto.saveType || 'STR',
                dcSuccess: 'none',
                attackerName: playerName,
                conditionInflicted: null,
                shape: auto.shape || '',
            },
        },
    };
}
