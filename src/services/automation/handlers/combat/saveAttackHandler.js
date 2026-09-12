import { rollExpression } from '../../../dice/diceRoller.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import * as mapsService from '../../../maps/mapsService.js';
import { getCombatContext, getAttackerTargetName } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { resolveUses, resolveScaling } from '../../../combat/automation/automationExpressions.js';
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


function isChannelDivinityExhausted(playerStats) {
    const storedCharges = getRuntimeValue(playerStats.name, 'channelDivinityCharges');
    const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
    const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
    const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;
    return currentCharges <= 0;
}

function isWildShapeExhausted(playerStats, campaignName) {
    const maxWS = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.wild_shape || 0;
    const currentWS = getRuntimeValue(playerStats.name, 'wildShapeUses', campaignName);
    const resolvedWS = currentWS != null ? Number(currentWS) : maxWS;
    return resolvedWS <= 0;
}

function isTrackedUsesExhausted(action, auto, playerStats, campaignName) {
    if (auto.uses === undefined && auto.usesMax === undefined) return false;
    const maxUses = auto.usesMax ?? resolveUses(playerStats, auto.uses) ?? 1;
    const usesKey = auto.resourceKey || (action.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? maxUses);
    return currentUses <= 0;
}

export function isExhausted(action, playerStats, campaignName) {
    const auto = action.automation;
    if (!auto) return false;
    if (auto.resourceCost === 'channel_divinity') return isChannelDivinityExhausted(playerStats);
    if (auto.resourceCost === 'wild_shape') return isWildShapeExhausted(playerStats, campaignName);
    return isTrackedUsesExhausted(action, auto, playerStats, campaignName);
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

function dcSuccessLabel(dcSuccess) {
    return dcSuccess === 0 ? 'none' : (dcSuccess === 0.5 ? 'half' : dcSuccess);
}

// Resolve per-option details if applicable
function applyOptionDetails(auto, action, playerStats, campaignName) {
    if (!(auto.hasOptions && auto.optionDetails)) return;
    const optionKey = `_${action.name.replace(/\s+/g, '_')}_option`;
    const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
    if (chosenOption && auto.optionDetails[chosenOption]) {
        Object.assign(auto, auto.optionDetails[chosenOption]);
    }
}

// Resource consumption for save attacks: Channel Divinity, Wild Shape (with
// area expiration setup), or tracked uses (with rage-point fallback).
// Returns a refusal popup, or null when the cost was paid.
async function consumeSaveAttackCost(action, auto, playerStats, campaignName, resolvedShape) {
    if (auto.resourceCost === 'channel_divinity') {
        return consumeChannelDivinity(action, auto, playerStats, campaignName);
    }

    if (auto.resourceCost === 'wild_shape') {
        return consumeWildShapeUses(action, auto, playerStats, campaignName, resolvedShape);
    }

    return consumeTrackedUses(action, auto, playerStats, campaignName);
}

function refusalPopup(action, auto, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
            automation: auto,
        },
    };
}

async function consumeChannelDivinity(action, auto, playerStats, campaignName) {
    const storedCharges = getRuntimeValue(playerStats.name, 'channelDivinityCharges');
    const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
    const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
    const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;

    if (currentCharges <= 0) {
        return refusalPopup(action, auto, 'No Channel Divinity charges remaining.');
    }

    const newCharges = currentCharges - 1;
    await setRuntimeValue(playerStats.name, 'channelDivinityCharges', newCharges, campaignName);
    return null;
}

async function consumeWildShapeUses(action, auto, playerStats, campaignName, resolvedShape) {
    const maxWS = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.wild_shape || 0;
    const currentWS = getRuntimeValue(playerStats.name, 'wildShapeUses', campaignName);
    const resolvedWS = currentWS != null ? Number(currentWS) : maxWS;
    const cost = auto.doubleEmanation ? 2 : 1;

    if (resolvedWS < cost) {
        return refusalPopup(action, auto, `${action.name}: Not enough Wild Shape uses remaining. ${cost} use${cost > 1 ? 's' : ''} required.`);
    }

    await setRuntimeValue(playerStats.name, 'wildShapeUses', resolvedWS - cost, campaignName);

    // Set up duration expiration for area effects
    applyShapeDurationExpiration(action, auto, playerStats, resolvedShape, campaignName);
    return null;
}

