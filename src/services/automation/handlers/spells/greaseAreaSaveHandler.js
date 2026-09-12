import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import * as mapsService from '../../../maps/mapsService.js';
import { playerIsImmuneToCondition } from '../../../combat/automation/automationImmunities.js';
import { addTargetResult } from '../../common/damageRollback.js';
import { addCondition } from '../../../../services/combat/conditions/conditionSaveService.js';

function getAreaRadius(auto) {
    const size = auto.size || '10-foot';
    const match = size.match(/(\d+)-foot/);
    return match ? parseInt(match[1], 10) : 10;
}

function getGreaseTrackingKey(casterName) {
    return `_grease_${casterName.replace(/\s+/g, '_')}`;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const saveDc = buildSaveDc(auto, playerStats);
    const conditionName = auto.conditionInflicted || 'Prone';
    const saveType = auto.saveType || 'DEX';
    const rangeFeet = getAreaRadius(auto);

    const cs = await getCombatContext(campaignName);

    let casterPos = null;
    let mapData = null;
    if (_mapName) {
        try {
            mapData = await mapsService.loadMapData(campaignName, _mapName);
            const casterPlayer = mapData?.players?.find(p => p.name === playerStats.name);
            if (casterPlayer) {
                casterPos = { gridX: casterPlayer.gridX, gridY: casterPlayer.gridY };
            }
        } catch (error) { console.warn('[greaseAreaSaveHandler] Caster position unavailable:', error); }
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} activated — ${saveType} save DC ${saveDc}, ${rangeFeet}ft square area.`,
    }).catch((e) => { console.error("[greaseAreaSaveHandler:log-error]", e); });

    // Store grease area tracking for recurring saves
    const trackingKey = getGreaseTrackingKey(playerStats.name);
    setRuntimeValue(playerStats.name, trackingKey, {
        caster: playerStats.name,
        center: casterPos,
        mapName: _mapName,
        campaignName,
        saveDc,
        saveType,
        condition: conditionName,
        radius: rangeFeet,
        timestamp: Date.now(),
        duration: auto.duration || '1 minute',
    }, campaignName);

    // Set expiration for the grease area
    const durationRounds = (() => {
        const lower = (auto.duration || '').toLowerCase();
        if (lower.startsWith('1_minute')) return 10;
        const match = lower.match(/(\d+)_round/);
        if (match) return parseInt(match[1], 10);
        return undefined;
    })();

    if (durationRounds) {
        addExpiration(playerStats.name, playerStats.name, [
            { type: 'remove_grease_area', greaseKey: trackingKey }
        ], campaignName, durationRounds);
    }

    return {
        type: 'modal',
        modalName: 'setCondition',
        payload: {
            combatSummary: cs,
            attackerName: playerStats.name,
            attackerPos: casterPos,
            saveDc,
            campaignName,
            mapData,
            featureName: action.name,
            conditionName,
            saveType,
            rangeFeet,
            durationRounds,
        },
    };
}

async function greaseTargetIsImmune(targetName, tracking, campaignName) {
    const targetCharacter = (await getCombatContext(campaignName))?.creatures?.find(c => c.name === targetName);
    if (targetCharacter?.type !== 'player') return false;
    const targetStats = {
        computedStats: getRuntimeValue(targetName, 'computedStats', campaignName),
    };
    return playerIsImmuneToCondition({
        conditionKey: tracking.condition.toLowerCase(),
        playerStats: targetStats,
        getRuntimeValue,
        campaignName,
    });
}

function targetHasCondition(targetName, condition, campaignName) {
    const existingConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    return existingConditions.some(c => String(c).toLowerCase() === condition);
}

async function recordGreaseFailure(campaignName, casterName, targetName, tracking, saveResult) {
    const cs = await getCombatContext(campaignName);
    const conditionDef = { key: tracking.condition.toLowerCase(), label: tracking.condition.charAt(0).toUpperCase() + tracking.condition.slice(1) };
    addCondition(cs, targetName, conditionDef, tracking.saveDc, tracking.saveType, getRuntimeValue, setRuntimeValue, campaignName, null);

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: [tracking.condition.toLowerCase()],
        appliedDamage: 0,
    });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-grease',
        targetName,
        saveDc: tracking.saveDc,
        saveType: tracking.saveType,
        success: false,
        description: `${targetName} failed ${tracking.saveType} save against Grease. Becomes Prone.`,
    }).catch((e) => { console.error("[greaseAreaSave] Error:", e); });
}

async function recordGreaseSuccess(campaignName, casterName, targetName, tracking, saveResult) {
    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'success',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: [],
        appliedDamage: 0,
    });
    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-grease',
        targetName,
        saveDc: tracking.saveDc,
        saveType: tracking.saveType,
        success: true,
        description: `${targetName} succeeded on ${tracking.saveType} save against Grease.`,
    }).catch((e) => { console.error("[greaseAreaSave] Error:", e); });
}

export async function processGreaseAreaSave(casterName, targetName, campaignName, _mapName) {
    const trackingKey = getGreaseTrackingKey(casterName);
    const tracking = getRuntimeValue(casterName, trackingKey, campaignName);

    if (!tracking || !tracking.center || !tracking.saveDc) {
        return null;
    }

    // Check if target is still in the grease area
    if (!_mapName) return null;

    try {
        const inArea = await isWithinRange(casterName, targetName, tracking.radius);

        if (!inArea) return null;

        if (await greaseTargetIsImmune(targetName, tracking, campaignName)) {
            return null;
        }

        // Check if target is already Prone (no need to re-save)
        if (targetHasCondition(targetName, 'prone', campaignName)) return null;

        // Trigger save for this creature
        const { promptId, promise } = createSaveListener(campaignName, {
            targetName,
            saveType: tracking.saveType,
            saveDc: tracking.saveDc,
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: 'Grease',
            description: `${targetName} must make a ${tracking.saveType} save (DC ${tracking.saveDc}) or become Prone (Grease area).`,
            promptId,
        }).catch((e) => { console.error("[greaseAreaSave] Error:", e); });

        const saveResult = await promise;

        if (!saveResult.success) {
            await recordGreaseFailure(campaignName, casterName, targetName, tracking, saveResult);
        } else {
            await recordGreaseSuccess(campaignName, casterName, targetName, tracking, saveResult);
        }

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Grease',
                description: `${targetName} ${saveResult.success ? 'succeeded' : 'failed'} the ${tracking.saveType} save (DC ${tracking.saveDc}). ${!saveResult.success ? 'Becomes Prone.' : 'Unaffected.'}`,
            },
        };
    } catch {
        return null;
    }
}
