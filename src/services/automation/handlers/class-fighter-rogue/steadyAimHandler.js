import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const MOVED_THIS_TURN_KEY = 'steadyAimMovedThisTurn';
const SPEED_ZERO_KEY = 'steadyAimSpeedZero';

// Check if the player has Roving Aim (Assassin level 9) which prevents speed reduction
function playerHasRovingAim(playerStats) {
    const passives = ((playerStats.automation || {}).passives || []);
    return passives.some(p => p.name === 'Infiltration Expertise' && p.effect === 'roving_aim')
        || passives.some(p => p.effect === 'roving_aim');
}

async function cancelSteadyAim(playerName, campaignName, hasRovingAim) {
    await setRuntimeValue(playerName, SPEED_ZERO_KEY, false, campaignName);
    await setRuntimeValue(playerName, MOVED_THIS_TURN_KEY, false, campaignName);
    if (!hasRovingAim) {
        const storedConds = getRuntimeValue(playerName, 'activeConditions', campaignName) || [];
        const filtered = storedConds.filter(c => String(c).toLowerCase() !== 'speed_zero');
        await setRuntimeValue(playerName, 'activeConditions', filtered, campaignName);
    }
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check if the player has moved this turn
    const hasMoved = getRuntimeValue(playerName, MOVED_THIS_TURN_KEY, campaignName);
    if (hasMoved) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} — You must not have moved this turn to use this feature.`,
                automation: auto,
            },
        };
    }

    const hasRovingAim = playerHasRovingAim(playerStats);

    // Check if already active (toggle off)
    const isActive = getRuntimeValue(playerName, SPEED_ZERO_KEY, campaignName);
    if (isActive) {
        await cancelSteadyAim(playerName, campaignName, hasRovingAim);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} cancelled.`,
                automation: auto,
            },
        };
    }

    // Activate: set moved flag, apply speed_zero (unless Roving Aim), grant next_attack_advantage
    await setRuntimeValue(playerName, MOVED_THIS_TURN_KEY, true, campaignName);
    await setRuntimeValue(playerName, SPEED_ZERO_KEY, true, campaignName);

    // Apply speed_zero condition (unless Roving Aim prevents it)
    if (!hasRovingAim) {
        const storedConds = getRuntimeValue(playerName, 'activeConditions', campaignName) || [];
        const hasSpeedZero = storedConds.some(c => String(c).toLowerCase() === 'speed_zero');
        if (!hasSpeedZero) {
            await setRuntimeValue(playerName, 'activeConditions', [...storedConds, 'speed_zero'], campaignName);
        }
    }

    // Apply next_attack_advantage to self via targetEffects
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const newEffect = {
        target: playerName,
        source: action.name,
        effect: 'next_attack_advantage',
        value: null,
        duration: auto.duration || 'until_end_of_turn',
    };
    await setRuntimeValue('campaign', 'targetEffects', [...storedEffects, newEffect], campaignName);

    // Log the ability use
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used Steady Aim — Speed 0 until end of turn, Advantage on next attack roll.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[steadyAim] Error:", e); });

    let description = `${action.name} activated! You have Advantage on your next attack roll.`;
    if (hasRovingAim) {
        description += ` (Roving Aim: Speed not reduced to 0)`;
    } else {
        description += ` Your Speed is 0 until the end of the current turn.`;
    }

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

export function markAsMoved(playerName, campaignName) {
    setRuntimeValue(playerName, MOVED_THIS_TURN_KEY, true, campaignName);
}

export function clearMovementFlag(playerName, campaignName) {
    setRuntimeValue(playerName, MOVED_THIS_TURN_KEY, false, campaignName);
}

export function clearSpeedZero(playerName, campaignName) {
    setRuntimeValue(playerName, SPEED_ZERO_KEY, false, campaignName);
}
