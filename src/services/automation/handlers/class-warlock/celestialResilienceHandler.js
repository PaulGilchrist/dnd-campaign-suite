import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { addEntry } from '../../../ui/logService.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';

export async function grantCelestialResilience(playerStats, campaignName, source, mapName) {
    const isCelestial = playerStats.class?.major?.name === 'Celestial Patron'
        || playerStats.class?.subclass?.name === 'Celestial Patron';

    if (!isCelestial) return null;

    const features = playerStats.characterAdvancement || [];
    const feature = features.find(f => f.name === 'Celestial Resilience');
    if (!feature) return null;

    const auto = feature.automation;
    if (!auto) return null;

    const selfTempHp = evaluateAutoExpression(auto.tempHpExpression || 'warlock level + CHA modifier', playerStats);
    if (typeof selfTempHp !== 'number' || selfTempHp <= 0) return null;

    const existingTempHp = Number(getRuntimeValue(playerStats.name, 'tempHp', campaignName) || 0);
    await setRuntimeValue(playerStats.name, 'tempHp', existingTempHp + selfTempHp, campaignName);

    const result = {
        selfTempHp,
        message: `Celestial Resilience: You gain ${selfTempHp} temporary hit points.`,
    };

    if (source === 'magical_cunning') {
        const allyTempHp = evaluateAutoExpression(auto.allyTempHpExpression || 'floor(warlock level / 2) + CHA modifier', playerStats);
        if (typeof allyTempHp === 'number' && allyTempHp > 0) {
            const maxAllies = auto.maxAllies || 5;
            const rangeFt = rangeToFeet(auto.range || '60_ft');
            const targets = [];

            if (mapName && rangeFt != null) {
                const attackerPlayer = await loadMapData(campaignName, mapName).then(md => md?.players?.find(p => p.name === playerStats.name));
                if (attackerPlayer) {
                    const attackerPos = { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY };
                    const mapPlayers = (await loadMapData(campaignName, mapName))?.players || [];
                    for (const p of mapPlayers) {
                        if (p.name === playerStats.name) continue;
                        if (targets.length >= maxAllies) break;
                        const pos = { gridX: p.gridX, gridY: p.gridY };
                        const dist = getDistanceFeet(attackerPos, pos);
                        if (dist != null && dist <= rangeFt) {
                            targets.push(p.name);
                        }
                    }
                }
            }

            for (const targetName of targets) {
                await setRuntimeValue(targetName, 'tempHp', allyTempHp, campaignName);
            }

            result.allyTempHp = allyTempHp;
            result.maxAllies = maxAllies;
            result.allies = targets;
            result.allyMessage = targets.length > 0
                ? ` Up to ${maxAllies} creatures you can see gain ${allyTempHp} temporary hit points (${targets.join(', ')}).`
                : ` Up to ${maxAllies} creatures you can see may gain ${allyTempHp} temporary hit points.`;
        }
    }

    return result;
}

export async function handle(action, playerStats, campaignName, mapName) {
    const result = await grantCelestialResilience(playerStats, campaignName, 'magical_cunning', mapName);
    if (!result) return null;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} gained ${result.selfTempHp} temporary hit points from Celestial Resilience.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[celestialResilience] Error:", e); throw e; });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: result.message + (result.allyMessage || ''),
            automation: action.automation,
        },
    };
}
