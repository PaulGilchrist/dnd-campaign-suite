import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

const WARD_DICE_KEY = 'bastionOfLawWardDice';
const WARD_TARGET_KEY = 'bastionOfLawWardTarget';
const WARD_ACTIVE_KEY = 'bastionOfLawActive';
const WARD_SOURCE_KEY = 'bastionOfLawWardSource';
const WARD_USED_KEY = 'bastionOfLawWardUsed';
const LAST_ATTACK_DAMAGE_KEY = 'bastionOfLawLastAttackDamage';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Bastion of Law';

    const maxSP = auto.maxSP || 5;
    const minSP = auto.minSP || 1;

    // Get ally list for the player (includes self if no allies selected)
    const allyNames = getAllyList(playerName);

    // Resolve ally names to creature data from combat summary
    const cs = await getCombatContext(campaignName);
    const creatureTargets = allyNames
        .map(allyName => {
            const creature = cs?.creatures?.find(c => c.name === allyName);
            if (!creature) return null;
            return {
                name: creature.name,
                type: creature.type,
                currentHp: creature.currentHp,
                maxHp: creature.maxHp,
            };
        })
        .filter(Boolean);

    if (creatureTargets.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: No creatures available to select.`,
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'bastionOfLaw',
        payload: {
            featureName,
            creatureTargets,
            playerName,
            campaignName,
            auto,
            maxSP,
            minSP,
        },
    };
}

export async function handleApply(action, playerStats, campaignName, spAmount, targetName) {
    console.error('[bastionOfLaw] handleApply called', { playerName: playerStats.name, spAmount, targetName, campaignName });
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Bastion of Law';

    const maxSP = auto.maxSP || 5;
    const minSP = auto.minSP || 1;
    const sp = Math.min(maxSP, Math.max(minSP, Number(spAmount) || 1));

    // Check sorcery points availability
    const spPool = getRuntimeValue(playerName, 'sorceryPoints');
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

    // Set ward state on the TARGET (not the sorcerer)
    await setRuntimeValue(targetName, WARD_ACTIVE_KEY, true, campaignName);
    await setRuntimeValue(targetName, WARD_DICE_KEY, wardDice, campaignName);
    await setRuntimeValue(targetName, WARD_SOURCE_KEY, playerName, campaignName);
    await setRuntimeValue(targetName, WARD_USED_KEY, 0, campaignName);
    await setRuntimeValue(targetName, LAST_ATTACK_DAMAGE_KEY, 0, campaignName);

    // Also track on sorcerer for long rest cleanup
    await setRuntimeValue(playerName, WARD_TARGET_KEY, targetName, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} activated ${featureName} on ${targetName}, spending ${sp} Sorcery Points to create a ward with ${sp}d8 dice.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: auto.type,
            description: `${featureName} activated on ${targetName}. Ward has ${sp}d8 dice. ${targetName} can use this ward as a Reaction when they take damage.`,
            automation: auto,
        },
    };
}

export async function handleSpendDice(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Bastion of Law';
    const numDice = action.numDice;

    // Check that this character is the target of the last attack
    const cs = await getCombatContext(campaignName);
    const lastAttack = cs?.lastAttack;
    if (!lastAttack || lastAttack.targetName !== playerName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: The last attack did not target you.`,
                automation: auto,
            },
        };
    }

    const wardDice = getRuntimeValue(playerName, WARD_DICE_KEY) || [];
    const wardActive = getRuntimeValue(playerName, WARD_ACTIVE_KEY);

    if (!wardActive || wardDice.length === 0) {
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

    // If no dice count specified, return modal for user to choose
    if (numDice == null || numDice === undefined) {
        const totalDamage = lastAttack.actualDamage ?? (lastAttack.primaryDamage + lastAttack.secondaryDamage);
        await setRuntimeValue(playerName, LAST_ATTACK_DAMAGE_KEY, totalDamage, campaignName);
        await setRuntimeValue(playerName, WARD_USED_KEY, 0, campaignName);
        return {
            type: 'modal',
            modalName: 'bastionOfLawSpend',
            payload: {
                featureName,
                playerName,
                campaignName,
            },
        };
    }

    const diceToSpend = Math.min(numDice || 1, wardDice.length);
    const dicePool = wardDice.slice(0, diceToSpend);
    const remainingDice = wardDice.slice(diceToSpend);

    // Roll the dice (allow pre-rolled result to avoid double-rolling)
    const preRoll = action.preRollResult;
    const rollResult = preRoll || rollExpression(dicePool.join('+'));
    let totalReduction = rollResult?.total || 0;

    // Update remaining dice
    await setRuntimeValue(playerName, WARD_DICE_KEY, remainingDice, campaignName);

    // Clamp healing to remaining unwarded damage
    const lastAttackDamage = getRuntimeValue(playerName, LAST_ATTACK_DAMAGE_KEY) || 0;
    const wardUsed = getRuntimeValue(playerName, WARD_USED_KEY) || 0;
    const remainingDamage = Math.max(0, lastAttackDamage - wardUsed);
    const actualHeal = Math.min(totalReduction, remainingDamage);

    // Heal the target (damage reduction = healing)
    const storedHp = getRuntimeValue(playerName, 'currentHitPoints', campaignName);
    const baseHp = getRuntimeValue(playerName, 'hitPoints', campaignName);
    const maxHp = baseHp || playerStats.hitPoints || 0;
    const currentHp = storedHp ?? 0;
    const newHp = Math.min(maxHp, Math.max(0, currentHp + actualHeal));
    const healedAmount = newHp - currentHp;
    if (healedAmount !== 0) {
        await setRuntimeValue(playerName, 'currentHitPoints', newHp, campaignName);
    }

    // Track ward usage
    const newWardUsed = wardUsed + actualHeal;
    await setRuntimeValue(playerName, WARD_USED_KEY, newWardUsed, campaignName);

    // If no dice remain, deactivate ward (removes the reaction)
    if (remainingDice.length === 0) {
        await setRuntimeValue(playerName, WARD_ACTIVE_KEY, false, campaignName);
        await setRuntimeValue(playerName, WARD_SOURCE_KEY, null, campaignName);
        await setRuntimeValue(playerName, WARD_USED_KEY, null, campaignName);
        await setRuntimeValue(playerName, LAST_ATTACK_DAMAGE_KEY, null, campaignName);
        // Also clear sorcerer tracking
        const wardTarget = getRuntimeValue(playerName, WARD_TARGET_KEY);
        if (wardTarget) {
            await setRuntimeValue(wardTarget, WARD_TARGET_KEY, null, campaignName);
        }
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} spent ${diceToSpend}d8 from ${featureName} ward, reducing damage by ${healedAmount}. ${remainingDice.length} dice remaining.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: auto.type,
            description: `${featureName}: Rolled ${diceToSpend}d8 for total ${totalReduction}. Damage reduced by ${healedAmount}. ${remainingDice.length} dice remaining.`,
            automation: auto,
        },
        damageReduction: totalReduction,
        actualHeal: healedAmount,
        remainingDice: remainingDice.length,
    };
}

export async function handleClearWard(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Bastion of Law';

    // Clear ward tracking from sorcerer
    await setRuntimeValue(playerName, WARD_TARGET_KEY, null, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${featureName} ward tracking cleared.`,
            automation: auto,
        },
    };
}
