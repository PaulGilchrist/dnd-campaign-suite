import { rollExpression } from '../../dice/diceRoller.js';
import { buildSaveDc } from '../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import * as mapsService from '../../maps/mapsService.js';
import { getCombatContext } from '../../rules/damageUtils.js';
import { rangeToFeet } from '../../rules/rangeValidation.js';

const AREA_SHAPES = new Set(['emanation', 'cone', 'line', 'sphere', 'cube', 'cylinder', 'square', 'circle', 'wall', 'cage', 'floor', 'area']);

function isAreaShape(shape) {
    if (!shape) return false;
    const lower = shape.toLowerCase();
    return AREA_SHAPES.has(lower) || AREA_SHAPES.has(lower.split('_')[0]);
}

function parseDurationRounds(duration) {
    if (!duration) return undefined;
    const lower = duration.toLowerCase();
    if (lower.startsWith('1_minute')) return 10;
    const match = lower.match(/(\d+)_round/);
    if (match) return parseInt(match[1], 10);
    return undefined;
}

export function isExhausted(action, playerStats, campaignName) {
    const auto = action.automation;
    if (!auto) return false;
    if (auto.uses === undefined && auto.usesMax === undefined) return false;
    const maxUses = auto.usesMax ?? auto.uses ?? 1;
    const usesKey = auto.resourceKey || (action.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
    const usesUsed = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? 0);
    return usesUsed >= maxUses;
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;

    const maxUses = auto.usesMax ?? auto.uses ?? 1;

    if (maxUses > 0) {
        const usesKey = auto.resourceKey || (action.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
        const usesUsed = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? 0);
        if (usesUsed >= maxUses) {
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
        await setRuntimeValue(playerStats.name, usesKey, usesUsed + 1, campaignName);
    }

    const dcSuccess = auto.shape === 'cone' ? 0.5 : 0;
    const saveDcValue = buildSaveDc(auto, playerStats);

    if (auto.conditionInflicted && !auto.damage) {
        if (isAreaShape(auto.shape)) {
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

            const rangeFeet = rangeToFeet(auto.shape) || (auto.shape?.includes('emanation_30ft') ? 30 : 30);

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

    const damageResult = rollExpression(auto.damage);
    if (!damageResult) return null;

    return {
        type: 'roll',
        payload: {
            rollType: 'damage',
            name: action.name,
            formula: auto.damage,
            total: damageResult.total,
            rolls: damageResult.rolls,
            modifier: damageResult.modifier,
            contextConfig: {
                damageType: auto.damageType || '',
                saveDc: saveDcValue,
                saveType: auto.saveType || 'DEX',
                dcSuccess,
                attackerName: playerStats.name,
                conditionInflicted: auto.conditionInflicted || null,
                shape: auto.shape || '',
             },
         },
     };
 }
