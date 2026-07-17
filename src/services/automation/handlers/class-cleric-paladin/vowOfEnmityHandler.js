import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check Channel Divinity charges
    const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
    const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
    const storedCharges = getRuntimeValue(playerName, 'channelDivinityCharges', campaignName);
    const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;

    if (currentCharges <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: 'No Channel Divinity charges remaining.',
                automation: auto,
            },
        };
    }

    // Get the current combat target
    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerName) : null;
    const targetName = target?.name || null;

    if (!targetName) {
        return {
            type: 'modal',
            modalName: 'vowOfEnmityTarget',
            payload: {
                action,
                playerStats,
                campaignName,
            },
        };
    }

    return activateVowOfEnmity(action, playerStats, campaignName, targetName, currentCharges);
}

export async function applyTargetChoice(action, playerStats, campaignName, chosenTargetName) {
    if (!chosenTargetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: action.automation.type,
                description: 'No target selected.',
                automation: action.automation,
            },
        };
    }
    const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
    const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
    const storedCharges = getRuntimeValue(playerStats.name, 'channelDivinityCharges', campaignName);
    const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;
    return activateVowOfEnmity(action, playerStats, campaignName, chosenTargetName, currentCharges);
}

async function activateVowOfEnmity(action, playerStats, campaignName, targetName, currentCharges) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const previousTarget = getRuntimeValue(playerName, 'vowOfEnmityTarget', campaignName);

    // Determine if this is a free reactivation (previous target at 0 HP or missing)
    let isFree = false;
    let costMessage = '';

    if (previousTarget) {
        // Check if previous target is defeated or removed
        const cs = await getCombatContext(campaignName);
        const prevCreature = cs?.creatures?.find(c => c.name === previousTarget);

        if (prevCreature) {
            const prevHp = prevCreature.currentHp ?? prevCreature.hit_points?.current ?? 0;
            if (prevHp <= 0) {
                isFree = true;
                costMessage = ' Previous target defeated — no Channel Divinity cost.';
            }
        } else {
            // Previous target not in combatSummary — missing
            isFree = true;
            costMessage = ' Previous target removed from combat — no Channel Divinity cost.';
        }
    }

    let description;

    if (isFree) {
        // Free reactivation
        if (previousTarget && previousTarget !== targetName) {
            description = `${action.name} reactivated against ${targetName}. Transferred from ${previousTarget}.${costMessage}`;
        } else {
            description = `${action.name} reactivated against ${targetName}.${costMessage}`;
        }
    } else {
        // Costs 1 CD
        const newCharges = currentCharges - 1;
        await setRuntimeValue(playerName, 'channelDivinityCharges', newCharges, campaignName);
        costMessage = newCharges > 0 ? ` (${newCharges} Channel Divinity charge${newCharges !== 1 ? 's' : ''} remaining).` : ' (Channel Divinity depleted).';

        if (previousTarget && previousTarget !== targetName) {
            description = `${action.name} transferred from ${previousTarget} to ${targetName}.${costMessage}`;
        } else {
            description = `${action.name} activated against ${targetName}.${costMessage}`;
        }
    }

    // Store the vow target and cost flag
    await setRuntimeValue(playerName, 'vowOfEnmityTarget', targetName, campaignName);
    await setRuntimeValue(playerName, 'vowOfEnmityCostPaid', true, campaignName);

    // Add vow_of_enmity to target's activeBuffs (for contextBuilder and badge)
    const targetBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    const newTargetBuffs = [...targetBuffs, {
        name: action.name,
        effect: 'vow_of_enmity',
        duration: auto.duration || '1_minute',
        source: playerName,
    }];
    await setRuntimeValue(targetName, 'activeBuffs', newTargetBuffs, campaignName);

    // Set up listener to clear vow when target drops to 0 HP
    setupVowTransferListener(playerName, targetName, campaignName);

    // Log to campaign log
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} against ${targetName}.${costMessage}`,
    }).catch((e) => { console.error('[vowOfEnmity] Error logging:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description,
            automation: auto,
        },
    };
}

function setupVowTransferListener(playerName, targetName, campaignName) {
    const checkVowTarget = async () => {
        const cs = await getCombatContext(campaignName);
        if (!cs) return;
        const creature = cs.creatures?.find(c => c.name === targetName);
        if (creature) {
            const currentHp = creature.currentHp ?? creature.hit_points?.current ?? 0;
            if (currentHp <= 0) {
                // Target is at 0 HP - clear the vow from attacker and target
                await setRuntimeValue(playerName, 'vowOfEnmityTarget', null, campaignName);
                await setRuntimeValue(playerName, 'vowOfEnmityCostPaid', null, campaignName);
                const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
                const activeBuffs = Array.isArray(stored) ? stored : [];
                const filtered = activeBuffs.filter(b => b.effect !== 'vow_of_enmity');
                await setRuntimeValue(playerName, 'activeBuffs', filtered, campaignName);

                // Also clear from target's activeBuffs
                const targetBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
                const filteredTargetBuffs = targetBuffs.filter(b => b.effect !== 'vow_of_enmity');
                await setRuntimeValue(targetName, 'activeBuffs', filteredTargetBuffs, campaignName);
            }
        }
    };

    window.addEventListener('combat-summary-updated', checkVowTarget);
}