function applyShapeDurationExpiration(action, auto, playerStats, resolvedShape, campaignName) {
    if (!(auto.duration && isAreaShape(resolvedShape))) return;
    const durationRounds = parseDurationRounds(auto.duration);
    if (durationRounds === undefined) return;
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

async function consumeTrackedUses(action, auto, playerStats, campaignName) {
    const resolvedUses = auto.usesMax ?? resolveUses(playerStats, auto.uses) ?? playerStats.level;
    const maxUses = resolvedUses > 0 ? resolvedUses : 0;

    if (maxUses > 0) {
        const usesKey = auto.resourceKey || (action.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
        const storedValue = getRuntimeValue(playerStats.name, usesKey);
        const currentUses = Number(storedValue ?? maxUses);
        if (currentUses <= 0) {
            if (auto.recharge === 'long_rest_or_expend_rage') {
                const storedRage = getRuntimeValue(playerStats.name, 'ragePoints', campaignName);
                const currentRage = storedRage != null ? Number(storedRage) : (playerStats._trackedResources?.ragePoints?.current ?? 0);
                if (currentRage <= 0) {
                    return refusalPopup(action, auto, `${action.name} has been used and cannot be used again until a long rest.`);
                }
                await setRuntimeValue(playerStats.name, 'ragePoints', currentRage - 1, campaignName);
            } else {
                return refusalPopup(action, auto, `${action.name} has been used and cannot be used again until a long rest.`);
            }
        } else {
            await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);
        }
    }
    return null;
}

async function resolveAttackerPosition(_mapName, campaignName, playerStats) {
    let attackerPos = null;
    let mapData = null;
    let attackerPlayer = null;
    if (!_mapName) return { attackerPos, mapData, attackerPlayer };
    try {
        mapData = await mapsService.loadMapData(campaignName, _mapName);
        attackerPlayer = mapData?.players?.find(p => p.name === playerStats.name);
        if (attackerPlayer) {
            attackerPos = { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY };
        }
    } catch (error) { console.warn('[saveAttackHandler] Attacker position unavailable:', error); }
    return { attackerPos, mapData, attackerPlayer };
}

async function buildHealModal(action, auto, playerStats, campaignName, _mapName, resolved) {
    const { resolvedShape, resolvedDamageType, saveDcValue, dcSuccess } = resolved;
    const cs = await getCombatContext(campaignName);
    const { attackerPos, mapData, attackerPlayer } = await resolveAttackerPosition(_mapName, campaignName, playerStats);

    const rangeFeet = auto.range ? rangeToFeet(auto.range) : getEmanationRange({ ...auto, shape: resolvedShape }, playerStats, playerStats.name, campaignName);

    const damageScalingEntry = resolveScaling(playerStats, auto.scaling);
    const resolvedDamageExpressionForHealModal = damageScalingEntry?.damage || auto.damage || '';
    const healScalingEntry = resolveScaling(playerStats, auto.healScaling);
    const resolvedHealExpression = healScalingEntry?.damage || auto.healExpression || '';

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
            damageExpression: resolvedDamageExpressionForHealModal,
            damageType: resolvedDamageType,
            healExpression: resolvedHealExpression,
            dcSuccess: dcSuccessLabel(dcSuccess),
            shape: resolvedShape,
            attackerGridX: attackerPlayer?.gridX,
            attackerGridY: attackerPlayer?.gridY,
        },
    };
}

async function buildConditionModal({ action, auto, playerStats, campaignName, _mapName, resolvedShape, saveDcValue }) {
    const cs = await getCombatContext(campaignName);
    const { attackerPos, mapData, attackerPlayer } = await resolveAttackerPosition(_mapName, campaignName, playerStats);

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
            shape: resolvedShape,
            attackerGridX: attackerPlayer?.gridX,
            attackerGridY: attackerPlayer?.gridY,
        },
    };
}

// Handle AoE damage (not heal, not condition-only)
async function buildAoeModal({ action, auto, playerStats, campaignName, resolvedShape, resolvedDamageType, saveDcValue, dcSuccess }) {
    const cs = getCombatContext(campaignName);
    const attackerTargetName = getAttackerTargetName(cs, playerStats.name);
    const isOverlayTargeted = attackerTargetName?.startsWith('overlay-');

    let activeOverlay = null;
    if (isOverlayTargeted) {
        const overlayId = attackerTargetName.slice('overlay-'.length);
        try {
            const response = await fetch(`/api/campaigns/${campaignName}/spell-overlays`);
            const overlays = await response.json();
            activeOverlay = overlays.find(o => o.id === overlayId) || null;
        } catch (error) {
            console.error('Error fetching overlay:', error);
        }
    }

    const rangeFeet = auto.range ? rangeToFeet(auto.range) : getEmanationRange({ ...auto, shape: resolvedShape }, playerStats, playerStats.name, campaignName);

    const resolvedDamageExpression = auto.damage;
    const scalingEntry = resolveScaling(playerStats, auto.scaling);
    const resolvedDamageForModal = scalingEntry?.damage || resolvedDamageExpression;

    return {
        type: 'modal',
        modalName: 'saveAttackAoe',
        payload: {
            action,
            playerStats,
            campaignName,
            shape: resolvedShape,
            range: rangeFeet,
            damage: resolvedDamageForModal,
            damageType: resolvedDamageType,
            saveType: auto.saveType || 'DEX',
            saveDc: saveDcValue,
            dcSuccess: dcSuccessLabel(dcSuccess),
            activeOverlay,
        },
    };
}

