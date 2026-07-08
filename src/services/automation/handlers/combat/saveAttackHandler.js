import { rollExpression } from '../../../dice/diceRoller.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import * as mapsService from '../../../maps/mapsService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { resolveUses } from '../../../combat/automation/automationExpressions.js';
import { parseDurationRounds } from '../../../rules/effects/durationParser.js';

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


export function isExhausted(action, playerStats, campaignName) {
    const auto = action.automation;
    if (!auto) return false;

    if (auto.resourceCost === 'channel_divinity') {
        const storedCharges = getRuntimeValue(playerStats.name, 'channelDivinityCharges');
        const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
        const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
        const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;
        return currentCharges <= 0;
    }

    if (auto.resourceCost === 'wild_shape') {
        const maxWS = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.wild_shape || 0;
        const currentWS = getRuntimeValue(playerStats.name, 'wildShapeUses', campaignName);
        const resolvedWS = currentWS != null ? Number(currentWS) : maxWS;
        return resolvedWS <= 0;
    }

    if (auto.uses === undefined && auto.usesMax === undefined) return false;
    const maxUses = auto.usesMax ?? resolveUses(playerStats, auto.uses) ?? 1;
    const usesKey = auto.resourceKey || (action.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? maxUses);
    return currentUses <= 0;
}

