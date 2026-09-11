import { setTempHp } from '../buffs/tempHpService.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { addEntry } from '../../../ui/logService.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

export async function grantCelestialResilience(playerStats, campaignName, source, _mapName) {
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

    await setTempHp(playerStats.name, selfTempHp, campaignName);

    const result = {
        selfTempHp,
        message: `${playerStats.name} gains ${selfTempHp} temporary hit points from Celestial Resilience.`,
    };

    if (source === 'magical_cunning' || source === 'short_rest' || source === 'long_rest') {
        await attachAllyGrant(result, playerStats, campaignName, auto, _mapName);
    }

    return result;
}

async function attachAllyGrant(result, playerStats, campaignName, auto, mapName) {
    const allyTempHp = evaluateAutoExpression(auto.allyTempHpExpression || 'floor(warlock level / 2) + CHA modifier', playerStats);
    if (typeof allyTempHp !== 'number' || allyTempHp <= 0) return;

    const rangeFt = rangeToFeet(auto.range || '60_ft');
    const allies = [];

    if (rangeFt != null) {
        const mapPlayers = mapName ? (await loadMapData(campaignName, mapName))?.players || [] : [];
        const combatSummary = getCombatSummary(campaignName);
        const allCreatures = combatSummary?.creatures || [];
        const candidates = mapPlayers.length > 0
            ? mapPlayers.filter(p => p.name !== playerStats.name)
            : allCreatures.filter(c => c.name !== playerStats.name);
        for (const creature of candidates) {
            if (await isWithinRange(playerStats.name, creature.name, rangeFt)) {
                allies.push({ name: creature.name, type: creature.type || 'player', currentHp: creature.currentHp || 0, maxHp: creature.maxHp || 0 });
            }
        }
    }

    result.allyTempHp = allyTempHp;
    result.maxAllies = auto.maxAllies || 5;
    result.allies = allies;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    if (!_mapName) {
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

    const result = await grantCelestialResilience(playerStats, campaignName, 'magical_cunning', _mapName);
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
        await setTempHp(targetName, allyTempHp, campaignName);
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
