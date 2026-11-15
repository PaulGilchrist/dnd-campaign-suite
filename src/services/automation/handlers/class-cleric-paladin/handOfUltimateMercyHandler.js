import { rollExpression, rollExpressionMaximized } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeBatch, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

import storage from '../../../ui/storage.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { infoPopup } from '../../common/infoPopup.js';
import { hasHealingMaximization, resolveDiceExpression } from '../../../combat/automation/automationService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { resolveLiveTargetHp } from '../healing/liveTargetHp.js';

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

// Canonical HP frame for the audit row — bucket max first (the same
// hitPoints-first law as liveTargetHp.js/resolveLiveTargetHp). Backlog
// 2026-11-14: a thin full-store POST echo-REPLACEs the mirror and EVICTS its
// hitPoints, and the select-baked combat-summary rows can sit at a stale 1/1
// (App.jsx campaign re-seed bakes `|| 1`), so the old bucket→row-only chain
// silently framed `maxHp:1` on a real 112-max resurrection. Between the two
// sits the loaded character data: `computedStats.hitPoints` (rules.js
// getHitPoints) is the EXACT value seedCharacterRuntimeData seeds the bucket's
// hitPoints from (trackedResources.js:235-236), so it re-derives the bucket
// truth the eviction lost. The combat-summary row stays the last-resort frame
// (monsters are summary-canonical per CLA-303; players genuinely missing both
// live sources get a loud console.error, never a silent stale value).
function resolveTargetMaxHp(targetInfo, targetName, campaignName, characters) {
    if (targetInfo.target.type === 'player') {
        const bucketMax = getRuntimeValue(targetName, 'hitPoints', campaignName);
        if (bucketMax != null) return bucketMax;
        const charMax = (characters || []).find(c => c.name === targetName)?.computedStats?.hitPoints;
        if (charMax != null) return charMax;
        console.error(`[handOfUltimateMercy] ${targetName} has no bucket hitPoints and no loaded character max — framing the audit row with the combat-summary row maxHp (${String(targetInfo.target.maxHp)}).`);
        return targetInfo.target.maxHp;
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

// Corpse candidate list for the in-sheet chooser (improve 2026-11-14, mirrors
// healingHandler.collectTouchTargets): every board creature whose BUCKET-
// CANONICAL HP (resolveLiveTargetHp — `currentHitPoints` first, cs row only as
// fallback for bucket-less rows like monsters) is 0, caster excluded. The same
// precedence the commit gate (resolveTargetHp) re-checks at confirm, so the
// picker never offers a target its own gate would call living.
function collectCorpseTargets(cs, playerName) {
    if (!cs?.creatures?.length) return [];
    return cs.creatures
        .filter(c => c.name !== playerName)
        .map(c => ({ name: c.name, type: c.type, ...resolveLiveTargetHp(c) }))
        .filter(t => t.currentHp === 0);
}

// The armed-commit contract (7d64885e3 + 24caf7978): bucket-0 gate → roll →
// focus −cost → ONE setRuntimeBatch POST (currentHitPoints + deathSaves +
// deathFailures + isDead:0) → one hp_change|resurrection:true row → success
// popup. Shared verbatim by the armed direct lane and the picker commit — a
// refusal returns refused:true with ZERO spend, ZERO writes, ZERO log rows.
async function commitResurrection({ action, auto, playerStats, playerName, campaignName, costAmount, targetInfo, characters }) {
    const targetName = targetInfo.target.name;

    // Re-read Focus at commit: the click-time gate above only pre-screens the
    // chooser open; a mid-dwell drain by another lane must refuse zero-spend
    // (gateMonkHealCommit's refuse-before-spend precedent).
    const currentFP = resolveFocusPoints(playerName, campaignName, playerStats);
    if (currentFP < costAmount) {
        return { refused: true, popup: infoPopup(action.name, `Not enough Focus Points. Need ${costAmount}, have ${currentFP}.`, auto) };
    }

    const targetHp = resolveTargetHp(targetInfo, targetName, campaignName);
    const targetMaxHp = resolveTargetMaxHp(targetInfo, targetName, campaignName, characters);

    if (targetHp > 0) {
        return { refused: true, popup: infoPopup(action.name, `${targetName} is not at 0 Hit Points.`, auto) };
    }

    const maximize = hasHealingMaximization(playerStats);
    const resolvedExpression = resolveDiceExpression(auto.healExpression || '4d10', playerStats);
    const rollResult = maximize ? rollExpressionMaximized(resolvedExpression) : rollExpression(resolvedExpression);
    if (!rollResult) {
        return { refused: true, popup: infoPopup(action.name, 'Failed to roll healing dice.', auto) };
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

    return {
        refused: false,
        popup: infoPopup(action.name, `${playerName} uses ${action.name} on ${targetName}. Returns to life with ${healAmount} HP. Expended ${costAmount} Focus Points.${cureMsg}`, auto),
    };
}

export async function handle(action, playerStats, campaignName, _mapName, characters) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const costAmount = auto.resourceCostAmount || 5;

    const currentFP = resolveFocusPoints(playerName, campaignName, playerStats);

    if (currentFP < costAmount) {
        return infoPopup(action.name, `Not enough Focus Points. Need ${costAmount}, have ${currentFP}.`, auto);
    }

    // Armed-corpse direct lane (criterion: arm → press → commit, no chooser):
    // an armed combatSummary targetName keeps the pre-improve bytes — commit
    // straight through, and a living armed target still takes the bucket-read
    // `<Target> is not at 0 Hit Points.` zero-spend refusal.
    const armedTarget = await resolveTarget(campaignName, playerName);
    if (armedTarget?.target) {
        const { popup } = await commitResurrection({ action, auto, playerStats, playerName, campaignName, costAmount, targetInfo: armedTarget, characters });
        return popup;
    }

    // No armed target — in-sheet corpse chooser (improve 2026-11-14, backlog
    // "HoUoM has no in-sheet target chooser"): instead of refusing and forcing
    // an Initiative detour to arm targetName, open the SHARED SecondaryTargetModal
    // (same component/chrome as the adjacent Hand of Healing picker) filtered to
    // board targets at 0 HP. Zero-spend refusals keep the pre-improve honesty
    // family: no board at all reads exactly like before; a board with only
    // living rows says so plainly rather than opening a silently-empty chooser.
    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures?.length) {
        return infoPopup(action.name, 'Select a target in combat first.', auto);
    }
    const corpseTargets = collectCorpseTargets(cs, playerName);
    if (corpseTargets.length === 0) {
        return infoPopup(action.name, 'No target at 0 Hit Points.', auto);
    }

    return {
        type: 'modal',
        modalName: 'handOfUltimateMercy',
        payload: {
            featureName: action.name,
            casterName: playerName,
            costAmount,
            creatureTargets: corpseTargets,
            // Picker commit (HandOfHealing confirmHeal shape): re-resolve the
            // row cache-first (resolveMonkHealGateRow precedent — the picker
            // can dwell across board echoes), then run the SAME armed-commit
            // contract. A refusal (revived mid-dwell, focus drained) returns
            // { refusal } so the picker stays open with an inline note and
            // spends NOTHING; a success returns { popup } the host renders
            // after closing the chooser.
            confirmResurrect: async (targetName) => {
                const liveRow = getCombatSummary(campaignName)?.creatures?.find(c => c.name === targetName);
                const snapshotRow = cs.creatures.find(c => c.name === targetName);
                const target = liveRow ?? snapshotRow;
                if (!target) {
                    return { refusal: `${targetName} is no longer on the combat board. No Focus Points spent.` };
                }
                const { refused, popup } = await commitResurrection({ action, auto, playerStats, playerName, campaignName, costAmount, targetInfo: { target, cs }, characters });
                return refused ? { refusal: popup.payload.description } : { popup: popup.payload };
            },
        },
    };
}
