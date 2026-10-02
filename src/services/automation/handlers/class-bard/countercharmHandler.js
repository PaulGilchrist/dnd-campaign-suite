import { addEntry } from '../../../ui/logService.js';
import { logConditionEvent } from '../../../encounters/combatLoggingService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { infoPopup } from '../../common/infoPopup.js';
import { removeCondition } from '../../../combat/conditions/conditionSaveService.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// CLA-064: uses pool lives on the bard as a NUMERIC change-data key (CLA-027
// pool contract); null = re-armed. Re-arms via LONG_REST_RESOURCES.
const USES_KEY = 'countercharmUses';
const MIND_CONDITIONS = ['charmed', 'frightened'];

function normalizeConditions(list) {
    return (Array.isArray(list) ? list : []).map(c => String(c).toLowerCase());
}

function capitalize(cond) {
    return String(cond).charAt(0).toUpperCase() + String(cond).slice(1);
}

// CLA-064: RAW trigger is a FAILED saving throw against an effect that applies
// the Charmed or Frightened condition. Evidence = lastAttack saveConditions
// (stamped by the save lanes) or the roller's freshly-applied activeConditions.
async function findQualifyingSaveRoll(playerStats, campaignName, rangeFt, wanted) {
    const attackResult = await findLastAttack(campaignName);
    const attackEvent = attackResult.attackEvent;

    if (!attackEvent) return { reason: 'no_roll' };
    if (attackEvent.rollType !== 'save') return { reason: `rollType_${attackEvent.rollType || 'none'}` };
    if (attackEvent.saveResult !== 'failure') return { reason: 'save_succeeded' };

    const targetName = attackResult.targetName;
    if (!targetName) return { reason: 'no_target' };

    const onEffect = normalizeConditions(attackEvent.saveConditions).some(c => wanted.includes(c));
    const onTarget = normalizeConditions(await getRuntimeValue(targetName, 'activeConditions', campaignName)).some(c => wanted.includes(c));
    if (!onEffect && !onTarget) return { reason: 'not_charmed_or_frightened' };

    const inRange = await isWithinRange(playerStats.name, targetName, rangeFt);
    if (!inRange) return { reason: 'out_of_range' };

    return { targetName, event: attackEvent };
}

function refusalMessage(reason, featureName, targetName) {
    switch (reason) {
        case 'no_roll':
            return `No recent D20 test found. ${featureName} must be used as a Reaction after a failed saving throw against a Charmed or Frightened effect.`;
        case 'save_succeeded':
            return `The last saving throw already succeeded — ${featureName} only triggers on a failed save.`;
        case 'no_target':
            return `No saving throw roller identified — ${featureName} refused.`;
        case 'not_charmed_or_frightened':
            return `The last failed save was not against a Charmed or Frightened effect — ${featureName} refused.`;
        case 'out_of_range':
            return `${targetName || 'The roller'} is beyond 30 feet — ${featureName} refused.`;
        case 'uses_exhausted':
            return `${featureName} has no uses remaining — it recharges after a Long Rest.`;
        default:
            return `${featureName} refused (${reason}).`;
    }
}

