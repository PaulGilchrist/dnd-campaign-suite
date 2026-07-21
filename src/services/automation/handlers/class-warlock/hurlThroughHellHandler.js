import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

const USES_KEY = 'hurlThroughHellUses';
const TURN_USED_KEY = 'hurlThroughHellTurnUsed';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Hurl Through Hell';

    // Check once-per-turn
    const turnUsed = getRuntimeValue(playerName, TURN_USED_KEY, campaignName);
    if (turnUsed) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                description: `${featureName}: Already used this turn. Once per turn.`,
                automation: auto,
            },
        };
    }

    // Get the target from combat context
    const cs = await getCombatContext(campaignName);

    // Check lastAttack — triggers "when you hit with an attack roll"
    if (!cs?.lastAttack) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                description: `${featureName}: Requires that you hit with an attack roll. No attack recorded.`,
                automation: auto,
            },
        };
    }

    if (cs.lastAttack.attackerName !== playerName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                description: `${featureName}: Requires that you hit with an attack roll. Last attack was not yours.`,
                automation: auto,
            },
        };
    }

    if (cs.lastAttack.rollType !== 'attack') {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                description: `${featureName}: Requires that you hit with an attack roll. Last action was not an attack.`,
                automation: auto,
            },
        };
    }

    if (cs.lastAttack.hit !== true) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                description: `${featureName}: Requires that you hit with an attack roll. Last attack missed.`,
                automation: auto,
            },
        };
    }

    const target = cs ? getTargetFromAttacker(cs, playerName) : null;
    const targetName = target?.name || null;

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                description: `${featureName}: No target selected — effect noted for manual application.`,
                automation: auto,
            },
        };
    }

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
    let pactSlotLevel = 0;
    for (let lv = 9; lv >= 1; lv--) {
        if (playerStats.spellAbilities?.[`spell_slots_level_${lv}`] > 0) {
            pactSlotLevel = lv;
            break;
        }
    }

    // Check Pact Magic slot availability if needed
    let pactSlotsAvailable = false;
    if (currentUses >= maxUses && auto.pactMagicRecharge && pactSlotLevel > 0) {
        const slotKey = `spell_slots_level_${pactSlotLevel}`;
        const currentSlots = Number(getRuntimeValue(playerName, slotKey, campaignName) ?? playerStats.spellAbilities?.[slotKey] ?? 0);
        pactSlotsAvailable = currentSlots > 0;
    }

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
