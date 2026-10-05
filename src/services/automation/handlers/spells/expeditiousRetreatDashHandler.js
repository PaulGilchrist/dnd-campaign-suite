import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

// SP-128: Expeditious Retreat (2024 spells.json — "You take the Dash action,
// and until the spell ends, you can take that action again as a Bonus
// Action"). Bonus Actions row "Dash (Expeditious Retreat)" → this lane.
// Dash = extra movement: speed doubling rides the verified CLA-067 /
// FT-105 activeBuffs speed_boost numeric channel (consumed by
// charSummaryCalc buffSpeedBonus — sheet Speed shows 2×), removed via the
// one name-scoped remove_active_buff anchor on the caster's next turn
// (accepted MA-0995/MA-1147 approximation of "until the end of the turn";
// same-round expiry never fires, playbook §38). Once-per-turn latch
// _Expeditious_Retreat_dash_usedRound mirrors the FT-104 Dual Wielder
// shape (cleared at round wrap in Initiative.jsx + navigationHandlers and
// re-armed at turn start via the expeditious_retreat_dash_offer lane).
const USED_ROUND_KEY = '_Expeditious_Retreat_dash_usedRound';
const DASH_ROW_NAME = 'Dash (Expeditious Retreat)';
const GRANT_FLAG = 'expeditiousRetreatActive';

function refusalPopup(action, reason) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation?.type,
            description: reason,
            automation: action.automation,
        },
    };
}

async function logRefusal(action, playerName, campaignName, reason) {
    await addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: 'expeditious_retreat_dash_refused',
        name: action.name,
        description: `${action.name} refused — ${reason}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[expeditiousRetreatDashHandler:log-error]', e); });
}

// Returns { reason } on refusal, { csFresh, currentRound } on pass.
async function checkGates(action, playerStats, campaignName) {
    const playerName = playerStats.name;

    // Gate 1 — spell grant active (persisted flag is the single source of
    // truth; cleared by the 'Expeditious Retreat' concentration-break branch).
    if (!getRuntimeValue(playerName, GRANT_FLAG, campaignName)) {
        return { reason: 'Expeditious Retreat is not active — cast the spell to gain the Dash Bonus Action.' };
    }

    // Gate 2 — combat context (FT-104 shape).
    const csFresh = await getCombatContext(campaignName);
    if (!csFresh) {
        return { reason: `No combat context found. Cannot use ${action.name}.` };
    }

    const currentRound = getCurrentCombatRound(campaignName);

    // Gate 3 — once-per-turn latch (re-armed at round wrap + turn start).
    const usedRound = Number(getRuntimeValue(playerName, USED_ROUND_KEY, campaignName) ?? 0);
    if (usedRound === currentRound) {
        return { reason: 'Once per turn — the Expeditious Retreat Dash has already been taken this turn.' };
    }

    // Gate 4 — own turn only ("on each of YOUR turns"). Turn-walk authority
    // is __initiative__.lastAppliedTurnStartCreature ("<round>:<name>",
    // §MN-007) — cs.activeCreatureName is a stale mirror. Lenient when no
    // owner is known (FT-104 / gridless §42 precedent).
    const gate = getRuntimeValue('__initiative__', 'lastAppliedTurnStartCreature', campaignName) || csFresh.activeCreatureName;
    const ownerName = String(gate || '').includes(':') ? String(gate).split(':').slice(1).join(':') : (gate || '');
    if (ownerName && ownerName !== playerName) {
        return { reason: `It is ${ownerName}'s turn — the Expeditious Retreat Dash is a Bonus Action on your own turn.` };
    }

    return { csFresh, currentRound };
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const playerName = playerStats.name;

    const gates = await checkGates(action, playerStats, campaignName);
    if (gates.reason) {
        await logRefusal(action, playerName, campaignName, gates.reason);
        return refusalPopup(action, gates.reason);
    }

    const speed = playerStats.speed || 30;
    const storedBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const buffs = Array.isArray(storedBuffs) ? storedBuffs : [];
    const cleaned = buffs.filter(b => !(b.name === DASH_ROW_NAME && b.effect === 'speed_boost'));

    // CLA-371/§39: serialize the latch + buff stamp BEFORE the popup returns
    // so a second same-round click reads the stamped round and is refused.
    await setRuntimeValue(playerName, USED_ROUND_KEY, gates.currentRound, campaignName);
    await setRuntimeValue(playerName, 'activeBuffs', [
        ...cleaned,
        { name: DASH_ROW_NAME, effect: 'speed_boost', speedBonus: speed, duration: 'until_end_of_turn' },
    ], campaignName);

    addExpiration({ attackerName: playerName, targetName: playerName, effects: [
        { type: 'remove_active_buff', buffName: DASH_ROW_NAME },
    ], campaignName, rounds: undefined, expireOnCreatureName: playerName });

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        automationType: 'dash_bonus',
        description: `Dash (Expeditious Retreat): Speed doubled ${speed} → ${speed * 2} ft until the end of the turn (+${speed} ft speed_boost).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[expeditiousRetreatDashHandler:log-error]', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: 'expeditious_retreat_dash',
            description: `You take the Dash action (Expeditious Retreat). Speed doubled ${speed} → ${speed * 2} ft until the end of the turn. You can take it again as a Bonus Action on each of your turns until Concentration ends.`,
            automation: action.automation,
        },
    };
}