async function refuseCountercharm({ campaignName, playerName, featureName, auto, reason, targetName }) {
    await addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: 'countercharm_refused',
        automationDetail: reason,
        abilityName: featureName,
        description: `${featureName} refused (${reason}): ${refusalMessage(reason, featureName, targetName)}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[countercharm:refusal-log-error]', e); });
    return infoPopup(featureName, refusalMessage(reason, featureName, targetName), auto);
}

// CLA-027 pool contract: numeric only; null/undefined = re-armed (full pool);
// stale object pools self-heal to max instead of pinning refusals.
function resolveUses(stored, auto) {
    const maxUses = Number(auto.uses ?? 1);
    if (stored == null) return maxUses;
    const numeric = Number(stored);
    return Number.isFinite(numeric) ? numeric : maxUses;
}

function computeReroll(rollEvent) {
    const d20 = rollEvent.d20;
    const bonus = rollEvent.bonus || 0;
    const newD20 = Math.floor(Math.random() * 20) + 1;
    const rerolledD20 = Math.max(d20, newD20);
    const newTotal = rerolledD20 + bonus;
    return { d20, bonus, newD20, rerolledD20, newTotal };
}

// CLA-064: on a converted save, lift any charmed/frightened the failed save
// applied, through the canonical remove seam WITH campaignName (was the
// /campaigns/undefined 400), and log each removal.
async function liftMindConditions({ campaignName, combatSummary, targetName, wanted }) {
    const active = normalizeConditions(await getRuntimeValue(targetName, 'activeConditions', campaignName));
    for (const condition of wanted) {
        if (!active.includes(condition)) continue;
        await removeCondition({ combatSummary, creatureName: targetName, condition, getRuntimeValue, setRuntimeValue, campaignName });
        logConditionEvent({ campaignName, action: 'removed', creatureName: targetName, conditionLabel: capitalize(condition) });
    }
}

function buildRerollPopup({ featureName, targetName, rollEvent, reroll, outcome }) {
    const { d20, bonus, saveDc, saveType } = rollEvent;
    const saveLabel = saveType ? `${saveType} save` : 'save';
    const originalTotal = d20 + bonus;
    const usesLine = reroll.usesRemaining != null ? `<br/><br/>Uses remaining: ${reroll.usesRemaining}` : '';

    let description = `<b>${featureName}</b><br/>Target: ${targetName}<br/>`;
    description += `Original ${saveLabel}: d20(${d20}) + ${bonus} = ${originalTotal} vs DC ${saveDc} → Failed<br/>`;
    description += `Reroll with Advantage: d20(${reroll.rerolledD20}) [new die ${reroll.newD20}] + ${bonus} = ${reroll.newTotal} vs DC ${saveDc} → ${reroll.newTotal >= saveDc ? 'Succeeded' : 'Failed'}<br/>`;
    description += `<br/><i>${outcome}</i>${usesLine}`;
    return description;
}

function resolveWantedConditions(auto) {
    const authored = Array.isArray(auto.conditions) && auto.conditions.length ? auto.conditions : MIND_CONDITIONS;
    return normalizeConditions(authored);
}

async function executeCountercharm({ campaignName, playerName, featureName, auto, wanted, qualifying, currentUses }) {
    const { targetName, event: rollEvent } = qualifying;
    const reroll = computeReroll(rollEvent);
    const newSuccess = reroll.newTotal >= rollEvent.saveDc;
    const outcome = newSuccess ? 'Countercharm turned a failure into a success!' : 'Still a failure.';

    const cs = await getCombatContext(campaignName);
    const sourceCreature = cs?.creatures?.find(c => c.name === playerName);
    const targetCreature = cs?.creatures?.find(c => c.name === targetName);

    // Machine-truth roll log: both dice, advantage mode, raw max total (§33).
    addEntry(campaignName, {
        type: 'roll',
        rollType: 'save',
        characterName: targetName,
        targetName,
        name: `${featureName} Reroll`,
        rolls: [rollEvent.d20, reroll.newD20],
        mode: 'advantage',
        total: reroll.rerolledD20,
        bonus: reroll.bonus,
        saveDc: rollEvent.saveDc,
        saveType: rollEvent.saveType,
        success: newSuccess,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[countercharm:roll-log-error]', e); });

    if (newSuccess) {
        // §CLA-042 machine truth for the converted save.
        sendSaveResult(campaignName, targetName, {
            success: true,
            roll: reroll.rerolledD20,
            total: reroll.newTotal,
            saveBonus: reroll.bonus,
            rawRolls: [rollEvent.d20, reroll.newD20],
            mode: 'advantage',
        });
        await liftMindConditions({ campaignName, combatSummary: cs, targetName, wanted });
        addEntry(campaignName, {
            type: 'save_result',
            characterName: playerName,
            targetName,
            saveDc: rollEvent.saveDc,
            saveType: rollEvent.saveType,
            success: true,
            description: `${targetName} converted ${capitalize(rollEvent.saveType || 'save')} DC ${rollEvent.saveDc} to SUCCESS via ${featureName} reroll (${reroll.rerolledD20} + ${reroll.bonus} = ${reroll.newTotal} vs DC ${rollEvent.saveDc}).`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[countercharm:save-result-log-error]', e); });
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} on ${targetName} (save reroll with Advantage). Source: ${sourceCreature?.type || 'unknown'}, Target: ${targetCreature?.type || 'unknown'}. ${outcome} Outcome: ${newSuccess ? 'success' : 'failure'}. Uses remaining: ${currentUses - 1}.`,
        targetName,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[countercharm] Error:', e); });

    return infoPopup(featureName, buildRerollPopup({ featureName, targetName, rollEvent, reroll: { ...reroll, usesRemaining: currentUses - 1 }, outcome }), auto);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const playerName = playerStats.name;
    const featureName = action.name || 'Countercharm';

    const rangeFt = auto.range ? parseInt(auto.range.replace(/[^0-9]/g, ''), 10) || 30 : 30;
    const wanted = resolveWantedConditions(auto);

    const qualifying = await findQualifyingSaveRoll(playerStats, campaignName, rangeFt, wanted);
    if (!qualifying.event) {
        return refuseCountercharm({ campaignName, playerName, featureName, auto, reason: qualifying.reason, targetName: null });
    }

    const stored = await getRuntimeValue(playerName, USES_KEY, campaignName);
    const currentUses = resolveUses(stored, auto);
    if (currentUses <= 0) {
        return refuseCountercharm({ campaignName, playerName, featureName, auto, reason: 'uses_exhausted', targetName: qualifying.targetName });
    }

    // Spend on confirm-fire, past all gates — the RAW reaction is paid once the
    // reroll happens regardless of how the new die lands.
    await setRuntimeValue(playerName, USES_KEY, currentUses - 1, campaignName);

    return executeCountercharm({ campaignName, playerName, featureName, auto, wanted, qualifying, currentUses });
}
