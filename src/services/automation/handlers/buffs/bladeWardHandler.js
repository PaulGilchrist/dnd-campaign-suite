import { toggleBuff } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    if (!playerStats) {
        console.error('[bladeWard] Missing playerStats — spell cast context was null');
        return { type: 'popup', payload: { type: 'automation_info', name: action?.name || 'Blade Ward', description: 'Failed to execute Blade Ward' } };
    }
    const auto = action.automation;
    const playerName = playerStats.name;
    const buffName = action.name;

    const { wasActive } = toggleBuff(
        playerName,
        buffName,
        { ...auto, effect: 'blade_ward' },
        campaignName
    );

    if (!wasActive) {
        addExpiration({ attackerName: playerName, targetName: playerName, effects: [
            { type: 'remove_active_buff', buffName }
        ], campaignName });

        const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
        const effects = Array.isArray(storedEffects) ? [...storedEffects] : [];
        const bladeWardEffect = {
            target: playerName,
            effect: 'bane_penalty',
            source: playerName,
            displayLabel: 'Blade Ward',
            duration: 'concentration',
        };
        const existingIndex = effects.findIndex(
            te => te.target === playerName && te.effect === 'bane_penalty' && te.source === playerName
        );
        if (existingIndex >= 0) {
            effects[existingIndex] = bladeWardEffect;
        } else {
            effects.push(bladeWardEffect);
        }
        setRuntimeValue('campaign', 'targetEffects', effects, campaignName, true);

        addEntry(campaignName, {
            type: 'automation',
            characterName: playerName,
            abilityName: buffName,
            description: `${buffName} activated — attackers subtract 1d4 from attack rolls against you`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[bladeWard] Error logging activation:', e); });
    } else {
        const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
        const filtered = storedEffects.filter(te => !(te.target === playerName && te.effect === 'bane_penalty' && te.source === playerName));
        if (filtered.length !== storedEffects.length) {
            setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, true);
        }
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: buffName,
            automationType: auto.type,
            description: wasActive
                ? `${buffName} expired`
                : `${buffName} activated — attackers subtract 1d4 from attack rolls against you`,
            automation: auto,
        },
    };
}
