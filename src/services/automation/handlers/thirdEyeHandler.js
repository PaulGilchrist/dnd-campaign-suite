import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { getActiveBuffs } from '../common/buffToggle.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const activeBuffs = getActiveBuffs(playerName, campaignName);
    const isActive = activeBuffs.some(b => b.name === action.name);

    if (isActive) {
        const buff = activeBuffs.find(b => b.name === action.name);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} is currently active: ${buff?.effect || 'Unknown'}. Duration: until start of Short or Long Rest.`,
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'thirdEye',
        payload: {
            action,
            playerStats,
            campaignName,
        },
    };
}

export async function applyThirdEye(action, playerStats, campaignName, chosenOption) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const optionEffects = {
        'Darkvision (120 feet)': 'darkvision_120',
        'Greater Comprehension': 'greater_comprehension',
        'See Invisibility': 'see_invisibility',
    };

    const effectKey = optionEffects[chosenOption];
    if (!effectKey) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Unknown option: ${chosenOption}`,
                automation: auto,
            },
        };
    }

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];

    // Remove existing Third Eye buff if any (shouldn't be active, but be safe)
    const filteredBuffs = activeBuffs.filter(b => b.name !== action.name);

    const buffEntry = {
        name: action.name,
        effect: effectKey,
        duration: auto.duration || 'short_or_long_rest',
        darkvisionRange: effectKey === 'darkvision_120' ? '120 ft.' : null,
        seeInvisibleRange: effectKey === 'see_invisibility' ? 10 : null,
        hasAutomation: true,
    };

    const newBuffs = [...filteredBuffs, buffEntry];
    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    const descriptions = {
        'darkvision_120': `You gain Darkvision out to a range of 120 feet.`,
        'greater_comprehension': `You can read any language.`,
        'see_invisibility': `You can see invisible creatures and objects within 10 feet of you that are within line of sight.`,
    };

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${action.name}: ${chosenOption} chosen. ${descriptions[effectKey]} (Duration: until start of Short or Long Rest)`,
            automation: auto,
        },
        logEntries: [{
            characterName: playerName,
            type: 'action',
            text: `${action.name}: ${chosenOption}`,
        }],
    };
}
