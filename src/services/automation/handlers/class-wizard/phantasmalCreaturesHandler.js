import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const HANDLER_MODAL = 'phantasmalCreatures';
const HANDLER_CONFIRM = 'phantasmal_creatures_confirm';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Phantasmal Creatures';

    const freeCastCountKey = `_${featureName.replace(/\s+/g, '_')}_freeCastCount`;
    const currentCount = Number(getRuntimeValue(playerName, freeCastCountKey, campaignName) ?? auto.usesMax);

    if (currentCount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: 'No free casts remaining. Finish a Long Rest to regain them.',
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: HANDLER_MODAL,
        payload: {
            action,
            playerStats,
            campaignName,
            noConcentrationOption: true,
        },
    };
}

export async function confirmPhantasmalCreatures(action, playerStats, campaignName, noConcentration) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Phantasmal Creatures';

    const freeCastCountKey = `_${featureName.replace(/\s+/g, '_')}_freeCastCount`;
    const currentCount = Number(getRuntimeValue(playerName, freeCastCountKey, campaignName) ?? auto.usesMax);

    if (currentCount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: 'No free casts remaining. Finish a Long Rest to regain them.',
                automation: auto,
            },
        };
    }

    const newCount = currentCount - 1;
    await setRuntimeValue(playerName, freeCastCountKey, newCount, campaignName);

    const spellNames = auto.freeCastSpells || ['Summon Beast', 'Summon Fey'];
    const spellNameList = spellNames.join(' or ');

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${featureName}: Free cast of ${spellNameList} (${newCount} remaining). The spell school becomes Illusion and the summoned creature's HP is halved.<br/><br/><em>Open your spell sheet and cast Summon Beast or Summon Fey normally — no spell slot will be consumed.</em>`,
            automation: { ...auto, noConcentration, halvedHp: true },
        },
    };
}

export { HANDLER_MODAL as modalName, HANDLER_CONFIRM as confirmType };
