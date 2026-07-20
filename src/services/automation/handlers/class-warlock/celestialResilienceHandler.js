import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { addEntry } from '../../../ui/logService.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';

export async function grantCelestialResilience(playerStats, campaignName, source, mapName) {
    const isCelestial = playerStats.class?.major?.name === 'Celestial Patron'
        || playerStats.class?.subclass?.name === 'Celestial Patron';

    if (!isCelestial) return null;

    const features = playerStats.specialActions || [];
    const feature = features.find(f => f.name === 'Celestial Resilience');
    if (!feature) return null;

    const auto = feature.automation;
    if (!auto) return null;

    const selfTempHp = evaluateAutoExpression(auto.tempHpExpression || 'warlock level + CHA modifier', playerStats);
    if (typeof selfTempHp !== 'number' || selfTempHp <= 0) return null;

    const existingTempHp = Number(getRuntimeValue(playerStats.name, 'tempHp', campaignName) || 0);
    await setRuntimeValue(playerStats.name, 'tempHp', Math.max(existingTempHp, selfTempHp), campaignName);

    const result = {
        selfTempHp,
        message: `${playerStats.name} gains ${selfTempHp} temporary hit points from Celestial Resilience.`,
    };

    if (source === 'magical_cunning') {
        const allyTempHp = evaluateAutoExpression(auto.allyTempHpExpression || 'floor(warlock level / 2) + CHA modifier', playerStats);
        if (typeof allyTempHp === 'number' && allyTempHp > 0) {
            const maxAllies = auto.maxAllies || 5;
            const rangeFt = rangeToFeet(auto.range || '60_ft');
            const allies = [];

            if (rangeFt != null && mapName) {
                const mapPlayers = (await loadMapData(campaignName, mapName))?.players || [];
                for (const p of mapPlayers) {
                    if (p.name === playerStats.name) continue;
                    if (allies.length >= maxAllies) break;
                    const inRange = await isWithinRange(playerStats.name, p.name, rangeFt);
                    if (inRange) {
                        allies.push({ name: p.name, type: 'player', currentHp: p.currentHp || 0, maxHp: p.maxHp || 0 });
                    }
                }
            }

            result.allyTempHp = allyTempHp;
            result.maxAllies = maxAllies;
            result.allies = allies;
        }
    }

    return result;
}

export async function handle(action, playerStats, campaignName, mapName) {
    if (!mapName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${playerStats.name} gains temporary hit points from Celestial Resilience when using Magical Cunning or finishing a Short or Long Rest.`,
                automation: action.automation,
            },
        };
    }

    const result = await grantCelestialResilience(playerStats, campaignName, 'magical_cunning', mapName);
    if (!result) return null;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: result.message,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[celestialResilience] Error:", e); });

    if (result.allyTempHp && result.maxAllies && result.allies && result.allies.length > 0) {
        return {
            type: 'modal',
            modalName: 'celestialResilienceModal',
            payload: {
                creatureTargets: result.allies,
                allyTempHp: result.allyTempHp,
                selfTempHp: result.selfTempHp,
                maxTargets: result.maxAllies,
                action: action,
            },
        };
    }

    let popupMessage = result.message;
    if (result.allies && result.allies.length === 0 && result.allyTempHp) {
        popupMessage += ` No allies in range to gain ${result.allyTempHp} temporary hit points.`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: popupMessage,
            automation: action.automation,
        },
    };
}

export async function confirmCelestialResilience(action, playerStats, campaignName, selectedTargets) {
    if (!selectedTargets || selectedTargets.length === 0) {
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${playerStats.name} selected no allies for Celestial Resilience.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[celestialResilience] Error:", e); });
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${playerStats.name} selected no allies.`,
                automation: action.automation,
            },
        };
    }

    const features = playerStats.specialActions || [];
    const feature = features.find(f => f.name === 'Celestial Resilience');
    const auto = feature?.automation;
    const allyTempHp = evaluateAutoExpression(auto?.allyTempHpExpression || 'floor(warlock level / 2) + CHA modifier', playerStats);

    for (const targetName of selectedTargets) {
        await setRuntimeValue(targetName, 'tempHp', allyTempHp, campaignName);
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} grants ${allyTempHp} temporary hit points to ${selectedTargets.length} ally(ies): ${selectedTargets.join(', ')}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[celestialResilience] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${playerStats.name} grants ${allyTempHp} temporary hit points to ${selectedTargets.join(', ')}.`,
            automation: action.automation,
        },
    };
}

export async function skipCelestialResilience(action, playerStats, campaignName) {
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} skipped granting temporary hit points to allies via Celestial Resilience.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[celestialResilience] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${playerStats.name} skipped granting temporary hit points to allies.`,
            automation: action.automation,
        },
    };
}
