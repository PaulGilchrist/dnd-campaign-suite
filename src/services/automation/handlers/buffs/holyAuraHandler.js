import { toggleBuff } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const HOLY_AURA_TARGETS_KEY = 'holyAuraTargets';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const auraRange = auto.auraRange || 30;

    const { wasActive } = toggleBuff(
        playerName,
        action.name,
        {
            ...auto,
            effect: 'holy_aura',
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
            HOLY_AURA_TARGETS_KEY,
            [],
            campaignName
        );
    } else {
        setRuntimeValue(
            playerName,
            HOLY_AURA_TARGETS_KEY,
            [],
            campaignName
        );
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: wasActive
                ? `${action.name} deactivated`
                : `${action.name} activated`,
            automation: auto,
        },
    };
}

export function getHolyAuraTargets(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, HOLY_AURA_TARGETS_KEY, campaignName);
    return Array.isArray(stored) ? stored : [];
}

export function isHolyAuraActive(playerName, campaignName) {
    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
    return activeBuffs.some(b => b.name === 'Holy Aura' && b.effect === 'holy_aura');
}