function routeSaveAttack(action, auto, playerStats, campaignName, _mapName, resolved) {
    const { resolvedShape, resolvedDamageType, saveDcValue, dcSuccess } = resolved;
    // Handle save_attack with healing expression — use a modal for area + healing
    if (auto.healExpression && isAreaShape(resolvedShape)) {
        return buildHealModal(action, auto, playerStats, campaignName, _mapName, resolved);
    }

    if (auto.conditionInflicted && !auto.damage) {
        if (isAreaShape(resolvedShape)) {
            return buildConditionModal({ action, auto, playerStats, campaignName, _mapName, resolvedShape, saveDcValue });
        }
        return conditionInflictedPopup(action, auto, saveDcValue);
    }

    // Handle effect-only (no damage) case, e.g. Cold's speed reduction
    if (!auto.damage && auto.effect) {
        return effectOnlyPopup(action, auto, saveDcValue);
    }

    // Handle AoE damage (not heal, not condition-only)
    if (isAreaShape(resolvedShape) && auto.damage && !auto.healExpression && !auto.conditionInflicted) {
        return buildAoeModal({ action, auto, playerStats, campaignName, resolvedShape, resolvedDamageType, saveDcValue, dcSuccess });
    }

    return buildSaveAttackRollResult({ action, auto, playerStats, resolvedShape, resolvedDamageType, saveDcValue, dcSuccess });
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    applyOptionDetails(auto, action, playerStats, campaignName);

    // Normalize pushEffect to effect for push-based effects
    if (auto.pushEffect && !auto.effect) {
        auto.effect = auto.pushEffect;
    }

    // Resolve variable damage type from subrace (e.g., Draconic Ancestry Breath Weapon)
    const resolvedDamageType = resolveSaveAttackDamageType(auto, playerStats);

    // Resolve variable shape — default to cone if variable
    let resolvedShape = auto.shape || '';
    if (resolvedShape === 'variable') {
        resolvedShape = 'cone';
    }

    const costPopup = await consumeSaveAttackCost(action, auto, playerStats, campaignName, resolvedShape);
    if (costPopup) return costPopup;

    const dcSuccess = auto.dcSuccess ?? (resolvedShape === 'cone' ? 0.5 : 0);

    const saveDcValue = buildSaveDc(auto, playerStats);

    return routeSaveAttack(action, auto, playerStats, campaignName, _mapName, { resolvedShape, resolvedDamageType, saveDcValue, dcSuccess });
}

function conditionInflictedPopup(action, auto, saveDcValue) {
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

function effectOnlyPopup(action, auto, saveDcValue) {
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

function resolveSaveAttackDamageType(auto, playerStats) {
    let resolvedDamageType = auto.damageType || '';
    if (resolvedDamageType !== 'variable') return resolvedDamageType;
    const subrace = playerStats.race?.subrace;
    if (subrace?.damage_resistance) {
        resolvedDamageType = subrace.damage_resistance;
    }
    return resolvedDamageType;
}

function buildSaveAttackRollResult({ action, auto, playerStats, resolvedShape, resolvedDamageType, saveDcValue, dcSuccess }) {
    const resolvedDamageExpression = auto.damage;
    const scalingEntry = resolveScaling(playerStats, auto.scaling);
    const damageExpression = scalingEntry?.damage || resolvedDamageExpression;
    const damageResult = rollExpression(damageExpression);
    if (!damageResult) return null;

    const notes = [];
    if (resolvedShape && isAreaShape(resolvedShape)) {
        notes.push('Magical Darkness in the area is dispelled.');
    }
    if (auto.effect) {
        notes.push(getRiderDescription(auto.effect, auto.effectValue));
    }

    return {
        type: 'roll',
        payload: {
            rollType: 'damage',
            name: action.name,
            formula: damageExpression,
            total: damageResult.total,
            rolls: damageResult.rolls,
            modifier: damageResult.modifier,
            notes: notes.length > 0 ? notes.join(' ') : undefined,
            contextConfig: {
                damageType: resolvedDamageType,
                saveDc: saveDcValue,
                saveType: auto.saveType || 'DEX',
                dcSuccess: dcSuccessLabel(dcSuccess),
                attackerName: playerStats.name,
                conditionInflicted: auto.conditionInflicted || null,
                shape: resolvedShape,
            },
        },
    };
}
