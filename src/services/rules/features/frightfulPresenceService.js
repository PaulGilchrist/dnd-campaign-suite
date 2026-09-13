import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addExpiration } from '../effects/expirationQueue.js';
import { registerTargetEffect } from '../../combat/conditions/targetEffectDefinitions.js';

// MA-0048: Adult Blue Dracolich Frightful Presence. Failed save → Frightened
// (MA-0017 damageless-save seam). This service carries the RAW residuals:
// repeat save at the end of each frightened turn (success ends the effect),
// and 24h immunity to THIS dracolich's FP after a success or effect-end.
// 24h is beyond combat scale — encoded as 1440 minutes × 10 = 14400 rounds
// (CLA-334 minutes×10 convention; same encoding as the MA-0030 1-hour gaze).

export const FP_TE_EFFECT = 'frightful_presence';
export const FP_IMMUNITY_TE_EFFECT = 'frightful_presence_immunity';
const FP_IMMUNITY_ROUNDS = 14400;

function lower(value) {
    return String(value ?? '').toLowerCase();
}

function findFrightfulPresenceEffect(targetName, campaignName) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    return effects.find(te => te.effect === FP_TE_EFFECT && te.target === targetName) || null;
}

// Failed-save tracker: te marker (dc + save type for the turn-end repeat)
// + ONE merged expiration clock — 1 minute = 10 rounds (CLA-334) strips the
// marker and the Frightened condition, then grants the 24h immunity (the RAW
// "or the effect ends for it" clause lands here).
export async function trackFrightfulPresence({ campaignName, attackerName, targetName, saveType, saveDc }) {
    if (!campaignName || !attackerName || !targetName || saveDc == null) return;
    registerTargetEffect(campaignName, targetName, FP_TE_EFFECT, attackerName, {
        condition: 'frightened',
        saveType: saveType || 'WIS',
        dc: saveDc,
        duration: '1_minute',
        rounds: 10,
    });
    addExpiration({
        attackerName,
        targetName,
        campaignName,
        rounds: 10,
        effects: [
            { type: 'remove_target_effect', effectKey: FP_TE_EFFECT, source: attackerName, target: targetName },
            { type: 'condition', condition: 'frightened' },
            { type: 'frightful_presence_immunity_grant', immunityEffect: FP_IMMUNITY_TE_EFFECT },
        ],
    });
    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'frightful_presence_tracked',
        characterName: targetName,
        sourceName: attackerName,
        abilityName: 'Frightful Presence',
        description: `${targetName} is Frightened by ${attackerName}'s Frightful Presence (DC ${saveDc}) — repeats the save at the end of each of its turns; effect ends after 1 minute (10 rounds), then ${targetName} is immune to ${attackerName}'s Frightful Presence for 24 hours (14400 rounds).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[frightfulPresenceService:tracked]', e); });
}

// 24h immunity grant (repeat-save success leg). Row-click refusals vs this te
// are enforced by the MA-0030 immunity gate (gazeImmunityActive reads the
// effect key from the row's authored success_immunity).
export async function grantFrightfulPresenceImmunity({ campaignName, attackerName, targetName, reason }) {
    registerTargetEffect(campaignName, targetName, FP_IMMUNITY_TE_EFFECT, attackerName, {
        duration: '24_hours',
        rounds: FP_IMMUNITY_ROUNDS,
    });
    addExpiration({
        attackerName,
        targetName,
        campaignName,
        rounds: FP_IMMUNITY_ROUNDS,
        effects: [{ type: 'remove_target_effect', effectKey: FP_IMMUNITY_TE_EFFECT, source: attackerName, target: targetName }],
    });
    await addEntry(campaignName, {
        type: 'automation',
        automationType: `${FP_IMMUNITY_TE_EFFECT}_granted`,
        characterName: targetName,
        sourceName: attackerName,
        abilityName: 'Frightful Presence',
        description: `${targetName} is immune to ${attackerName}'s Frightful Presence for the next 24 hours (14400 rounds) — ${reason}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[frightfulPresenceService:immunity-granted]', e); });
}

function stripFrightened(targetName, campaignName) {
    const stored = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(stored) ? stored : [];
    const filtered = conditions.filter(c => lower(c) !== 'frightened');
    if (filtered.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
    }
}

function removeFrightfulPresenceTe(targetName, campaignName) {
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const filtered = effects.filter(te => !(te.effect === FP_TE_EFFECT && te.target === targetName));
    if (filtered.length !== effects.length) {
        setRuntimeValue('campaign', 'targetEffects', filtered, campaignName);
    }
}

// NPC repeats auto-roll inline (applySleepTurnEnd shape); PCs get a queued
// save listener prompt at the end of their own turn.
async function resolveFrightfulPresenceRepeatSave(csCreature, targetName, saveType, saveDc, campaignName) {
    if (csCreature?.type !== 'player') {
        const key = lower(saveType) === 'wis' ? 'wis' : lower(saveType);
        const saveBonus = csCreature?.saveBonuses?.[key] ?? csCreature?.saveBonuses?.wis ?? 0;
        const roll = Math.floor(Math.random() * 20) + 1;
        return { roll, saveBonus, success: (roll + saveBonus) >= saveDc };
    }
    const { promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc,
        dcSuccess: 'none',
        condition: 'Frightful Presence (repeat save)',
    });
    const saveResult = await promise;
    return { roll: saveResult.roll ?? 0, saveBonus: saveResult.saveBonus ?? 0, success: saveResult.success };
}

// Turn-END consumer (navigationHandlers.applyOutgoingTurnEndPasses seam —
// the registered applySleepTurnEnd family). Repeats the FP save at the end of
// each frightened turn: success sheds Frightened + grants 24h immunity; failure
// keeps Frightened (the 10-round clock ends the effect and grants immunity).
export async function applyFrightfulPresenceTurnEnd(campaignName, targetName) {
    const fpEffect = findFrightfulPresenceEffect(targetName, campaignName);
    if (!fpEffect) return { handled: false };

    const saveDc = fpEffect.dc ?? 18;
    const saveType = fpEffect.saveType || 'WIS';
    const attackerName = fpEffect.source;
    const cs = getCombatSummary(campaignName);
    const csCreature = cs?.creatures?.find(c => c.name === targetName);

    const { roll, saveBonus, success } = await resolveFrightfulPresenceRepeatSave(csCreature, targetName, saveType, saveDc, campaignName);
    const total = roll + saveBonus;

    await addEntry(campaignName, {
        type: 'save_result',
        characterName: attackerName,
        rollType: 'save-fp-repeat',
        targetName,
        saveDc,
        saveType,
        success,
        roll,
        total,
        saveBonus,
        description: success
            ? `${targetName} succeeded its repeat Wisdom save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — Frightful Presence ends; immune to ${attackerName}'s Frightful Presence for 24 hours.`
            : `${targetName} failed its repeat Wisdom save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — remains Frightened.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[frightfulPresenceService:repeat-result]', e); });

    if (success) {
        stripFrightened(targetName, campaignName);
        removeFrightfulPresenceTe(targetName, campaignName);
        await grantFrightfulPresenceImmunity({ campaignName, attackerName, targetName, reason: 'repeat save succeeded' });
        await addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Frightened',
            reason: 'Frightful Presence ends (repeat save succeeded)',
            sourceName: attackerName,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[frightfulPresenceService:repeat-removed]', e); });
        return { handled: true, success: true, roll, total };
    }

    return { handled: true, success: false, roll, total };
}
