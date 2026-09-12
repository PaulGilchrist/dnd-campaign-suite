import { buildSaveDc } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import * as mapsService from '../../../maps/mapsService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { getCurrentSorceryPoints, spendSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { getClassFeatures } from '../../../../services/character/classFeatures.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';
import { addEntry } from '../../../ui/logService.js';

const TELEPORT_RANGE_FEET = 120;

function isAreaShape(shape) {
    if (!shape) return false;
    const lower = shape.toLowerCase();
    return lower.split('_')[0] === 'emanation' || lower.split('_')[0] === 'sphere';
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

function resolveUsesKey(auto, featureName) {
    return auto.resourceKey || (featureName.toLowerCase().replace(/\s+/g, '') + 'Uses');
}

function buildImplosionPayload({ action, playerStats, campaignName, mapData, attackerPos, saveDcValue, rangeFeet, canRestore, currentUses }) {
    const auto = action.automation;
    return {
        action,
        playerStats,
        campaignName,
        mapData,
        attackerPos,
        saveDc: saveDcValue,
        saveType: auto.saveType || 'STR',
        shape: auto.shape || 'emanation_30ft',
        rangeFeet,
        damageExpression: auto.damage || '',
        damageType: auto.damageType || '',
        teleportRange: TELEPORT_RANGE_FEET,
        canRestore,
        restoreCost: auto.restoreCost || 5,
        hasRemaining: currentUses > 0,
    };
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Warping Implosion';

    // Check SP-based restore availability
    const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
    const currentSP = getCurrentSorceryPoints(playerName, maxSP);
    const canRestore = currentSP >= (auto.restoreCost || 5);

    // Check if already used this long rest
    const usesKey = resolveUsesKey(auto, featureName);
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
            logEntries: [{
                type: 'automation',
                automationType: 'warping_implosion_refused',
                characterName: playerName,
                name: featureName,
                description: `${featureName} refused — no remaining uses and not enough Sorcery Points to restore. Nothing spent.`,
                timestamp: Date.now(),
            }],
        };
    }

    const cs = await getCombatContext(campaignName);
    const attackerPos = cs ? { gridX: 0, gridY: 0 } : null;
    let mapData = null;
    if (_mapName) {
        try {
            mapData = await mapsService.loadMapData(campaignName, _mapName);
        } catch (error) { console.warn('[warpingImplosion] Map data unavailable:', error); }
    }

    const rangeFeet = getEmanationRange(auto, playerStats, playerName, campaignName);
    const saveDcValue = buildSaveDc(auto, playerStats);

    return {
        type: 'modal',
        modalName: 'warpingImplosion',
        payload: buildImplosionPayload({ action, playerStats, campaignName, mapData, attackerPos, saveDcValue, rangeFeet, canRestore, currentUses }),
    };
}

export async function applyWarpingImplosion(action, playerStats, campaignName, restoreWithSP) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Warping Implosion';

    const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
    const currentSP = getCurrentSorceryPoints(playerName, maxSP);
    const restoreCost = auto.restoreCost || 5;

    // Refusal legs spend nothing and log (CLA-359 refusal logging).
    if (restoreWithSP) {
        if (currentSP < restoreCost) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `Not enough Sorcery Points to restore ${featureName}. Need ${restoreCost} SP, you have ${currentSP}. Nothing spent.`,
                    automation: auto,
                },
                logEntries: [{
                    type: 'automation',
                    automationType: 'warping_implosion_refused',
                    characterName: playerName,
                    name: featureName,
                    description: `${featureName} refused — ${currentSP} Sorcery Points is not enough to restore (needs ${restoreCost}). Nothing spent.`,
                    timestamp: Date.now(),
                }],
            };
        }
    } else {
        const usesKey = resolveUsesKey(auto, featureName);
        const usesMax = auto.uses ?? 1;
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);
        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${featureName}: No remaining uses. Restore with ${restoreCost} Sorcery Points or finish a Long Rest. Nothing spent.`,
                    automation: auto,
                },
                logEntries: [{
                    type: 'automation',
                    automationType: 'warping_implosion_refused',
                    characterName: playerName,
                    name: featureName,
                    description: `${featureName} refused — no remaining uses. Nothing spent.`,
                    timestamp: Date.now(),
                }],
            };
        }
        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
    }

    if (restoreWithSP) {
        spendSorceryPoints(playerName, restoreCost, campaignName, maxSP);
    }

    // Caster teleport marker — no grid-position consumer exists (CLA-320
    // psychic teleportation / CLA-366 transposition accepted marker model).
    registerTargetEffect(campaignName, playerName, 'warping_implosion_teleport', featureName, {
        duration: 'instant',
        value: TELEPORT_RANGE_FEET,
    });

    const saveDcValue = buildSaveDc(auto, playerStats);
    const rangeFeet = getEmanationRange(auto, playerStats, playerName, campaignName);

    const descriptionParts = [
        `${playerName} used ${featureName}: teleported to an unoccupied space within ${TELEPORT_RANGE_FEET} feet.`,
        `Creatures within ${rangeFeet} feet of the space left make a ${auto.saveType || 'STR'} save (DC ${saveDcValue}) or take ${auto.damage || '3d10'} ${auto.damageType || 'Force'} damage, pulled toward that space.`,
    ];
    if (restoreWithSP) {
        descriptionParts.push(`Restored with ${restoreCost} Sorcery Points.`);
    }
    if (isAreaShape(auto.shape)) {
        descriptionParts.push('Magical Darkness in the area is dispelled.');
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: descriptionParts.join(' '),
        timestamp: Date.now(),
    }).catch((e) => { console.error("[warpingImplosion] Error logging ability use:", e); });

    return { type: 'confirmed', restored: !!restoreWithSP };
}
