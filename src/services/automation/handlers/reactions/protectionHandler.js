import { resolveTarget, resolveMapPositions } from '../../common/targetResolver.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';

function hasShield(playerStats) {
    const equipped = playerStats.inventory?.equipped || [];
    for (const itemName of equipped) {
        if (!itemName || typeof itemName !== 'string') continue;
        const { baseName } = parseMagicItemName(itemName);
        const item = playerStats.equipment?.find(e => e.name === baseName);
        if (item) {
            if (item.armor_category === 'Shield') return true;
        }
    }
    return false;
}

function parseMagicItemName(itemName) {
    if (itemName && typeof itemName === 'string' && itemName.charAt(0) === '+') {
        const magicBonus = Number(itemName.charAt(1));
        return {
            baseName: itemName.substring(3),
            magicBonus: isNaN(magicBonus) ? 0 : magicBonus,
        };
    }
    return { baseName: itemName, magicBonus: 0 };
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Feature';

    if (auto.requiresShield && !hasShield(playerStats)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: You must be wielding a Shield to use this Reaction.`,
                automation: auto,
            },
        };
    }

    const targetInfo = await resolveTarget(campaignName, playerName);
    if (!targetInfo?.target) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} requires a target. Select a creature in combat and try again.`,
                automation: auto,
            },
        };
    }

    const attackerName = targetInfo.target.name;
    const rangeFt = rangeToFeet(auto.range || '5_ft');

    if (mapName && rangeFt != null) {
        const positions = await resolveMapPositions(campaignName, mapName, playerName);
        if (positions?.attackerPos && positions?.targetPos) {
            const dist = getDistanceFeet(positions.attackerPos, positions.targetPos);
            if (dist != null && dist > rangeFt) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: featureName,
                        description: `${attackerName} is out of range (${Math.round(dist)} ft > ${rangeFt} ft).`,
                        automation: auto,
                    },
                };
            }
        }
    }

    const defenderName = targetInfo.target.name;

    await setRuntimeValue(defenderName, 'protectionBuff', {
        source: playerName,
        duration: 'until_start_of_next_turn',
        timestamp: Date.now(),
    }, campaignName);

    const description = `<b>${action.name}</b><br/>You interpose yourself between ${attackerName} and ${defenderName}. ${attackerName} and all other creatures have Disadvantage on attack rolls against ${defenderName} until the start of your next turn.`;

    const result = {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
            automation: auto,
        },
    };

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} to impose Disadvantage on attacks against ${defenderName}.`,
        targetName: defenderName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[protection] Error:", e); });

    return result;
}
