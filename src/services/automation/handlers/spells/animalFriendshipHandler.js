import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

import { addExpiration } from '../../../rules/effects/expirations.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';

import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';

function dispatchSaveResult(campaignName, promptId, targetName, saveType, saveDc, saveResult) {
    sendSaveResult(campaignName, targetName, {
        promptId,
        success: saveResult.success,
        roll: saveResult.roll,
        total: saveResult.total,
        saveBonus: saveResult.bonus,
        rawRolls: saveResult.rawRolls,
    });

    window.dispatchEvent(new CustomEvent('save-result', {
        detail: {
            promptId,
            targetName,
            saveType,
            saveDc,
            success: saveResult.success,
            roll: saveResult.roll,
            total: saveResult.total,
            saveBonus: saveResult.bonus,
            rawRolls: saveResult.rawRolls,
        },
    }));
}

/**
 * Track that Animal Friendship was cast on a target so we can end the spell
 * if the caster or allies deal damage to that target.
 */
function trackAnimalFriendshipTarget(casterName, targetName, campaignName) {
    const key = `_animalFriendship_${casterName}_${targetName}`;
    setRuntimeValue('campaign', key, true, campaignName);
}

/**
 * Remove the Animal Friendship tracking for a target (spell ends).
 */
function untrackAnimalFriendshipTarget(casterName, targetName, campaignName) {
    const key = `_animalFriendship_${casterName}_${targetName}`;
    setRuntimeValue('campaign', key, null, campaignName);
}

/**
 * Check if Animal Friendship is active on a target.
 */
function isAnimalFriendshipActive(casterName, targetName, campaignName) {
    const key = `_animalFriendship_${casterName}_${targetName}`;
    return getRuntimeValue('campaign', key, campaignName) === true;
}

/**
 * End Animal Friendship early for a specific target (e.g., due to damage).
 */
export function endAnimalFriendshipEarly(casterName, targetName, campaignName) {
    if (!isAnimalFriendshipActive(casterName, targetName, campaignName)) return;

    // Remove charmed condition
    const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'charmed');
    if (filtered.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
    }

    untrackAnimalFriendshipTarget(casterName, targetName, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Animal Friendship',
        description: `${targetName} knows it was Charmed by ${casterName} as Animal Friendship ends early due to damage.`,
    }).catch((e) => { console.error("[animalFriendshipHandler:log-error]", e); });
}

async function applyAnimalFriendshipCharm({ campaignName, casterName, action: _action, targetName, dc, saveResult, affectedTargets }) {
    // Apply charmed condition
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'charmed');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'charmed'], campaignName);

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: ['charmed'],
        appliedDamage: 0,
    });

    // Add long rest expiration (24-hour duration)
    addExpiration(casterName, targetName, [
        { type: 'charmed', condition: 'charmed' },
    ], campaignName);

    // Track for early end on damage
    trackAnimalFriendshipTarget(casterName, targetName, campaignName);

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Charmed',
        reason: 'Animal Friendship spell',
        note: `${targetName} is Charmed by ${casterName} and regards them as a friendly acquaintance. The spell ends if ${casterName} or allies deal damage to ${targetName}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[animalFriendship] Error:", e); });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-animal-friendship',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against Animal Friendship and is Charmed.`,
    }).catch((e) => { console.error("[animalFriendship] Error:", e); });

    affectedTargets.push(`${targetName} is Charmed by Animal Friendship.`);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);

    const casterName = playerStats.name;
    const targetNames = auto.targetNames || [];
    const slotLevel = action.spellSlotLevel || 1;
    const maxTargets = slotLevel;

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'WIS',
        saveDc: dc,
        attackScope: 'aoe',
    });

    const cs = await getCombatContext(campaignName);
    const csForTracking = cs || await getCombatContext(campaignName);

    let affectedCount = 0;
    let savedCount = 0;
    const affectedTargets = [];

    // Limit to maxTargets based on slot level
    const targets = targetNames.slice(0, maxTargets);

    for (const targetName of targets) {
        const { promptId, promise } = createSaveListener(campaignName, {
            targetName,
            saveType: 'WIS',
            saveDc: dc,
            dcSuccess: 'none',
            disadvantage: action.metaCtx?.metamagicHeighten,
            condition: 'charmed',
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts Animal Friendship on ${targetName}! ${targetName} must make a WIS save (DC ${dc}) or become Charmed.`,
            promptId,
        }).catch((e) => { console.error("[animalFriendship] Error:", e); });

        // Auto-roll NPC saves
        if (csForTracking?.creatures) {
            const creature = csForTracking.creatures.find(c => c.name === targetName);
            if (creature && creature.type === 'npc') {
                const saveResult = rollSaveForCreature(creature, 'WIS', dc, false, false);
                dispatchSaveResult(campaignName, promptId, targetName, 'WIS', dc, saveResult);
            }
        }

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
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
                characterName: casterName,
                rollType: 'save-animal-friendship',
                targetName,
                saveDc: dc,
                saveType: 'WIS',
                success: true,
                description: `${targetName} succeeded on WIS save against Animal Friendship.`,
            }).catch((e) => { console.error("[animalFriendship] Error:", e); });
        } else {
            affectedCount++;
            await applyAnimalFriendshipCharm({ campaignName, casterName, action, targetName, dc, saveResult, affectedTargets });
        }
    }

    const summary = affectedCount > 0
        ? `Animal Friendship affects ${affectedCount} creature(s). ${savedCount} creature(s) saved. ${affectedTargets.join(' ')} Affected creatures are Charmed and regard ${casterName} as a friendly acquaintance. The spell ends for a target if ${casterName} or allies deal damage to it.`
        : `No creatures affected by Animal Friendship. ${savedCount} creature(s) saved.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}

export { isAnimalFriendshipActive };
