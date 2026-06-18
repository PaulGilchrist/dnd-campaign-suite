import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const costMatch = (auto.cost || '1d6').match(/^(\d+)d6$/);
    const costD6 = costMatch ? parseInt(costMatch[1], 10) : 1;

    const sneakAttack = playerStats.class?.class_levels?.[playerStats.level - 1]?.sneak_attack_num_d6 || 0;
    const sneakAttackDice = sneakAttack || 0;

    if (sneakAttackDice < costD6) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Not enough Sneak Attack dice to use Stealth Attack. Need ${costD6}d6, have ${sneakAttackDice}d6.`,
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'stealthAttack',
        payload: {
            action,
            playerStats,
            campaignName,
            costD6,
            availableDice: sneakAttackDice,
        },
    };
}

export async function applyStealthAttack(action, playerStats, campaignName, costD6) {
    const auto = action.automation;
    const sneakAttack = playerStats.class?.class_levels?.[playerStats.level - 1]?.sneak_attack_num_d6 || 0;
    const sneakAttackDice = sneakAttack || 0;

    if (sneakAttackDice < costD6) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Not enough Sneak Attack dice. Need ${costD6}d6, have ${sneakAttackDice}d6.`,
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerStats.name, 'stealthAttackCost', costD6, campaignName, true);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `Stealth Attack enabled — next attack will cost ${costD6}d6 Sneak Attack dice and preserve Invisible condition with cover.`,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `Stealth Attack active. Next attack will cost ${costD6}d6 Sneak Attack dice. If you have Invisible from Hide, it won't end when you attack or end turn behind 3/4 or Total Cover.`,
            automation: auto,
        },
    };
}
