import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addExpiration } from '../effects/expirationQueue.js';
import { registerTargetEffect } from '../../combat/conditions/targetEffectDefinitions.js';

// MA-0102: Adult Gold Dragon Weakening Breath. Failed STR save (DC 21) →
// Disadvantage on Strength-based D20 Tests + subtract 1d6 from damage rolls;
// repeats the save at the end of each of its turns, ends on a success; after
// 1 minute it succeeds automatically. te marker carries the dc/save-type for
// the turn-END repeat seam (frightfulPresenceService MA-0048 family) and the
// generic strCheckDisadvantage field the roll-time consumers read (ray
// chain). 1 minute = 10 rounds (CLA-334 minutes×10); the auto-success leg
// lands in the weakening_breath_auto_success expiration handler.

export const WEAKENING_BREATH_TE = 'weakening_breath';
const WEAKENING_BREATH_ROUNDS = 10;

function lower(value) {
    return String(value ?? '').toLowerCase();
}

// #1431 reader fix (a): ALL relevant instances, not first-match. RAW (monsters.json
// :2259/:4170): "each creature that isn't currently affected by THIS breath ...
// repeats the save at the end of each of its turns, ending the effect on ITSELF
// on a success" — two dragons = two coexisting instances (registry dedups by
// target+effect+source, targetEffectDefinitions.js:1508-1509; fix#93 clear lane
// :482-484 already guards a sibling's clock). Verdict: all-relevant — every
// distinct-source te adjudicates its OWN ladder at its OWN dc. Pre-fix source-blind
// `.find` picked the FIRST row and silently adjudicated the second dragon's dc-24
// ladder at Adult's dc-21.
function findWeakeningBreathEffects(targetName, campaignName) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    return effects.filter(te => te.effect === WEAKENING_BREATH_TE && te.target === targetName);
}

// Failed-save grant (cone picker NPC auto-leg and PC prompt leg both route
// here): te + ONE merged 10-round clock + save_result + condition logs.
export async function grantWeakeningBreath({ campaignName, attackerName, targetName, saveType, saveDc, roll, saveBonus, die }) {
    if (!campaignName || !attackerName || !targetName || saveDc == null) return;
    const ability = saveType || 'Strength';
    // MA-0212: die is per-monster parsed (Ancient Gold 1d10); Adult default 1d6.
    const subtractDie = die || '1d6';
    registerTargetEffect(campaignName, targetName, WEAKENING_BREATH_TE, attackerName, {
        duration: '1_minute',
        rounds: WEAKENING_BREATH_ROUNDS,
        dc: saveDc,
        saveType: ability,
        strCheckDisadvantage: true,
        damageSubtractDie: subtractDie,
    });
    addExpiration({
        attackerName,
        targetName,
        campaignName,
        rounds: WEAKENING_BREATH_ROUNDS,
        effects: [{ type: 'weakening_breath_auto_success', effectKey: WEAKENING_BREATH_TE, source: attackerName, target: targetName }],
    });
    const total = (roll ?? 0) + (saveBonus ?? 0);
    await addEntry(campaignName, {
        type: 'save_result',
        characterName: attackerName,
        rollType: 'save-weakening-breath',
        targetName,
        saveDc,
        saveType: ability,
        success: false,
        roll: roll ?? 0,
        total,
        saveBonus: saveBonus ?? 0,
        description: `${targetName} failed ${attackerName}'s Weakening Breath save (${ability} DC ${saveDc}, rolled ${roll ?? '?'} + ${saveBonus ?? 0} = ${total}) — Enfeebled.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[weakeningBreathService:save-result]', e); });
    await addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Weakened',
        sourceName: attackerName,
        sourceAbility: 'Weakening Breath',
        description: `${targetName} failed the ${ability} save (DC ${saveDc}) in ${attackerName}'s Weakening Breath — Disadvantage on Strength-based d20 tests and subtracts ${subtractDie} from damage rolls; repeats the save at the end of each of its turns (auto-succeeds after 1 minute — 10 rounds).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[weakeningBreathService:granted]', e); });
}

