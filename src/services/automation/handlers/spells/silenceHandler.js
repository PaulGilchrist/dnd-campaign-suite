import { toggleBuff } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { isSilenceActive as isSilenceActiveService } from '../../../rules/features/silenceService.js';

const SILENCE_EFFECT = 'silence';
const SILENCE_KEY = 'silenceCaster';
const SILENCE_CENTER_KEY = 'silenceCenter';
const SILENCE_RADIUS_KEY = 'silenceRadius';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const buffName = action.name;

    const aoeRadius = auto.aoeRadius || 20;

    const combatSummary = await getCombatContext(campaignName);
    let centerGrid = null;

    if (combatSummary) {
        const casterPos = combatSummary.players?.find(p => p.name === playerName);
        if (casterPos && casterPos.gridX != null && casterPos.gridY != null) {
            centerGrid = { gridX: casterPos.gridX, gridY: casterPos.gridY };
        }
    }

    const { wasActive } = toggleBuff(
        playerName,
        buffName,
        { ...auto, effect: SILENCE_EFFECT, aoeRadius },
        campaignName
    );

    if (!wasActive) {
        setRuntimeValue(playerName, SILENCE_KEY, true, campaignName);
        setRuntimeValue(playerName, SILENCE_CENTER_KEY, centerGrid ? JSON.stringify(centerGrid) : null, campaignName);
        setRuntimeValue(playerName, SILENCE_RADIUS_KEY, aoeRadius, campaignName);

        addExpiration(playerName, playerName, [
            { type: 'remove_active_buff', buffName }
        ], campaignName);

        await postLogEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: buffName,
            description: `${playerName} cast ${buffName} — a ${aoeRadius}-foot-radius sphere of silence is created. Creatures inside are Deafened and immune to Thunder damage. Verbal spell components cannot be used inside.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[silence] Error:", e); });
    } else {
        setRuntimeValue(playerName, SILENCE_KEY, false, campaignName);
        setRuntimeValue(playerName, SILENCE_CENTER_KEY, null, campaignName);
        setRuntimeValue(playerName, SILENCE_RADIUS_KEY, null, campaignName);
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: buffName,
            automationType: auto.type,
            description: wasActive
                ? `${buffName} ended`
                : `${buffName} activated — a ${aoeRadius}-foot-radius Sphere of silence centered on you. Creatures entirely inside the sphere are Deafened and immune to Thunder damage. Casting spells with Verbal components is impossible inside.`,
            automation: auto,
        },
    };
}

export function isSilenceActive(playerName, campaignName) {
    return isSilenceActiveService(playerName, campaignName);
}
