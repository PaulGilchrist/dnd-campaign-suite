import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { registerTargetEffect, getActiveTargetEffect } from '../../combat/conditions/targetEffectDefinitions.js';

// MA-0298: Arcanaloth Banishing Claw (Requires Soul Tome). Failed DC 17 CHA
// save (attack hit only) → the target is TRAPPED in a demiplane inside the
// Soul Tome with the Incapacitated condition — INDEFINITE (no expiry clock:
// the trap ends only when the target succeeds a repeat save at the end of its
// turn, MA-0104 te key with duration honest per MA-0248 no-clock shape).
// Turn-END repeat save rides the MA-0048 seam family
// (navigationHandlers.applyOutgoingTurnEndPasses — beside the verified
// frightful/paralyzing consumers): success strips te + condition and the
// target escapes into the space it left (placement GM-enforced §7); a fail
// keeps the trap. RAW "bound to the tome after three cumulative fails" has
// NO fail-counter consumer — advisory note on every repeat-fail log,
// GM-enforced (CLA-325 precedent).

const SOUL_TOME_TE = 'banished_demiplane';

function lower(value) {
    return String(value ?? '').toLowerCase();
}

function saveTypeAbbr(saveType) {
    const s = String(saveType || 'cha').toLowerCase();
    const abbr = s.slice(0, 3);
    return ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(abbr) ? abbr : 'cha';
}

function applyCondition(targetName, condition, campaignName) {
    const stored = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(stored) ? stored : [];
    if (conditions.some(c => lower(c) === lower(condition))) return;
    setRuntimeValue(targetName, 'activeConditions', [...conditions, condition], campaignName);
}

function removeCondition(targetName, condition, campaignName) {
    const stored = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(stored) ? stored : [];
    const filtered = conditions.filter(c => lower(c) !== lower(condition));
    if (filtered.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
    }
}

function removeSoulTomeTe(targetName, campaignName) {
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const filtered = effects.filter(te => !(te.effect === SOUL_TOME_TE && te.target === targetName && te.soulTome === true));
    if (filtered.length !== effects.length) {
        setRuntimeValue('campaign', 'targetEffects', filtered, campaignName);
    }
}

// Failed-save grant (save-result fail seam, player targets): te + condition +
// logs. NO addExpiration clock — the trap is indefinite until a repeat save
// ends it (duration honest, MA-0248 no-clock family). Success leg grants
// nothing (zero-state, dc_success:"none" keeps damage unhalved upstream).
export async function grantSoulTomeTrap({ campaignName, attackerName, targetName, saveDc, saveType, actionName }) {
    const label = actionName || 'Banishing Claw (Requires Soul Tome)';
    registerTargetEffect(campaignName, targetName, SOUL_TOME_TE, attackerName, {
        duration: 'indefinite_until_repeat_save',
        soulTome: true,
        condition: 'incapacitated',
        dc: saveDc,
        saveType: saveTypeAbbr(saveType).toUpperCase(),
        actionName: label,
    });
    applyCondition(targetName, 'incapacitated', campaignName);
    const granted = getActiveTargetEffect(campaignName, targetName, SOUL_TOME_TE);
    await addEntry(campaignName, {
        type: 'automation',
        automationType: `${SOUL_TOME_TE}_granted`,
        characterName: targetName,
        sourceName: attackerName,
        abilityName: label,
        description: `${targetName} failed ${attackerName}'s ${label} save (DC ${saveDc}) — trapped in a demiplane inside the Soul Tome with the Incapacitated condition (indefinite until a repeat save succeeds at the end of its turn; becoming bound to the tome after three cumulative fails is GM-enforced — no fail-counter consumer).${granted ? '' : ' (te write unconfirmed)'}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[soulTomeTrapService:granted]', e); });
    await addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Incapacitated',
        sourceName: attackerName,
        sourceAbility: label,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[soulTomeTrapService:condition-applied]', e); });
}

// PCs get a queued save listener prompt at end of their own turn; NPCs
// auto-roll inline (resolveFrightfulPresenceRepeatSave / MA-0248 shapes).
async function resolveRepeatSave({ csCreature, targetName, attackerName, saveDc, campaignName, label }) {
    if (csCreature?.type !== 'player') {
        const abbr = saveTypeAbbr(csCreature?.saveType);
        const saveBonus = csCreature?.saveBonuses?.[abbr] ?? 0;
        const roll = Math.floor(Math.random() * 20) + 1;
        return { roll, saveBonus, success: (roll + saveBonus) >= saveDc };
    }
    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'CHA',
        saveDc,
        dcSuccess: 'none',
        sourceName: attackerName,
        condition: `${label} (repeat save)`,
    });
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: attackerName,
        abilityName: label,
        description: `${targetName} repeats its Charisma save (DC ${saveDc}) at the end of its turn to escape the Soul Tome.`,
        promptId,
    }).catch((e) => { console.error('[soulTomeTrapService:repeat-prompt]', e); });
    const saveResult = await promise;
    return { roll: saveResult.roll ?? 0, saveBonus: saveResult.saveBonus ?? 0, success: saveResult.success };
}

// Turn-END consumer (navigationHandlers.applyOutgoingTurnEndPasses seam —
// MA-0048 repeat-save family). Only te marked soulTome fires here — the
// MA-0104 Banish te (no flag, rounds:2 clock) stays byte-untouched.
export async function applySoulTomeTrapTurnEnd(campaignName, targetName) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const te = effects.find(t => t.effect === SOUL_TOME_TE && t.target === targetName && t.soulTome === true);
    if (!te) return { handled: false };

    const attackerName = te.source;
    const saveDc = te.dc ?? 17;
    const saveType = te.saveType || 'CHA';
    const label = te.actionName || 'Banishing Claw (Requires Soul Tome)';
    const cs = getCombatSummary(campaignName);
    const csCreature = cs?.creatures?.find(c => c.name === targetName);

    const { roll, saveBonus, success } = await resolveRepeatSave({ csCreature, targetName, attackerName, saveDc, campaignName, label });
    const total = roll + saveBonus;

    await addEntry(campaignName, {
        type: 'save_result',
        characterName: attackerName,
        rollType: 'save-soul-tome-repeat',
        targetName,
        saveDc,
        saveType,
        success,
        roll,
        total,
        saveBonus,
        description: success
            ? `${targetName} succeeded its repeat Charisma save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — escapes the Soul Tome, appearing in the space it left or the nearest unoccupied space (placement GM-enforced).`
            : `${targetName} failed its repeat Charisma save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — remains trapped (Incapacitated); cumulative fails toward becoming bound to the tome (3) are GM-enforced — no fail-counter consumer.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[soulTomeTrapService:repeat-result]', e); });

    if (success) {
        removeSoulTomeTe(targetName, campaignName);
        removeCondition(targetName, 'incapacitated', campaignName);
        await addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Incapacitated',
            reason: 'Escaped the Soul Tome (repeat save succeeded)',
            sourceName: attackerName,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[soulTomeTrapService:repeat-removed]', e); });
        return { handled: true, success: true, roll, total };
    }

    return { handled: true, success: false, roll, total };
}
