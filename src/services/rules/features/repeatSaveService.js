// MA-0610: GENERIC turn-END repeat-save roller. The MA-0048 arm in
// saveProcessing.applySaveOutcome was frightful-presence-specific
// (trackFrightfulPresence), and every other repeat-save row (whirlwind,
// lair sand cloud, weakening breath) carried a prose/advisory marker with no
// engine engagement — the §70 zero-consumer family. This service consumes an
// authored te DESCRIPTOR `te.repeatSave = { saveType, dc, condition }`: at
// the end of each turn the holder that still carries the gated condition
// repeats the save (NPC auto-roll inline, PC queued save-listener prompt —
// frightfulPresenceService/weakeningBreathService shape); success strips the
// te and the gated condition ("ending the effect on itself on a success").
// Frightful Presence is NOT routed here (its te carries no repeatSave
// descriptor — applyFrightfulPresenceTurnEnd stays the FP seam byte-identical).
// Granted te descriptors arrive via the MA-0042/MA-0043 zone lane
// (zone.repeat_save → zoneTeForAction → armZoneTargets) or via the generic
// saveProcessing grant below (row repeat_save objects authored WITH an
// `effect` key — every legacy repeat_save row lacks that key, so they never
// reach this code path).

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { registerTargetEffect } from '../../combat/conditions/targetEffectDefinitions.js';

function lower(value) {
    return String(value ?? '').toLowerCase();
}

function hasCondition(targetName, condition, campaignName) {
    const stored = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    return Array.isArray(stored) && stored.some(c => lower(c) === condition);
}

function stripTe(targetName, effectKey, source, campaignName) {
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const filtered = effects.filter(te => !(te.effect === effectKey && te.target === targetName && (source == null || te.source === source)));
    if (filtered.length !== effects.length) {
        setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, true);
    }
}

function stripCondition(targetName, condition, campaignName) {
    const stored = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(stored) ? stored : [];
    const filtered = conditions.filter(c => lower(c) !== condition);
    if (filtered.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
    }
}

// NPC auto-rolls inline (applyFrightfulPresenceTurnEnd shape; full-word
// cs.saveBonuses key with 3-letter fallback — MA-0303 key-mismatch family).
// PCs get a queued save-listener prompt (dc_success 'none' — the repeat save
// gates only the te/condition, never damage).
async function resolveRepeatSave({ csCreature, targetName, saveType, saveDc, label, campaignName }) {
    if (csCreature?.type !== 'player') {
        const bonuses = csCreature?.saveBonuses || {};
        const key = lower(saveType);
        const saveBonus = Number(bonuses[key] ?? bonuses[key.substring(0, 3)] ?? 0);
        const roll = Math.floor(Math.random() * 20) + 1;
        return { roll, saveBonus, success: (roll + saveBonus) >= saveDc };
    }
    const { promise } = createSaveListener(campaignName, {
        targetName,
        saveType: String(saveType).toUpperCase().substring(0, 3),
        saveDc,
        dcSuccess: 'none',
        condition: `${label} (repeat save)`,
    });
    const saveResult = await promise;
    return { roll: saveResult.roll ?? 0, saveBonus: saveResult.saveBonus ?? 0, success: saveResult.success };
}

// Success strips the te + the gated condition ("ending the effect on itself");
// a fail keeps both (repeat save still owed next turn).
async function endRepeatSaveOnSuccess({ te, targetName, condition, campaignName }) {
    stripTe(targetName, te.effect, te.source, campaignName);
    if (!condition) return;
    stripCondition(targetName, condition, campaignName);
    await addEntry(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: targetName,
        condition: condition.charAt(0).toUpperCase() + condition.slice(1),
        reason: `${te.effect} ends (repeat save succeeded)`,
        sourceName: te.source || undefined,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[repeatSaveService:repeat-removed]', e); });
}

async function resolveOneRepeatSave({ te, targetName, csCreature, campaignName }) {
    const rs = te.repeatSave;
    const condition = lower(rs.condition) || null;
    if (condition && !hasCondition(targetName, condition, campaignName)) return null;
    const saveType = rs.saveType || te.saveType || 'Strength';
    const saveDc = rs.dc ?? te.dc;
    if (saveDc == null) {
        console.error(`[repeatSaveService] repeat_save te "${te.effect}" on ${targetName} carries no dc — skipping.`);
        return null;
    }
    const { roll, saveBonus, success } = await resolveRepeatSave({ csCreature, targetName, saveType, saveDc, label: te.effect, campaignName });
    const total = roll + saveBonus;
    await addEntry(campaignName, {
        type: 'save_result',
        characterName: te.source || targetName,
        rollType: 'save-repeat',
        targetName,
        saveDc,
        saveType,
        success,
        roll,
        total,
        saveBonus,
        description: success
            ? `${targetName} succeeded its repeat ${saveType} save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — ${te.effect} ends on itself.`
            : `${targetName} failed its repeat ${saveType} save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — remains under ${te.effect}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[repeatSaveService:repeat-result]', e); });
    if (success) await endRepeatSaveOnSuccess({ te, targetName, condition, campaignName });
    return { effect: te.effect, success, roll, total };
}

// Turn-END consumer (navigationHandlers.applyOutgoingTurnEndPasses seam —
// beside applyFrightfulPresenceTurnEnd / applyWeakeningBreathTurnEnd).
export async function applyRepeatSaveTurnEnd(campaignName, targetName) {
    if (!campaignName || !targetName) return { handled: false };
    const stored = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const tes = stored.filter(te => te && te.target === targetName && te.repeatSave && typeof te.repeatSave === 'object');
    if (tes.length === 0) return { handled: false };

    const cs = getCombatSummary(campaignName);
    const csCreature = cs?.creatures?.find(c => c.name === targetName);
    const results = [];
    for (const te of tes) {
        const outcome = await resolveOneRepeatSave({ te, targetName, csCreature, campaignName });
        if (outcome) results.push(outcome);
    }
    return { handled: true, results };
}

// Generic MA-0048 arm grant (saveProcessing failed-save seam) for authored
// ROW-level `repeat_save` objects that name their te via an `effect` key
// (legacy frightful-presence/soul-tome rows carry descriptor objects WITHOUT
// `effect` and stay on the FP-specific trackFrightfulPresence leg
// byte-identical). te + descriptor + named arm log; no expiration clock —
// the repeat save itself is the terminator (RAW "ending the effect on itself
// on a success"); zone-dismiss stays GM-enforced.
export async function grantRepeatSaveEffect({ campaignName, attackerName, targetName, repeatSave, saveDc, saveType }) {
    const effect = repeatSave?.effect;
    if (!effect || !campaignName || !targetName) return;
    const dc = repeatSave.dc ?? saveDc;
    const ability = repeatSave.save_type || saveType || 'Strength';
    const condition = lower(repeatSave.condition) || null;
    registerTargetEffect(campaignName, targetName, effect, attackerName, {
        dc,
        saveType: ability,
        repeatSave: { saveType: ability, dc, condition },
        duration: repeatSave.duration || 'until_repeat_save_succeeds',
    });
    await addEntry(campaignName, {
        type: 'automation',
        automationType: `${effect}_repeat_save_armed`,
        characterName: targetName,
        sourceName: attackerName,
        abilityName: repeatSave.actionName || effect,
        description: `${targetName} failed the ${ability} save (DC ${dc ?? '?'}) — ${effect} armed with a turn-END repeat save${condition ? ` while ${condition}` : ''}; a success ends the effect on itself (zone persistence/anchoring GM-enforced).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[repeatSaveService:armed]', e); });
}
