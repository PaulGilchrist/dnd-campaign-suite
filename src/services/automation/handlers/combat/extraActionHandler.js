import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { automationInfoPopup } from '../../../shared/popupResponse.js';
import { loadCombatSummary } from '../../../../services/encounters/combatData.js';

// CLA-004: every round read MUST thread campaignName and come from a FRESH
// combat context — getCurrentCombatRound() without campaignName reads the
// campaign-keyed cache as undefined -> null and pins the round to 1, which
// latched once-per-turn refusals forever after the first use.
async function freshRound(campaignName) {
    const cs = await loadCombatSummary(campaignName);
    return cs?.round ?? 1;
}

function extraActionPopup(action, auto, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
            automation: auto,
        },
    };
}

function refusal(action, playerName, campaignName, reason) {
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: 'action_surge_refused',
        name: action.name,
        description: `${action.name}: ${reason}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[extraActionHandler:refusal-log-error]', e); });

    return extraActionPopup(action, action.automation, `${action.name} ${reason}`);
}

async function gateOncePerCombat(action, auto, playerName, campaignName) {
    if (!auto.oncePerCombat) return null;
    const combatSummary = await loadCombatSummary(campaignName);
    if (combatSummary && combatSummary.round > 1) {
        return refusal(action, playerName, campaignName, 'can only be used once per combat.');
    }
    return null;
}

async function gateFirstRoundOnly(action, auto, playerName, campaignName) {
    if (!auto.firstRoundOnly) return null;
    const currentRound = await freshRound(campaignName);
    if (currentRound > 1) {
        return refusal(action, playerName, campaignName, 'can only be used in the first round of combat.');
    }
    return null;
}

function gateUsesRemaining({ action, auto, playerStats, campaignName, usesMax, resourceKey }) {
    if (usesMax <= 0) return null;
    const usesUsed = Number(getRuntimeValue(playerStats.name, resourceKey, campaignName) ?? usesMax);
    if (usesUsed > 0) return null;
    return refusal(action, playerStats.name, campaignName, `has no uses remaining. Recharges on a ${auto.recharge || 'Short Rest'}.`);
}

// CLA-004: stamp/compare the FRESH round (campaignName threaded). The latch
// re-arms at the round wrap (PLAYER_ROUND_LATCH_KEYS in navigationHandlers.js
// + Initiative.jsx clearPlayerRoundFlags), mirroring the verified
// _War_Magic_usedRound (CLA-381) / _Wrath_of_the_Sea_usedRound (CLA-393)
// once-per-turn latches.
async function gateOncePerTurn(action, auto, playerStats, campaignName) {
    if (!auto.oncePerTurn) return null;
    const usedThisRound = getRuntimeValue(playerStats.name, 'actionSurgeUsedThisRound', campaignName);
    const currentRound = await freshRound(campaignName);
    if (usedThisRound != null && Number(usedThisRound) === currentRound) {
        return refusal(action, playerStats.name, campaignName, 'can only be used once per turn.');
    }
    await setRuntimeValue(playerStats.name, 'actionSurgeUsedThisRound', currentRound, campaignName, true);
    return null;
}

async function consumeExtraActionUses(auto, playerStats, campaignName, usesMax, resourceKey) {
    let usesLeft = null;
    if (usesMax > 0) {
        const usesUsed = Number(getRuntimeValue(playerStats.name, resourceKey, campaignName) ?? usesMax);
        if (usesUsed > 0) {
            usesLeft = usesUsed - 1;
            await setRuntimeValue(playerStats.name, resourceKey, usesLeft, campaignName, true);
        }
    }

    if (auto.oncePerCombat) {
        usesLeft = 0;
        await setRuntimeValue(playerStats.name, resourceKey, 0, campaignName, true);
    }
    return usesLeft;
}

function logSurgeSpend(action, playerStats, campaignName, usesLeft) {
    const recharge = action.automation.recharge || 'Short Rest';
    const remaining = usesLeft === null ? '' : ` ${usesLeft} use(s) remain until your next ${recharge}.`;
    return addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} uses ${action.name} to take one additional action this turn.${remaining}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[extraActionHandler:spend-log-error]', e); });
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const usesMax = auto.uses || 1;
    const resourceKey = auto.resourceKey || 'actionSurgeUses';

    const combatRefusal = await gateOncePerCombat(action, auto, playerStats.name, campaignName);
    if (combatRefusal) return combatRefusal;

    const roundRefusal = await gateFirstRoundOnly(action, auto, playerStats.name, campaignName);
    if (roundRefusal) return roundRefusal;

    const usesRefusal = gateUsesRemaining({ action, auto, playerStats, campaignName, usesMax, resourceKey });
    if (usesRefusal) return usesRefusal;

    const turnRefusal = await gateOncePerTurn(action, auto, playerStats, campaignName);
    if (turnRefusal) return turnRefusal;

    const usesLeft = await consumeExtraActionUses(auto, playerStats, campaignName, usesMax, resourceKey);

    await logSurgeSpend(action, playerStats, campaignName, usesLeft);

    return automationInfoPopup(action);
}
