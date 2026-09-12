import { getRuntimeValue, setRuntimeObject, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { isBuffActive } from '../../common/buffToggle.js';
import { KEY as PENDING_EXPIRATIONS_KEY } from '../../../rules/effects/expirations.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { parseDurationRounds } from '../../../rules/effects/durationParser.js';
import { addEntry } from '../../../ui/logService.js';

const STONECANNING_USES_KEY = 'stonecunningUses';
// The engine tracks buff durations in rounds (durationParser scopes "minute"
// durations to the encounter); 10 minutes = 100 rounds, mirroring
// SACRED_WEAPON_ROUNDS in sacredWeaponHandler.js.
const STONECANNING_ROUNDS = 100;

function resolveStonecunningUsesMax(auto, playerStats) {
    if (auto.uses === 'proficiency_bonus') {
        return playerStats.proficiency || 0;
    }
    if (typeof auto.uses === 'number') {
        return auto.uses;
    }
    return auto.usesMax != null ? auto.usesMax : 1;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Stonecunning';

    const usesKey = STONECANNING_USES_KEY;

    const usesMax = resolveStonecunningUsesMax(auto, playerStats);

    const stored = getRuntimeValue(playerName, usesKey, campaignName);
    const usesRemaining = stored != null ? Number(stored) : usesMax;

    if (!(usesRemaining > 0)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                automationType: auto.type,
                description: `${featureName} has no uses remaining. Recharges on a Long Rest.`,
                automation: auto,
            },
        };
    }

    // Re-click while active refuses without touching state (CLA-334 BUG-2):
    // mirrors naturesSanctuaryHandler — no buff removal, no use spent.
    if (isBuffActive(playerName, featureName, campaignName)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                automationType: auto.type,
                description: `${featureName} is already active. It lasts ${auto.duration || '10 minutes'}.`,
                automation: auto,
            },
        };
    }

    const newUses = usesRemaining - 1;
    const storedBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(storedBuffs) ? storedBuffs : [];

    // The server replaces the whole character object with each full-store
    // POST body (server/routes/campaigns-changedata.js), so two POSTs race
    // regardless of client-side sequencing (playbook §6-#18) — live probe
    // showed a separate addExpiration POST losing the race (exps stayed []).
    // Everything therefore lands in ONE merged setRuntimeObject POST: the
    // buff, the uses decrement (CLA-334 BUG-1), and the duration expiration
    // (CLA-334 BUG-3). Entry shape is identical to expirationQueue.js
    // addExpiration entries; consumed by expireStaleEffects →
    // clearExpirationEffects 'remove_active_buff'.
    const storedExpirations = getRuntimeValue(playerName, PENDING_EXPIRATIONS_KEY, campaignName);
    const expirations = Array.isArray(storedExpirations) ? storedExpirations : [];

    setRuntimeObject(playerName, {
        activeBuffs: [...activeBuffs, {
            name: featureName,
            effect: auto.effect,
            duration: auto.duration || '10_minutes',
            castingTime: auto.casting_time || '',
            sourceCharacter: playerName,
        }],
        [usesKey]: newUses,
        [PENDING_EXPIRATIONS_KEY]: [...expirations, {
            target: playerName,
            effects: [{ type: 'remove_active_buff', buffName: featureName }],
            appliedRound: getCurrentCombatRound(campaignName),
            expiryRounds: parseDurationRounds(auto.duration) || STONECANNING_ROUNDS,
            expireOnCreatureName: null,
        }],
    }, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${featureName} activated. Tremorsense 60 ft. (${newUses} use${newUses !== 1 ? 's' : ''} remaining).`,
    }).catch((e) => { console.error("[stonecunning] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: auto.type,
            description: `${featureName} activated on yourself (1 bonus action, ${auto.duration || '10 min'}) — ${newUses} use${newUses !== 1 ? 's' : ''} remaining.`,
            automation: auto,
        },
    };
}

export function restoreUses(playerName, campaignName) {
    setRuntimeValue(playerName, STONECANNING_USES_KEY, null, campaignName);
}