function getRiderDescription(effect, effectValue) {
    if (!effect) return '';
    switch (effect) {
        case 'speed_reduction': {
            const feet = effectValue?.replace('_ft', '')?.replace('_', '') || '15';
            return `the target's Speed is reduced by ${feet} ft`;
        }
        case 'push': {
            const dist = effectValue?.replace('_ft', '')?.replace('_', '') || '10';
            return `the target is pushed ${dist} ft`;
        }
        default:
            return effect;
    }
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;

    // Resolve per-option details if applicable
    if (auto.hasOptions && auto.optionDetails) {
        const optionKey = `_${action.name.replace(/\s+/g, '_')}_option`;
        const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
        if (chosenOption && auto.optionDetails[chosenOption]) {
            Object.assign(auto, auto.optionDetails[chosenOption]);
        }
    }

    // Normalize pushEffect to effect for push-based effects
    if (auto.pushEffect && !auto.effect) {
        auto.effect = auto.pushEffect;
    }

    // Resolve variable damage type from subrace (e.g., Draconic Ancestry Breath Weapon)
    let resolvedDamageType = auto.damageType || '';
    if (resolvedDamageType === 'variable') {
        const subrace = playerStats.race?.subrace;
        if (subrace?.damage_resistance) {
            resolvedDamageType = subrace.damage_resistance;
        }
    }

    // Resolve variable shape — show shape selection modal if no option chosen yet
    let resolvedShape = auto.shape || '';
    if (resolvedShape === 'variable' && auto.hasOptions && auto.optionDetails) {
        const optionKey = `_${action.name.replace(/\s+/g, '_')}_option`;
        const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
        if (!chosenOption) {
            const optionKeys = Object.keys(auto.optionDetails);
            return {
                type: 'modal',
                modalName: 'breathWeaponShape',
                payload: {
                    action,
                    playerStats,
                    campaignName,
                    options: optionKeys,
                },
            };
        }
        resolvedShape = auto.shape || 'cone';
    } else if (resolvedShape === 'variable') {
        resolvedShape = 'cone';
    }

    if (auto.resourceCost === 'channel_divinity') {
        const storedCharges = getRuntimeValue(playerStats.name, 'channelDivinityCharges');
        const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
        const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
        const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;

        if (currentCharges <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: 'No Channel Divinity charges remaining.',
                    automation: auto,
                },
            };
        }

        const newCharges = currentCharges - 1;
        await setRuntimeValue(playerStats.name, 'channelDivinityCharges', newCharges, campaignName);
    } else if (auto.resourceCost === 'wild_shape') {
        const maxWS = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.wild_shape || 0;
        const currentWS = getRuntimeValue(playerStats.name, 'wildShapeUses', campaignName);
        const resolvedWS = currentWS != null ? Number(currentWS) : maxWS;
        const cost = auto.doubleEmanation ? 2 : 1;

        if (resolvedWS < cost) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name}: Not enough Wild Shape uses remaining. ${cost} use${cost > 1 ? 's' : ''} required.`,
                    automation: auto,
                },
            };
        }

        await setRuntimeValue(playerStats.name, 'wildShapeUses', resolvedWS - cost, campaignName);

        // Set up duration expiration for area effects
        if (auto.duration && isAreaShape(resolvedShape)) {
            const durationRounds = parseDurationRounds(auto.duration);
            if (durationRounds !== undefined) {
                const rounds = durationRounds === 0 ? undefined : durationRounds;
                if (rounds !== undefined) {
                    addExpiration(playerStats.name, playerStats.name, [
                        { type: 'remove_active_buff', buffName: action.name }
                    ], campaignName, rounds);
                } else {
                    addExpiration(playerStats.name, playerStats.name, [
                        { type: 'remove_active_buff', buffName: action.name }
                    ], campaignName);
                }
            }
        }
    } else {
        const resolvedUses = auto.usesMax ?? resolveUses(playerStats, auto.uses) ?? 1;
        const maxUses = resolvedUses > 0 ? resolvedUses : 0;

        if (maxUses > 0) {
            const usesKey = auto.resourceKey || (action.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
            const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? maxUses);
            if (currentUses <= 0) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        description: `${action.name} has been used and cannot be used again until a long rest.` +
                            (auto.recharge === 'long_rest_or_expend_rage' ? ' You may expend one use of Rage to restore it.' : ''),
                        automation: auto,
                    },
                };
             }
            await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);
        }
    }

    const dcSuccess = auto.dcSuccess !== undefined && auto.dcSuccess !== null
        ? auto.dcSuccess
        : (resolvedShape === 'cone' ? 0.5 : 0);

    const saveDcValue = buildSaveDc(auto, playerStats);

    // Handle save_attack with healing expression — use a modal for area + healing
    if (auto.healExpression && isAreaShape(resolvedShape)) {
        const cs = await getCombatContext(campaignName);

        let attackerPos = null;
        let mapData = null;
        if (mapName) {
            try {
                mapData = await mapsService.loadMapData(campaignName, mapName);
                const attackerPlayer = mapData?.players?.find(p => p.name === playerStats.name);
                if (attackerPlayer) {
                    attackerPos = { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY };
                 }
                } catch { /* positions unavailable */ }
         }

         const rangeFeet = getEmanationRange({ ...auto, shape: resolvedShape }, playerStats, playerStats.name, campaignName);

         return {
             type: 'modal',
             modalName: 'saveAttackHeal',
             payload: {
                 combatSummary: cs,
                 attackerName: playerStats.name,
                 attackerPos,
                 saveDc: saveDcValue,
                 campaignName,
                 mapData,
                 featureName: action.name,
                 saveType: auto.saveType || 'CON',
                 rangeFeet,
                 damageExpression: auto.damage || '',
                 damageType: resolvedDamageType,
                 healExpression: auto.healExpression,
                 dcSuccess: dcSuccess === 0 ? 'none' : (dcSuccess === 0.5 ? 'half' : dcSuccess),
             },
         };
     }

    if (auto.conditionInflicted && !auto.damage) {
        if (isAreaShape(resolvedShape)) {
            const cs = await getCombatContext(campaignName);

            let attackerPos = null;
            let mapData = null;
            if (mapName) {
                try {
                    mapData = await mapsService.loadMapData(campaignName, mapName);
                    const attackerPlayer = mapData?.players?.find(p => p.name === playerStats.name);
                    if (attackerPlayer) {
                        attackerPos = { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY };
                     }
                    } catch { /* positions unavailable */ }
             }

             const rangeFeet = getEmanationRange({ ...auto, shape: resolvedShape }, playerStats, playerStats.name, campaignName);

             return {
                 type: 'modal',
                 modalName: 'setCondition',
                 payload: {
                     combatSummary: cs,
                     attackerName: playerStats.name,
                     attackerPos,
                     saveDc: saveDcValue,
                     campaignName,
                     mapData,
                     featureName: action.name,
                     conditionName: auto.conditionInflicted.toLowerCase(),
                     saveType: auto.saveType || 'WIS',
                     rangeFeet,
                     durationRounds: parseDurationRounds(auto.duration),
                 },
             };
         }

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} — ${auto.saveType || 'WIS'} save DC ${saveDcValue}. On a failed save, target has the ${auto.conditionInflicted} condition.`,
                automation: auto,
            },
        };
    }

    // Handle effect-only (no damage) case, e.g. Cold's speed reduction
    if (!auto.damage && auto.effect) {
        const riderDesc = getRiderDescription(auto.effect, auto.effectValue);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} — ${auto.saveType || 'DEX'} save DC ${saveDcValue}. On a failed save, ${riderDesc}.`,
                automation: auto,
            },
        };
    }

    const damageResult = rollExpression(auto.damage);
    if (!damageResult) return null;

    const notes = [];
    if (resolvedShape && isAreaShape(resolvedShape)) {
        notes.push('Magical Darkness in the area is dispelled.');
    }
    if (auto.effect) {
        notes.push(getRiderDescription(auto.effect, auto.effectValue));
    }

    const dcSuccessDisplay = dcSuccess === 0 ? 'none' : (dcSuccess === 0.5 ? 'half' : dcSuccess);

    return {
        type: 'roll',
        payload: {
            rollType: 'damage',
            name: action.name,
            formula: auto.damage,
            total: damageResult.total,
            rolls: damageResult.rolls,
            modifier: damageResult.modifier,
            notes: notes.length > 0 ? notes.join(' ') : undefined,
            contextConfig: {
                damageType: resolvedDamageType,
                saveDc: saveDcValue,
                saveType: auto.saveType || 'DEX',
                dcSuccess: dcSuccessDisplay,
                attackerName: playerStats.name,
                conditionInflicted: auto.conditionInflicted || null,
                shape: resolvedShape,
             },
         },
     };
 }
