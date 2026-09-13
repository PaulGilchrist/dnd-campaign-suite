import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

const SPELL_NAME = 'Compelled Duel';
const EFFECT_KEY = 'compelled_duel';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);

    storeSpellLastAttack(campaignName, {
        casterName: playerStats.name,
        spellName: SPELL_NAME,
        saveType: 'WIS',
        saveDc: dc,
        attackScope: 'single',
    });

    const targetName = auto.targetName || 'Unknown';

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc: dc,
        dcSuccess: 'none',
        disadvantage: !!action.metaCtx?.metamagicHeighten,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: SPELL_NAME,
        description: `${playerStats.name} casts Compelled Duel on ${targetName}. ${targetName} must make a WIS save (DC ${dc}) or be compelled into a duel.`,
        promptId,
    }).catch((e) => { console.error("[compelledDuel] Error:", e); });

    const saveResult = await promise;

    if (saveResult.success) {
        await addTargetResult(campaignName, {
            targetName,
            saveResult: 'success',
            roll: saveResult.roll ?? 0,
            total: saveResult.total ?? 0,
            conditions: [],
            appliedDamage: 0,
        });
        addEntry(campaignName, {
            type: 'save_result',
            characterName: playerStats.name,
            rollType: 'save-compelled-duel',
            targetName,
            saveDc: dc,
            saveType: 'WIS',
            success: true,
            description: `${targetName} succeeded on WIS save against Compelled Duel.`,
        }).catch((e) => { console.error("[compelledDuel] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: SPELL_NAME,
                description: `${targetName} succeeded on the WIS save. Compelled Duel has no effect.`,
            },
        };
    }

    // ── Failed save: apply the compelled duel effect ──
    const allTargetEffects = [...getRuntimeValue('campaign', 'targetEffects') || []];
    const existingIndex = allTargetEffects.findIndex(
        te => te.target === targetName && te.effect === EFFECT_KEY && te.source === playerStats.name
    );

    const duelEffect = {
        target: targetName,
        effect: EFFECT_KEY,
        source: playerStats.name,
        duration: 'concentration',
    };

    if (existingIndex >= 0) {
        allTargetEffects[existingIndex] = duelEffect;
    } else {
        allTargetEffects.push(duelEffect);
    }

    setRuntimeValue('campaign', 'targetEffects', allTargetEffects, campaignName);

    // Set concentration tracking on the caster
    const combatSummary = getCombatSummary(campaignName);
    addConcentration(combatSummary, playerStats.name, SPELL_NAME, dc);

    // Apply expiration (concentration handles duration; 1 minute = 10 rounds default)
    addExpiration({ attackerName: playerStats.name, targetName, effects: [
        { type: 'remove_target_effect', effectKey: EFFECT_KEY, source: playerStats.name },
    ], campaignName });

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Compelled Duel',
        reason: 'Compelled Duel (failed save)',
        note: `${targetName} has Disadvantage on attack rolls against creatures other than ${playerStats.name} (Concentration, up to 1 minute).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[compelledDuel] Error:", e); });

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: [EFFECT_KEY],
        appliedDamage: 0,
    });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: SPELL_NAME,
            targetName,
            description: `${targetName} failed the WIS save. ${targetName} has Disadvantage on attack rolls against creatures other than ${playerStats.name} (Concentration, up to 1 minute).`,
            automation: auto,
        },
    };
}

export function isCompelledDuelActive(targetName, casterName, _campaignName) {
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    return allTargetEffects.some(
        te => te.target === targetName && te.effect === EFFECT_KEY && te.source === casterName
    );
}

export function endCompelledDuel(casterName, targetName, campaignName, reason) {
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filtered = allTargetEffects.filter(
        te => !(te.target === targetName && te.effect === EFFECT_KEY && te.source === casterName)
    );
    if (filtered.length === allTargetEffects.length) return null;

    setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, true);

    addEntry(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: targetName,
        condition: 'Compelled Duel',
        reason: 'Compelled Duel ended',
        note: reason,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[compelledDuel] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: SPELL_NAME,
            targetName,
            description: `${targetName} is no longer compelled by Compelled Duel. ${reason}`,
        },
    };
}

export function checkCompelledDuelAttackExpiry(casterName, attackedTargetName, campaignName) {
    if (!attackedTargetName) return null;
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const duel = allTargetEffects.find(te => te.effect === EFFECT_KEY && te.source === casterName);
    if (!duel) return null;
    if (duel.target === attackedTargetName) return null;
    return endCompelledDuel(
        casterName,
        duel.target,
        campaignName,
        `${casterName} attacked or forced a saving throw against ${attackedTargetName} instead of the duel target.`
    );
}
