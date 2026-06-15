import { toggleBuff } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';

const STEALTH_BONUS_KEY = 'passWithoutTraceStealthBonus';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const auraRange = auto.auraRange || 30;

    const { wasActive } = toggleBuff(
        playerName,
        action.name,
        {
            ...auto,
            effect: 'pass_without_trace',
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
            STEALTH_BONUS_KEY,
            10,
            campaignName
        );
    } else {
        setRuntimeValue(
            playerName,
            STEALTH_BONUS_KEY,
            0,
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
                ? `${action.name} deactivated — aura ends, Stealth bonus removed`
                : `${action.name} activated — you and chosen creatures in 30-ft emanation have +10 to Stealth checks and leave no tracks`,
            automation: auto,
        },
    };
}

export function getPassWithoutTraceStealthBonus(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, STEALTH_BONUS_KEY, campaignName);
    return typeof stored === 'number' ? stored : 0;
}

export function isPassWithoutTraceActive(playerName, campaignName) {
    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
    return activeBuffs.some(b => b.name === 'Pass Without Trace' && b.effect === 'pass_without_trace');
}
