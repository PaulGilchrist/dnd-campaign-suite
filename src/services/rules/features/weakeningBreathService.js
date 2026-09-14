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

function findWeakeningBreathEffect(targetName, campaignName) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    return effects.find(te => te.effect === WEAKENING_BREATH_TE && te.target === targetName) || null;
}

// Failed-save grant (cone picker NPC auto-leg and PC prompt leg both route
// here): te + ONE merged 10-round clock + save_result + condition logs.
export async function grantWeakeningBreath({ campaignName, attackerName, targetName, saveType, saveDc, roll, saveBonus }) {
    if (!campaignName || !attackerName || !targetName || saveDc == null) return;
    const ability = saveType || 'Strength';
    const die = '1d6';
    registerTargetEffect(campaignName, targetName, WEAKENING_BREATH_TE, attackerName, {
        duration: '1_minute',
        rounds: WEAKENING_BREATH_ROUNDS,
        dc: saveDc,
        saveType: ability,
        strCheckDisadvantage: true,
        damageSubtractDie: die,
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
        description: `${targetName} failed the ${ability} save (DC ${saveDc}) in ${attackerName}'s Weakening Breath — Disadvantage on Strength-based d20 tests and subtracts ${die} from damage rolls; repeats the save at the end of each of its turns (auto-succeeds after 1 minute — 10 rounds).`,
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


function removeWeakeningBreathTe(targetName, campaignName) {
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const filtered = effects.filter(te => !(te.effect === WEAKENING_BREATH_TE && te.target === targetName));
    if (filtered.length !== effects.length) {
        setRuntimeValue('campaign', 'targetEffects', filtered, campaignName);
    }
}


// Turn-END consumer (navigationHandlers.applyOutgoingTurnEndPasses seam —
// beside applyFrightfulPresenceTurnEnd / applySleepTurnEnd). Success strips
// the te (effect ends on itself); failure keeps it (the 10-round clock still
// auto-succeeds after 1 minute).
export async function applyWeakeningBreathTurnEnd(campaignName, targetName) {
    const te = findWeakeningBreathEffect(targetName, campaignName);
    if (!te) return { handled: false };

    const saveDc = te.dc ?? 21;
    const saveType = te.saveType || 'Strength';
    const attackerName = te.source;
    const cs = getCombatSummary(campaignName);
    const csCreature = cs?.creatures?.find(c => c.name === targetName);

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
        removeWeakeningBreathTe(targetName, campaignName);
        await addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Weakened',
            reason: 'Weakening Breath ends (repeat save succeeded)',
            sourceName: attackerName,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[weakeningBreathService:repeat-removed]', e); });
        return { handled: true, success: true, roll, total };
    }

    return { handled: true, success: false, roll, total };
}
