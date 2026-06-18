import { buildSaveDc } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getDistanceFeet } from '../../../rules/combat/rangeValidation.js';
import * as mapsService from '../../../maps/mapsService.js';
import { playerIsImmuneToCondition } from '../../../combat/automation/automationImmunities.js';

function getAreaRadius(auto) {
    const size = auto.size || '10-foot';
    const match = size.match(/(\d+)-foot/);
    return match ? parseInt(match[1], 10) : 10;
}

function getGreaseTrackingKey(casterName) {
    return `_grease_${casterName.replace(/\s+/g, '_')}`;
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const saveDc = buildSaveDc(auto, playerStats);
    const conditionName = auto.conditionInflicted || 'Prone';
    const saveType = auto.saveType || 'DEX';
    const rangeFeet = getAreaRadius(auto);

    const cs = await getCombatContext(campaignName);

    let casterPos = null;
    let mapData = null;
    if (mapName) {
        try {
            mapData = await mapsService.loadMapData(campaignName, mapName);
            const casterPlayer = mapData?.players?.find(p => p.name === playerStats.name);
            if (casterPlayer) {
                casterPos = { gridX: casterPlayer.gridX, gridY: casterPlayer.gridY };
            }
        } catch { /* positions unavailable */ }
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} activated — ${saveType} save DC ${saveDc}, ${rangeFeet}ft square area.`,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    // Store grease area tracking for recurring saves
    const trackingKey = getGreaseTrackingKey(playerStats.name);
    setRuntimeValue(playerStats.name, trackingKey, {
        caster: playerStats.name,
        center: casterPos,
        mapName,
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

export async function processGreaseAreaSave(casterName, targetName, campaignName, mapName) {
    const trackingKey = getGreaseTrackingKey(casterName);
    const tracking = getRuntimeValue(casterName, trackingKey, campaignName);

    if (!tracking || !tracking.center || !tracking.saveDc) {
        return null;
    }

    // Check if target is still in the grease area
    if (!mapName) return null;

    try {
        const mapData = await mapsService.loadMapData(campaignName, mapName);
        const targetPos = mapData?.players?.find(p => p.name === targetName) ||
                          mapData?.placedItems?.find(i => i.name === targetName);

        if (!targetPos) return null;

        const dist = getDistanceFeet(tracking.center, {
            gridX: targetPos.gridX,
            gridY: targetPos.gridY,
        });

        // Allow some tolerance for square area (check if within radius in either axis)
        const inArea = dist <= tracking.radius;

        if (!inArea) return null;

        // Check condition immunity
        const targetCharacter = (await getCombatContext(campaignName))?.creatures?.find(c => c.name === targetName);
        if (targetCharacter?.type === 'player') {
            const targetStats = {
                computedStats: (await import('../../../../hooks/runtime/useRuntimeState.js')).getRuntimeValue(targetName, 'computedStats', campaignName),
            };
            if (playerIsImmuneToCondition({
                conditionKey: tracking.condition.toLowerCase(),
                playerStats: targetStats,
                getRuntimeValue,
                campaignName,
            })) {
                return null;
            }
        }

        // Check if target is already Prone (no need to re-save)
        const existingConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const isAlreadyProne = existingConditions.some(c => String(c).toLowerCase() === 'prone');
        if (isAlreadyProne) return null;

        // Trigger save for this creature
        const { createSaveListener } = await import('../../common/savePrompt.js');
        const { promptId, promise } = createSaveListener(campaignName, {
            targetName,
            saveType: tracking.saveType,
            saveDc: tracking.saveDc,
        });

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: 'Grease',
            description: `${targetName} must make a ${tracking.saveType} save (DC ${tracking.saveDc}) or become Prone (Grease area).`,
            promptId,
        }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

        const saveResult = await promise;

        if (!saveResult.success) {
            const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            const conditions = Array.isArray(storedConditions) ? storedConditions : [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== tracking.condition.toLowerCase());
            setRuntimeValue(targetName, 'activeConditions', [...filtered, tracking.condition.toLowerCase()], campaignName);

            await addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-grease',
                targetName,
                saveDc: tracking.saveDc,
                saveType: tracking.saveType,
                success: false,
                description: `${targetName} failed ${tracking.saveType} save against Grease. Becomes Prone.`,
            });
        } else {
            await addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-grease',
                targetName,
                saveDc: tracking.saveDc,
                saveType: tracking.saveType,
                success: true,
                description: `${targetName} succeeded on ${tracking.saveType} save against Grease.`,
            });
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
