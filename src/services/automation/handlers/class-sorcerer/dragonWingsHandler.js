// BUG CLA-099: Dragon Wings once-per-Long-Rest economy. Activation consumes the
// use (dragonWingsUses=0), registers the ONE rounds clock (duration ×rounds —
// playbook §37: minutes×10, hours×600) consumed by EXPIRATION_HANDLERS['dragon_wings'],
// and stamps the active flag. At 0 uses the feature refuses until a Long Rest
// re-arm (LONG_REST_RESOURCES) or 3 SP restores the use (clockworkCavalcade
// consumeUse seam). Re-clicking while the wings stand retracts them via the
// shared dragonWingsService choke point (no use refund).
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { spendSorceryPoints, getCurrentSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { getClassFeatures } from '../../../character/classFeatures.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirationQueue.js';
import {
    DRAGON_WINGS_BUFF_NAME,
    DRAGON_WINGS_EFFECT,
    DRAGON_WINGS_USES_KEY,
    DRAGON_WINGS_ACTIVE_KEY,
    isDragonWingsBuff,
    endDragonWingsBuff,
    formatWingsDuration,
} from '../../../rules/features/dragonWingsService.js';

function wingsDurationToRounds(duration) {
    const match = String(duration || '').match(/^(\d+)_(rounds?|minutes?|hours?)$/i);
    if (!match) {
        console.error(`[dragonWings] Unparseable duration "${duration}" — defaulting to 1 hour (600 rounds)`);
        return 600;
    }
    const n = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('hour')) return n * 600;
    if (unit.startsWith('minute')) return n * 10;
    return n;
}

function infoPopup(featureName, description, auto) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
            automation: auto,
        },
    };
}

function refusalPopup(featureName, restoreCost, auto) {
    return infoPopup(
        featureName,
        `${featureName} has no uses remaining. Recharges on a Long Rest, or you can spend ${restoreCost} Sorcery Points to restore.`,
        auto,
    );
}

async function refuseExhaustedWings({ playerName, featureName, campaignName, auto, restoreCost }) {
    await addEntry(campaignName, {
        type: 'automation',
        automationType: `${String(featureName).toLowerCase().replace(/\s+/g, '_')}_refused`,
        automationDetail: 'long_rest',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} attempted ${featureName} but it has no uses remaining — refills after a Long Rest or ${restoreCost} Sorcery Points.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[dragonWings] Error:", e); });
    return refusalPopup(featureName, restoreCost, auto);
}

async function activateWings({ playerName, featureName, campaignName, auto, usesMax, spentSP }) {
    const durationText = formatWingsDuration(auto.duration || '1_hour');
    const usesAfter = Math.max(0, usesMax - 1);

    if (spentSP > 0) {
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: featureName,
            description: `${playerName} restored ${featureName} by spending ${spentSP} Sorcery Points.`,
        }).catch((e) => { console.error("[dragonWings] Error:", e); });
    }

    // CLA-096 §39 ordering: awaited full-store writes land before the
    // expiration write so no snapshot reordering can drop them.
    await setRuntimeValue(playerName, DRAGON_WINGS_USES_KEY, usesAfter, campaignName);
    await setRuntimeValue(playerName, DRAGON_WINGS_ACTIVE_KEY, true, campaignName);

    const activeBuffsRaw = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(activeBuffsRaw) ? activeBuffsRaw : [];
    const newBuffs = [...activeBuffs, {
        name: featureName,
        effect: DRAGON_WINGS_EFFECT,
        duration: auto.duration || '1_hour',
        flySpeed: auto.flySpeed || 60,
        hover: auto.hover || false,
    }];
    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    addExpiration({
        attackerName: playerName,
        targetName: playerName,
        effects: [{ type: DRAGON_WINGS_EFFECT }],
        campaignName,
        rounds: wingsDurationToRounds(auto.duration || '1_hour'),
    });

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} activated ${featureName} (Bonus Action, ${durationText}). Fly Speed ${auto.flySpeed || 60} feet${auto.hover ? ' (hover)' : ''}.${spentSP > 0 ? ` (${spentSP} SP spent to restore the use)` : ''}`,
    }).catch((e) => { console.error("[dragonWings] Error:", e); });

    return infoPopup(
        featureName,
        `${featureName} activated. Fly Speed ${auto.flySpeed || 60} feet${auto.hover ? ' (hover)' : ''} for ${durationText}.${spentSP > 0 ? ` (${spentSP} SP spent to restore the use)` : ''}`,
        auto,
    );
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const playerName = playerStats.name;
    const featureName = action.name || DRAGON_WINGS_BUFF_NAME;

    // Retract lane first (verified affordance): re-click while wings stand.
    const activeBuffsRaw = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(activeBuffsRaw) ? activeBuffsRaw : [];
    if (activeBuffs.some(isDragonWingsBuff)) {
        endDragonWingsBuff(playerName, campaignName, 'retracted');
        return infoPopup(featureName, `${featureName} deactivated.`, auto);
    }

    const usesMax = auto.uses ?? 1;
    const storedUses = getRuntimeValue(playerName, DRAGON_WINGS_USES_KEY, campaignName);
    const usesRemaining = storedUses != null ? Number(storedUses) : usesMax;

    let spentSP = 0;
    if (usesRemaining <= 0) {
        const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
        const currentSP = getCurrentSorceryPoints(playerName, maxSP);
        const restoreCost = auto.restoreCost || 3;
        if (currentSP < restoreCost) {
            return refuseExhaustedWings({ playerName, featureName, campaignName, auto, restoreCost });
        }
        spendSorceryPoints(playerName, restoreCost, campaignName, maxSP);
        spentSP = restoreCost;
    }

    return activateWings({ playerName, featureName, campaignName, auto, usesMax, spentSP });
}

export function isActive(playerName, campaignName) {
    return getRuntimeValue(playerName, DRAGON_WINGS_ACTIVE_KEY, campaignName) === true;
}
