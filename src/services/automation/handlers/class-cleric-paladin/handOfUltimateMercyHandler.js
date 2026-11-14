import { rollExpression, rollExpressionMaximized } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeBatch, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

import storage from '../../../ui/storage.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { infoPopup } from '../../common/infoPopup.js';
import { hasHealingMaximization, resolveDiceExpression } from '../../../combat/automation/automationService.js';

const CUREABLE_CONDITIONS = ['Blinded', 'Deafened', 'Paralyzed', 'Poisoned', 'Stunned'];

function conditionMatches(c, targetCondition) {
    return (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
}

function resolveFocusPoints(playerName, campaignName, playerStats) {
    const storedFP = getRuntimeValue(playerName, 'focusPoints', campaignName);
    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const maxFP = classLevel?.focus_points || 0;
    return storedFP != null ? Number(storedFP) : (playerStats._trackedResources?.focusPoints?.current ?? maxFP);
}

function resolveTargetHp(targetInfo, targetName, campaignName) {
    if (targetInfo.target.type === 'player') {
        return getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? 0;
    }
    return targetInfo.target.currentHp ?? 0;
}

// Canonical HP frame for the audit row — same precedence as revivifyService.js
// (bucket max first, combat-summary row max as fallback).
function resolveTargetMaxHp(targetInfo, targetName, campaignName) {
    if (targetInfo.target.type === 'player') {
        return getRuntimeValue(targetName, 'hitPoints', campaignName) ?? targetInfo.target.maxHp;
    }
    return targetInfo.target.maxHp;
}

async function applyResurrectionHeal(targetInfo, targetName, healAmount, campaignName) {
    if (targetInfo.target.type === 'player') {
        // Resurrection always lifts the bucket from 0 to positive, so it must
        // carry the app-wide death-state reset — the same one the sheet-revive
        // lane commits (CharHitPoints, merged one-POST idiom) and the CLA-092
        // heal choke performs for its oldHp<=0 -> newHp>0 transition
        // (applyHealing.js). The old currentHitPoints-only write left
        // isDead:1 + stale deathFailures on a living creature
        // (bug-houm-resurrection-leaves-isdead-stuck), poisoning its next
        // death-save lane. One setRuntimeBatch POST writes the whole set.
        setRuntimeBatch(targetName, {
            currentHitPoints: healAmount,
            deathSaves: [false, false, false],
            deathFailures: [false, false, false],
            isDead: 0,
        }, campaignName);
    } else {
        targetInfo.target.currentHp = healAmount;
        if (targetInfo.cs) {
            storage.set('combatSummary', targetInfo.cs, campaignName);
        }
    }
}

function cureConditionsFor(targetName, auto, campaignName) {
    const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
    const condArray = Array.isArray(conditions) ? conditions : [];
    const cureConditions = (auto.cureConditions || CUREABLE_CONDITIONS)
        .filter(c => condArray.some(existing => conditionMatches(existing, c)));

    if (cureConditions.length > 0) {
        const filtered = condArray.filter(c =>
            !cureConditions.some(cc => conditionMatches(c, cc))
        );
        return { cureConditions, promise: setRuntimeValue(targetName, 'activeConditions', filtered, campaignName) };
    }
    return { cureConditions, promise: null };
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const costAmount = auto.resourceCostAmount || 5;

    const currentFP = resolveFocusPoints(playerName, campaignName, playerStats);

    if (currentFP < costAmount) {
        return infoPopup(action.name, `Not enough Focus Points. Need ${costAmount}, have ${currentFP}.`, auto);
    }

    const targetInfo = await resolveTarget(campaignName, playerName);
    if (!targetInfo?.target) {
        return infoPopup(action.name, 'Select a target in combat first.', auto);
    }

    const targetName = targetInfo.target.name;

    const targetHp = resolveTargetHp(targetInfo, targetName, campaignName);
    const targetMaxHp = resolveTargetMaxHp(targetInfo, targetName, campaignName);

    if (targetHp > 0) {
        return infoPopup(action.name, `${targetName} is not at 0 Hit Points.`, auto);
    }

    const maximize = hasHealingMaximization(playerStats);
    const resolvedExpression = resolveDiceExpression(auto.healExpression || '4d10', playerStats);
    const rollResult = maximize ? rollExpressionMaximized(resolvedExpression) : rollExpression(resolvedExpression);
    if (!rollResult) {
        return infoPopup(action.name, 'Failed to roll healing dice.', auto);
    }

    await setRuntimeValue(playerName, 'focusPoints', currentFP - costAmount, campaignName);
    window.dispatchEvent(new CustomEvent('focus-points-updated'));

    const healAmount = rollResult.total;

    await applyResurrectionHeal(targetInfo, targetName, healAmount, campaignName);

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    const { cureConditions, promise: curePromise } = cureConditionsFor(targetName, auto, campaignName);
    if (curePromise) await curePromise;

    // Log-family parity (2026-11-14 resurrection log-family split): the audit
    // row rides the hp_change heal family — the exact field set every other
    // revive/heal writer commits (revivifyService.js:105, healingRoll.js:83) —
    // so HP-trail views and hp_change-keyed filters see resurrections instead
    // of silently missing them. The resurrection:true discriminator is retained
    // to keep corpse-revives separable within the family, and isHealing follows
    // the sign of the written delta (sign-stamp law, healingRoll.js:88 — never
    // a literal true). characterName stays for the log Character filter.
    const writtenDelta = healAmount - targetHp;
    addEntry(campaignName, {
        type: 'hp_change',
        characterName: playerName,
        targetName: targetName,
        delta: writtenDelta,
        currentHp: healAmount,
        maxHp: targetMaxHp,
        isHealing: writtenDelta > 0,
        sourceName: playerName,
        note: action.name,
        timestamp: Date.now(),
        resurrection: true,
    }).catch((e) => { console.error("[handOfUltimateMercy] Error:", e); });

    const cureMsg = cureConditions.length > 0
        ? ` Also removed: ${cureConditions.join(', ')}.`
        : '';

    return infoPopup(action.name, `${playerName} uses ${action.name} on ${targetName}. Returns to life with ${healAmount} HP. Expended ${costAmount} Focus Points.${cureMsg}`, auto);
}
