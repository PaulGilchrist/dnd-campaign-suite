import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';

import { findPactSlotLevel, hasPactSlotAvailable } from './pactMagicUtils.js';

const USES_KEY = 'hurlThroughHellUses';
const TURN_USED_KEY = 'hurlThroughHellTurnUsed';

function hurlPopup(featureName, auto, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            description,
            automation: auto,
        },
    };
}

// Attack-trigger gates: once-per-turn latch, lastAttack ownership/roll/hit,
// and target selection. Returns a refusal popup, or { targetName } to proceed.
async function gateHurlTrigger(playerName, campaignName, featureName, auto) {
    // CLA-175: round-keyed once-per-turn latch (CLA-109/CLA-273 pattern) —
    // compares the stored round number against the current round so the latch
    // self-re-arms each round instead of treating any sentinel as "used".
    const turnUsed = getRuntimeValue(playerName, TURN_USED_KEY, campaignName);
    if (turnUsed != null && Number(turnUsed) === getCurrentCombatRound(campaignName)) {
        return hurlPopup(featureName, auto, `${featureName}: Already used this turn. Once per turn.`);
    }

    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);

    // Check lastAttack — triggers "when you hit with an attack roll"
    if (!lastAttack) {
        return hurlPopup(featureName, auto, `${featureName}: Requires that you hit with an attack roll. No attack recorded.`);
    }
    if (lastAttack.attackerName !== playerName) {
        return hurlPopup(featureName, auto, `${featureName}: Requires that you hit with an attack roll. Last attack was not yours.`);
    }
    if (lastAttack.rollType !== 'attack') {
        return hurlPopup(featureName, auto, `${featureName}: Requires that you hit with an attack roll. Last action was not an attack.`);
    }
    if (lastAttack.hit !== true) {
        return hurlPopup(featureName, auto, `${featureName}: Requires that you hit with an attack roll. Last attack missed.`);
    }

    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerName) : null;
    const targetName = target?.name || null;

    if (!targetName) {
        return hurlPopup(featureName, auto, `${featureName}: No target selected — effect noted for manual application.`);
    }

    return { targetName };
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Hurl Through Hell';

    const gate = await gateHurlTrigger(playerName, campaignName, featureName, auto);
    if (gate.type === 'popup') return gate;
    const targetName = gate.targetName;

    // Build save DC
    const saveDc = buildSaveDc(auto, playerStats);
    const saveType = auto.saveType || 'CHA';

    // Resolve damage expression with scaling
    const damageExpression = auto.damageExpression || '8d10';
    const damageType = auto.damageType || 'Psychic';
    const dieRoll = rollExpression(damageExpression);
    const damageTotal = dieRoll?.total || 0;

    // Check uses remaining
    let currentUses = Number(getRuntimeValue(playerName, USES_KEY, campaignName) ?? 0);
    const maxUses = auto.uses || 1;

    // Find Pact Magic slot level (highest spell slot level the warlock has)
    const pactSlotLevel = findPactSlotLevel(playerStats);

    // Check Pact Magic slot availability if needed
    const pactSlotsAvailable = hasPactSlotAvailable(playerStats, playerName, campaignName, auto, currentUses, maxUses, pactSlotLevel);

    // Check if we can use at all
    const canUse = currentUses < maxUses || (auto.pactMagicRecharge && pactSlotsAvailable);

    if (!canUse) {
        let reason = `${featureName}: No uses remaining. Recharges on a Long Rest.`;
        if (auto.pactMagicRecharge) {
            reason = `${featureName}: No uses remaining. Recharges on a Long Rest, or expend a Pact Magic spell slot to restore a use. No Pact Magic slots available.`;
        }
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                description: reason,
                automation: auto,
            },
        };
    }

    // Return modal for confirmation
    return {
        type: 'modal',
        modalName: 'hurlThroughHell',
        payload: {
            action,
            playerStats,
            campaignName,
            targetName,
            saveType,
            saveDc,
            damageType,
            damageExpression,
            damageTotal,
            dieRoll,
            currentUses,
            maxUses,
            pactSlotLevel,
            pactSlotsAvailable,
            pactMagicRecharge: !!auto.pactMagicRecharge,
        },
    };
}
