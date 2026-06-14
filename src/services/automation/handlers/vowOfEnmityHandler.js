import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../rules/combat/damageUtils.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check if Vow of Enmity is already active
    const vowKey = 'vowOfEnmityTarget';
    const currentTarget = getRuntimeValue(playerName, vowKey, campaignName);

    if (currentTarget) {
        // Already active - show info about current target
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} is already active against ${currentTarget}. Activate again to change target.`,
                automation: auto,
            },
        };
    }

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

    // Consume Channel Divinity charge
    await setRuntimeValue(playerName, 'channelDivinityCharges', currentCharges - 1, campaignName);

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

    return activateVowOfEnmity(action, playerStats, campaignName, targetName);
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
    return activateVowOfEnmity(action, playerStats, campaignName, chosenTargetName);
}

async function activateVowOfEnmity(action, playerStats, campaignName, targetName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Store the vow target
    await setRuntimeValue(playerName, 'vowOfEnmityTarget', targetName, campaignName);

    // Also add to activeBuffs for contextBuilder to detect
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const newBuffs = [...activeBuffs, {
        name: action.name,
        effect: 'vow_of_enmity',
        duration: auto.duration || '1_minute',
        target: targetName,
    }];
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    // Set up listener to clear vow when target drops to 0 HP
    setupVowTransferListener(playerName, targetName, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated against ${targetName}. You have advantage on attack rolls against ${targetName} for 1 minute or until used again.`,
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
                // Target is at 0 HP - clear the vow
                await setRuntimeValue(playerName, 'vowOfEnmityTarget', null, campaignName);
                const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
                const activeBuffs = Array.isArray(stored) ? stored : [];
                const filtered = activeBuffs.filter(b => b.effect !== 'vow_of_enmity');
                setRuntimeValue(playerName, 'activeBuffs', filtered, campaignName);
            }
        }
    };

    window.addEventListener('combat-summary-updated', checkVowTarget);
}