// Repeat save at turn END: the effect itself is a STR-based d20 test, so the
// repeat rolls at Disadvantage (roll twice, keep low). NPCs auto-roll inline
// (applySleepTurnEnd shape); PCs get a queued save-listener prompt.
async function resolveWeakeningBreathRepeatSave(csCreature, targetName, saveType, saveDc, campaignName) {
    const key = lower(saveType).substring(0, 3);
    if (csCreature?.type !== 'player') {
        const saveBonus = csCreature?.saveBonuses?.[key] ?? 0;
        const r1 = Math.floor(Math.random() * 20) + 1;
        const r2 = Math.floor(Math.random() * 20) + 1;
        const roll = Math.min(r1, r2);
        return { roll, saveBonus, success: (roll + saveBonus) >= saveDc, mode: 'disadvantage' };
    }
    const { promise } = createSaveListener(campaignName, {
        targetName,
        saveType: (saveType || 'Strength').substring(0, 3).toUpperCase(),
        saveDc,
        dcSuccess: 'none',
        disadvantage: true,
        condition: 'Weakening Breath (repeat save)',
    });
    const saveResult = await promise;
    return { roll: saveResult.roll ?? 0, saveBonus: saveResult.saveBonus ?? 0, success: saveResult.success, mode: 'disadvantage' };
}


// #1431 reader fix (b): strip ONLY THIS dragon's te — exact fix#93 AND-triple
// mirror (clearExpirationEffects.js:490: effect && target && source, strict ===;
// both-null legacy twins expire together, one-sided-null survives — #1517 null
// canon; disk census: zero weakening_breath rows in public/campaigns). Pre-fix
// source-blind strip collateral-stripped a second dragon's te when the FIRST
// dragon's repeat save succeeded.
function removeWeakeningBreathTe(targetName, campaignName, source) {
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const filtered = effects.filter(te => !(te.effect === WEAKENING_BREATH_TE && te.target === targetName && te.source === source));
    if (filtered.length !== effects.length) {
        setRuntimeValue('campaign', 'targetEffects', filtered, campaignName);
    }
}


// Turn-END consumer (navigationHandlers.applyOutgoingTurnEndPasses seam —
// beside applyFrightfulPresenceTurnEnd / applySleepTurnEnd). #1431: the caller
// seam carries NO dragon identity (campaignName + outgoing creature only), so
// the ladder is adjudicated PER SOURCE INSTANCE — each weakening_breath te on
// the target repeats its own save at its own dc/saveType; success strips that
// instance's own te (fix#93 AND-triple mirror at removeWeakeningBreathTe) and
// logs its own source; failure keeps it (that source's 10-round clock still
// auto-succeeds after 1 minute). Instances process sequentially in store order;
// a PC under two dragons gets two queued prompts, each waiting indefinitely
// (turn-based, no-clock compliant).
export async function applyWeakeningBreathTurnEnd(campaignName, targetName) {
    const tes = findWeakeningBreathEffects(targetName, campaignName);
    if (!tes.length) return { handled: false };

    const cs = getCombatSummary(campaignName);
    const csCreature = cs?.creatures?.find(c => c.name === targetName);

    const results = [];
    for (const te of tes) {
        const saveDc = te.dc ?? 21;
        const saveType = te.saveType || 'Strength';
        const attackerName = te.source;

        const { roll, saveBonus, success, mode } = await resolveWeakeningBreathRepeatSave(csCreature, targetName, saveType, saveDc, campaignName);
        const total = roll + saveBonus;

        await addEntry(campaignName, {
            type: 'save_result',
            characterName: attackerName,
            rollType: 'save-weakening-repeat',
            targetName,
            saveDc,
            saveType,
            success,
            roll,
            total,
            saveBonus,
            mode,
            description: success
                ? `${targetName} succeeded its repeat ${saveType} save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}, disadvantage) — Weakening Breath ends.`
                : `${targetName} failed its repeat ${saveType} save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}, disadvantage) — remains Weakened (auto-succeeds after 1 minute).`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[weakeningBreathService:repeat-result]', e); });

        if (success) {
            removeWeakeningBreathTe(targetName, campaignName, attackerName);
            await addEntry(campaignName, {
                type: 'condition',
                action: 'removed',
                characterName: targetName,
                condition: 'Weakened',
                reason: 'Weakening Breath ends (repeat save succeeded)',
                sourceName: attackerName,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[weakeningBreathService:repeat-removed]', e); });
        }
        results.push({ source: attackerName, success, roll, total });
    }

    return { handled: true, results };
}
