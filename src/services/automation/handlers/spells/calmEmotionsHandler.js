import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import { playerIsImmuneToCondition } from '../../../combat/automation/automationService.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';

// ── Shared helpers (also used by the modal) ──────────────────────────

/**
 * Apply the immunity/suppress path for a single creature.
 */
export async function applyCalmEmotionsImmunity({
    targetName, casterName, campaignName, dc,
}) {
    // Remove charmed/frightened from activeConditions and record what was suppressed
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const lowerConditions = conditions.map(c => String(c).toLowerCase());
    const suppressedConditions = [];
    if (lowerConditions.includes('charmed')) suppressedConditions.push('charmed');
    if (lowerConditions.includes('frightened')) suppressedConditions.push('frightened');

    const filtered = conditions.filter(c =>
        String(c).toLowerCase() !== 'charmed' &&
        String(c).toLowerCase() !== 'frightened'
    );
    if (filtered.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
    }

    // Add activeBuff granting immunity
    const activeBuffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs', campaignName))
        ? getRuntimeValue(targetName, 'activeBuffs', campaignName) : [];
    const newBuffs = [...activeBuffs, {
        name: 'Calm Emotions',
        effect: 'calm_emotions',
        conditionImmunity: ['Charmed', 'Frightened'],
        sourceCharacter: casterName,
        duration: 'concentration',
    }];
    setRuntimeValue(targetName, 'activeBuffs', newBuffs, campaignName);

    // Track targetEffect for concentration cleanup
    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(targetEffects) ? [...targetEffects] : [];
    const existingIdx = effects.findIndex(
        te => te.target === targetName && te.effect === 'calm_emotions'
    );
    const calmEffect = {
        target: targetName,
        effect: 'calm_emotions',
        mode: 'immunity',
        source: casterName,
        suppressedConditions,
        dc: dc,
        duration: 'concentration',
    };
    if (existingIdx >= 0) {
        effects[existingIdx] = calmEffect;
    } else {
        effects.push(calmEffect);
    }
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName);

    // Log
    if (suppressedConditions.length > 0) {
        await addEntry(campaignName, {
            type: 'condition',
            action: 'applied',
            characterName: targetName,
            condition: 'Calm Emotions (Suppressed: ' + suppressedConditions.join(', ') + ')',
            reason: 'Calm Emotions spell',
            note: `${targetName}'s ${suppressedConditions.join(', ')} condition(s) are suppressed and immune to Charmed/Frightened.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[calmEmotions] Error:', e); });
    } else {
        await addEntry(campaignName, {
            type: 'condition',
            action: 'applied',
            characterName: targetName,
            condition: 'Calm Emotions (Immune to Charmed/Frightened)',
            reason: 'Calm Emotions spell',
            note: `${targetName} is immune to Charmed and Frightened.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[calmEmotions] Error:', e); });
    }
}

/**
 * Apply the charmed path for a single creature.
 * Returns { immune: true } if the creature is already immune.
 */
export async function applyCalmEmotionsCharmed({
    targetName, casterName, campaignName, dc, creature, characters,
}) {
    // Check immunity
    const isImmune = await checkCalmEmotionsImmunity({ targetName, creature, characters, campaignName });
    if (isImmune) {
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: 'Calm Emotions',
            description: `${targetName} is immune to being Charmed by Calm Emotions.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[calmEmotions] Error:', e); });
        return { immune: true };
    }

    // Apply charmed condition
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'charmed');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'charmed'], campaignName);

    // Track targetEffect for concentration cleanup
    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(targetEffects) ? [...targetEffects] : [];
    const existingIdx = effects.findIndex(
        te => te.target === targetName && te.effect === 'calm_emotions'
    );
    const calmEffect = {
        target: targetName,
        effect: 'calm_emotions',
        mode: 'charmed',
        source: casterName,
        conditions: ['charmed'],
        dc: dc,
        duration: 'concentration',
    };
    if (existingIdx >= 0) {
        effects[existingIdx] = calmEffect;
    } else {
        effects.push(calmEffect);
    }
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName);

    await addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Charmed',
        reason: 'Calm Emotions spell',
        note: `${targetName} is Charmed by Calm Emotions.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[calmEmotions] Error:', e); });

    return { immune: false };
}

/**
 * Check if a creature is immune to the Charmed condition.
 * Players: uses playerIsImmuneToCondition (covers computed + automation immunities).
 * NPCs: looks up condition_immunities via getMonsterData.
 */
async function checkCalmEmotionsImmunity({ targetName, creature, characters, campaignName }) {
    if (!creature) {
        return false;
    }

    if (creature.type === 'player') {
        const targetCharacter = characters?.find(c => c.name === targetName);
        const targetStats = targetCharacter?.computedStats || targetCharacter;
        if (targetStats && playerIsImmuneToCondition({
            conditionKey: 'charmed',
            playerStats: targetStats,
            getRuntimeValue,
            campaignName,
        })) {
            return true;
        }
    }

    if (creature.type === 'npc' || creature.type === 'monster') {
        try {
            const monsterData = await getMonsterData(targetName, null);
            const conditionImmunities = (monsterData?.condition_immunities || [])
                .map(c => String(c).toLowerCase());
            if (conditionImmunities.includes('charmed')) {
                return true;
            }
        } catch (error) {
            // Monster data not available — proceed with save
            console.warn('[calmEmotionsHandler] Monster data unavailable, proceeding with save:', error);
        }
    }

    return false;
}

// ── Handler (non-interactive / generic automation route) ─────────────

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);

    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures || cs.creatures.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No creatures in combat. Calm Emotions has no effect.',
            },
        };
    }

    const casterName = playerStats.name;

    // Register concentration
    const combatSummary = getCombatSummary(campaignName);
    if (combatSummary) {
        const spellDc = playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
        addConcentration(combatSummary, casterName, 'Calm Emotions', spellDc);
        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    }

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'CHA',
        saveDc: dc,
        attackScope: 'aoe',
    });

    const targets = cs.creatures.filter(c => c.name !== casterName);

    let affectedCount = 0;
    let savedCount = 0;
    const results = [];

    for (const target of targets) {
        const targetName = target.name;

        const { promptId, promise } = createSaveListener(campaignName, {
            targetName,
            saveType: 'CHA',
            saveDc: dc,
            dcSuccess: 'none',
            disadvantage: action.metaCtx?.metamagicHeighten === targetName,
        });

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts Calm Emotions! ${targetName} must make a CHA save (DC ${dc}) or be affected.`,
            promptId,
        }).catch((e) => { console.error('[calmEmotions] Error:', e); });

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
            await recordCalmTargetResult(campaignName, targetName, saveResult, 'success');
            await logCalmEmotionsSave(campaignName, casterName, targetName, dc, true,
                `${targetName} succeeded on CHA save against Calm Emotions.`);
        } else {
            affectedCount++;
            // Default to immunity path for non-interactive route
            await applyCalmEmotionsImmunity({ targetName, casterName, campaignName, dc });

            await recordCalmTargetResult(campaignName, targetName, saveResult, 'failure');

            await logCalmEmotionsSave(campaignName, casterName, targetName, dc, false,
                `${targetName} failed CHA save against Calm Emotions. Granted immunity to Charmed/Frightened.`);

            results.push(`${targetName} is immune to Charmed and Frightened.`);
        }
    }

    const summary = affectedCount > 0
        ? `Calm Emotions affects ${affectedCount} creature(s). ${results.join(' ')} ${savedCount} creature(s) saved.`
        : `No creatures affected by Calm Emotions. ${savedCount} creature(s) saved.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}

async function recordCalmTargetResult(campaignName, targetName, saveResult, saveOutcome) {
    await addTargetResult(campaignName, {
        targetName,
        saveResult: saveOutcome,
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: [],
        appliedDamage: 0,
    });
}

async function logCalmEmotionsSave(campaignName, casterName, targetName, dc, success, description) {
    await addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-calm-emotions',
        targetName,
        saveDc: dc,
        saveType: 'CHA',
        success,
        description,
    }).catch((e) => { console.error('[calmEmotions] Error:', e); });
}
