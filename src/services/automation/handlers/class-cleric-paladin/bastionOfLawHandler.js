import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { addEntry } from '../../../ui/logService.js';
import { rangeToFeet, getDistanceFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions, resolveTarget } from '../../common/targetResolver.js';

const WARD_DICE_KEY = 'bastionOfLawWardDice';
const WARD_TARGET_KEY = 'bastionOfLawWardTarget';
const WARD_ACTIVE_KEY = 'bastionOfLawActive';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Bastion of Law';

    const rangeFt = rangeToFeet(auto.range || '30_ft');

    const targetInfo = await resolveTarget(campaignName, playerName);
    if (!targetInfo?.target) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} requires selecting a creature in combat.`,
                automation: auto,
            },
        };
    }

    const targetName = targetInfo.target.name;

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
                        description: `${targetName} is out of range (${Math.round(dist)} ft > ${rangeFt} ft).`,
                        automation: auto,
                    },
                };
            }
        }
    }

    // Build the SP selection popup
    return {
        type: 'modal',
        modalName: 'bastionOfLaw',
        payload: {
            featureName,
            targetName,
            playerName,
            campaignName,
            auto,
        },
    };
}

export async function handleApply(action, playerStats, campaignName, spAmount, targetName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Bastion of Law';

    const maxSP = auto.maxSP || 5;
    const minSP = auto.minSP || 1;
    const sp = Math.min(maxSP, Math.max(minSP, Number(spAmount) || 1));

    // Check sorcery points availability
    const spPool = getRuntimeValue(playerName, 'sorceryPoints', campaignName);
    const spMax = playerStats.resources?.sorceryPoints?.max || 0;
    const spCurrent = Number(spPool) || spMax;

    if (spCurrent < sp) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: Not enough Sorcery Points. Need ${sp}, have ${spCurrent}.`,
                automation: auto,
            },
        };
    }

    // Deduct sorcery points
    await setRuntimeValue(playerName, 'sorceryPoints', spCurrent - sp, campaignName);

    // Create ward: number of d8 dice equal to SP spent
    const wardDice = Array(sp).fill('1d8');

    // Set ward active state
    await setRuntimeValue(playerName, WARD_ACTIVE_KEY, true, campaignName);
    await setRuntimeValue(playerName, WARD_DICE_KEY, wardDice, campaignName);
    await setRuntimeValue(playerName, WARD_TARGET_KEY, targetName, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} cast ${featureName} on ${targetName}, spending ${sp} Sorcery Points to create a ward with ${sp}d8 dice.`,
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
            description: `${featureName} activated on ${targetName}. Ward has ${sp}d8 dice. Spend dice as a Reaction when ${targetName} takes damage to reduce it.`,
            automation: auto,
        },
    };
}

export async function handleSpendDice(action, playerStats, campaignName, numDice) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Bastion of Law';

    const wardDice = getRuntimeValue(playerName, WARD_DICE_KEY, campaignName) || [];
    const wardTarget = getRuntimeValue(playerName, WARD_TARGET_KEY, campaignName);

    if (!wardTarget || wardDice.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: No ward active.`,
                automation: auto,
            },
        };
    }

    const diceToSpend = Math.min(numDice || 1, wardDice.length);
    const dicePool = wardDice.slice(0, diceToSpend);
    const remainingDice = wardDice.slice(diceToSpend);

    // Roll the dice
    const rollResult = rollExpression(dicePool.join('+'));
    const totalReduction = rollResult?.total || 0;

    // Update remaining dice
    await setRuntimeValue(playerName, WARD_DICE_KEY, remainingDice, campaignName);

    // If no dice remain, deactivate ward
    if (remainingDice.length === 0) {
        await setRuntimeValue(playerName, WARD_ACTIVE_KEY, false, campaignName);
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} spent ${diceToSpend}d8 from ${featureName} ward on ${wardTarget}, reducing damage by ${totalReduction}. ${remainingDice.length} dice remaining.`,
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
            description: `${featureName}: Rolled ${diceToSpend}d8 for total ${totalReduction}. Damage reduced by ${totalReduction}. ${remainingDice.length} dice remaining.`,
            automation: auto,
        },
        damageReduction: totalReduction,
        remainingDice: remainingDice.length,
    };
}

export async function handleClearWard(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    const featureName = action.name || 'Bastion of Law';

    await setRuntimeValue(playerName, WARD_ACTIVE_KEY, false, campaignName);
    await setRuntimeValue(playerName, WARD_DICE_KEY, [], campaignName);
    await setRuntimeValue(playerName, WARD_TARGET_KEY, null, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${featureName} ward cleared.`,
            automation: action.automation,
        },
    };
}
