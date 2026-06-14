import { toggleBuff } from '../common/buffToggle.js';
import { addExpiration } from '../../rules/effects/expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

const SAVE_ADVANTAGE_CONDITIONS_KEY = 'auraOfPuritySaveAdvantageConditions';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const resistanceTypes = auto.resistanceTypes || [];
    const saveAdvantageConditions = auto.saveAdvantageConditions || [];
    const auraRange = auto.auraRange || 30;

    const { wasActive } = toggleBuff(
        playerName,
        action.name,
        {
            ...auto,
            effect: 'aura_of_purity',
            resistanceTypes,
            auraRange,
        },
        campaignName
    );

    if (!wasActive) {
        addExpiration(playerName, playerName, [
            { type: 'remove_active_buff', buffName: action.name }
        ], campaignName);

        setRuntimeValue(
            playerName,
            SAVE_ADVANTAGE_CONDITIONS_KEY,
            saveAdvantageConditions,
            campaignName
        );
    } else {
        setRuntimeValue(
            playerName,
            SAVE_ADVANTAGE_CONDITIONS_KEY,
            [],
            campaignName
        );
    }

    const resistanceDesc = resistanceTypes.length > 0
        ? ` Allies in aura have Resistance to ${resistanceTypes.join(' and ')} damage.`
        : '';
    const saveAdvDesc = saveAdvantageConditions.length > 0
        ? ` Allies in aura have Advantage on saving throws to avoid or end effects that include the ${saveAdvantageConditions.join(', ')} condition.`
        : '';

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: wasActive
                ? `${action.name} deactivated${resistanceDesc}${saveAdvDesc}`
                : `${action.name} activated${resistanceDesc}${saveAdvDesc}`,
            automation: auto,
        },
    };
}

export function getAuraOfPuritySaveAdvantageConditions(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, SAVE_ADVANTAGE_CONDITIONS_KEY, campaignName);
    return Array.isArray(stored) ? stored : [];
}

export function isAuraOfPurityActive(playerName, campaignName) {
    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
    return activeBuffs.some(b => b.name === 'Aura of Purity' && b.effect === 'aura_of_purity');
}
