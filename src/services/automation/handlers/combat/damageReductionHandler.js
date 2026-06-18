import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { addEntry } from '../../../ui/logService.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

function hasShield(playerStats) {
    const equipped = playerStats.inventory?.equipped || [];
    for (const itemName of equipped) {
        if (!itemName || typeof itemName !== 'string') continue;
        const { baseName } = parseMagicItemName(itemName);
        const item = playerStats.equipment?.find(e => e.name === baseName);
        if (item) {
            if (item.equipment_category === 'Shield') return true;
        }
    }
    return false;
}

function hasShieldOrWeapon(playerStats) {
    const equipped = playerStats.inventory?.equipped || [];
    for (const itemName of equipped) {
        if (!itemName || typeof itemName !== 'string') continue;
        const { baseName } = parseMagicItemName(itemName);
        const item = playerStats.equipment?.find(e => e.name === baseName);
        if (item) {
            if (item.equipment_category === 'Shield') return true;
            if (item.equipment_category === 'Weapon') return true;
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

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    if (auto.requiresShield && !hasShield(playerStats)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: You must be holding a Shield to use this Reaction.`,
                automation: auto,
            },
        };
    }

    if (auto.effect === 'zero_on_success_half_on_fail') {
        return handleZeroOnSuccessHalfOnFail(action, playerStats, campaignName);
    }

    if (auto.requiresShieldOrWeapon && !hasShieldOrWeapon(playerStats)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: You must be holding a Shield or a Simple or Martial weapon to use this Reaction.`,
                automation: auto,
            },
        };
    }

    const reduction = evaluateAutoExpression(auto.reductionExpression, playerStats);
    const reductionDisplay = typeof reduction === 'number' ? String(reduction) : (reduction || auto.reductionExpression);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} to reduce damage by ${reductionDisplay}.`,
    });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: Reduce damage by <strong>${reductionDisplay}</strong>.${auto.trigger ? ` Trigger: ${auto.trigger}.` : ''}`,
            automation: auto,
        },
    };
}

async function handleZeroOnSuccessHalfOnFail(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Intervene Shield';

    setRuntimeValue(playerName, 'interveneShieldActive', true, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} activated ${featureName}. Next Dex save for half damage: no damage on success, half on fail.`,
        timestamp: Date.now(),
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: auto.type,
            description: `${featureName} activated. The next time you would take damage from an effect that allows a Dexterity saving throw for half damage, you take no damage on a successful save and half damage on a failed save.`,
            automation: auto,
        },
    };
}
