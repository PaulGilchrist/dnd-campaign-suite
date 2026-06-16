import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { addEntry } from '../../../ui/logService.js';

export async function grantDarkOnesBlessing(playerStats, campaignName, attackerName, mapName) {
    const isFiend = playerStats.class?.subclass?.name === 'Fiend Patron';
    if (!isFiend) return null;

    const features = playerStats.characterAdvancement || [];
    const feature = features.find(f => f.name === "Dark One's Blessing");
    if (!feature) return null;

    const auto = feature.automation;
    if (!auto) return null;

    const amount = evaluateAutoExpression(auto.tempHpExpression || 'CHA modifier + warlock level', playerStats);
    const minimumAmount = Math.max(1, amount);
    if (minimumAmount <= 0) return null;

    const existingTempHp = Number(getRuntimeValue(playerStats.name, 'tempHp', campaignName) || 0);
    await setRuntimeValue(playerStats.name, 'tempHp', existingTempHp + minimumAmount, campaignName);

    const result = {
        message: `Dark One's Blessing: You gain ${minimumAmount} temporary hit points.`,
        amount: minimumAmount,
    };

    if (mapName && attackerName) {
        const rangeFt = rangeToFeet(auto.range || '10_ft');
        if (rangeFt != null) {
            const attackerPlayer = await loadMapData(campaignName, mapName).then(md => md?.players?.find(p => p.name === attackerName));
            if (attackerPlayer) {
                const attackerPos = { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY };
                const mapPlayers = (await loadMapData(campaignName, mapName))?.players || [];
                const playerPlayer = mapPlayers.find(p => p.name === playerStats.name);
                if (playerPlayer) {
                    const playerPos = { gridX: playerPlayer.gridX, gridY: playerPlayer.gridY };
                    const dist = getDistanceFeet(attackerPos, playerPos);
                    if (dist == null || dist > rangeFt) {
                        result.outOfRange = true;
                    }
                }
            }
        }
    }

    return result;
}

export async function handle(action, playerStats, campaignName, mapName) {
    const result = await grantDarkOnesBlessing(playerStats, campaignName, null, mapName);
    if (!result) return null;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} gained ${result.amount} temporary hit points from Dark One's Blessing.`,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: result.message,
            automation: action.automation,
        },
    };
}
