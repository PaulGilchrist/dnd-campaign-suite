import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

/**
 * Process a repeated CON save for a creature already Stunned by Power Word Stun.
 * Called at end of the affected creature's turn.
 */
export async function processPowerWordStunRepeatSave(casterName, targetName, saveDc, spellName, campaignName) {
    const trackingKey = getTrackingKey(targetName);
    const tracking = getRuntimeValue(casterName, trackingKey, campaignName);
    if (!tracking) {
        return null;
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'CON',
        saveDc,
        dcSuccess: 'none',
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: spellName,
        description: `${targetName} makes a CON save (DC ${saveDc}) at end of turn (${spellName}).`,
        promptId,
    }).catch((e) => { console.error("[powerWordStun] Error:", e); });

    const saveResult = await promise;

    if (saveResult.success) {
        // Spell ends — remove Stunned, clear tracking
        const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conds = Array.isArray(storedConds) ? storedConds : [];
        setRuntimeValue(targetName, 'activeConditions', conds.filter(c => String(c).toLowerCase() !== 'stunned'), campaignName);
        setRuntimeValue(casterName, trackingKey, null, campaignName);

        // Clean up target effect
        cleanupTargetEffect(casterName, targetName, campaignName);

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-power-word-stun',
            targetName,
            saveDc,
            saveType: 'CON',
            success: true,
            description: `${targetName} succeeded on CON save. ${spellName} ends!`,
        }).catch((e) => { console.error("[powerWordStun] Error:", e); });

        addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Stunned',
            reason: `${spellName} (successful save)`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[powerWordStun] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: spellName,
                description: `${targetName} succeeded on CON save. ${spellName} ends!`,
            },
        };
    }

    // Failed save — spell continues
    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-power-word-stun',
        targetName,
        saveDc,
        saveType: 'CON',
        success: false,
        description: `${targetName} failed CON save. ${spellName} continues.`,
    }).catch((e) => { console.error("[powerWordStun] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: spellName,
            description: `${targetName} failed CON save. ${spellName} continues.`,
        },
    };
}

function getTrackingKey(targetName) {
    return `_powerWordStun_${targetName.replace(/\s+/g, '_')}`;
}

function cleanupTargetEffect(casterName, targetName, campaignName) {
    const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
    const effects = Array.isArray(targetEffects) ? targetEffects : [];
    const cleaned = effects.filter(
        te => !(te.target === targetName && te.effect === 'power_word_stun_repeat_save' && te.source === casterName)
    );
    setRuntimeValue(campaignName, 'targetEffects', cleaned, campaignName);
}

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
                description: `No creatures in combat. ${action.name} has no effect.`,
            },
        };
    }

    const casterName = playerStats.name;
    const targetInfo = await resolveTarget(campaignName, casterName);
    const targetName = targetInfo?.target?.name;

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No target selected. ${action.name} has no effect.`,
            },
        };
    }

    // Check if this target already has an active Power Word Stun effect (repeat save)
    const trackingKey = getTrackingKey(targetName);
    const existingTracking = getRuntimeValue(casterName, trackingKey, campaignName);
    if (existingTracking) {
        return await processPowerWordStunRepeatSave(casterName, targetName, dc, action.name, campaignName);
    }

    // Get target's current HP from combat context
    const targetCreature = cs.creatures.find(c => c.name === targetName);
    const targetCurrentHp = targetCreature?.currentHp ?? targetCreature?.hit_points?.current ?? null;

    let description;
    let actionsTaken = [];

    if (targetCurrentHp !== null && targetCurrentHp <= 150) {
        // Target has 150 HP or fewer → Stunned condition
        const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'stunned');
        setRuntimeValue(targetName, 'activeConditions', [...filtered, 'stunned'], campaignName);

        // Set tracking for end-of-turn repeat saves
        setRuntimeValue(casterName, trackingKey, true, campaignName);

        // Store target effect for end-of-turn repeated saves
        const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
        const effects = Array.isArray(targetEffects) ? targetEffects : [];
        const existingIdx = effects.findIndex(
            te => te.target === targetName && te.effect === 'power_word_stun_repeat_save'
        );
        const stunEffect = {
            target: targetName,
            effect: 'power_word_stun_repeat_save',
            source: casterName,
            condition: 'stunned',
            dc: dc,
            saveType: 'CON',
        };
        if (existingIdx >= 0) {
            effects[existingIdx] = stunEffect;
        } else {
            effects.push(stunEffect);
        }
        setRuntimeValue(campaignName, 'targetEffects', effects, campaignName);

        addEntry(campaignName, {
            type: 'condition',
            action: 'applied',
            characterName: targetName,
            condition: 'Stunned',
            reason: action.name,
            note: `${targetName} is Stunned by ${action.name} (${targetCurrentHp} HP). Must make CON save at end of each turn.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[powerWordStun] Error:", e); });

        description = `${targetName} has ${targetCurrentHp} HP (150 or fewer). ${targetName} is Stunned. At the end of each of its turns, ${targetName} makes a CON save (DC ${dc}). On a success, the condition ends.`;
        actionsTaken.push('stunned');
    } else {
        // Target has more than 150 HP → Speed 0 until start of next turn
        setRuntimeValue(targetName, 'activeConditions', [...(getRuntimeValue(targetName, 'activeConditions', campaignName) || []), 'speed_zero'], campaignName);

        // Set expiration: speed_zero ends at start of caster's next turn
        addExpiration(casterName, targetName, [
            { type: 'speed_zero', condition: 'speed_zero' },
        ], campaignName, undefined, casterName);

        addEntry(campaignName, {
            type: 'condition',
            action: 'applied',
            characterName: targetName,
            condition: 'Speed 0',
            reason: action.name,
            note: `${targetName} has Speed 0 from ${action.name} (${targetCurrentHp !== null ? targetCurrentHp + ' HP' : 'HP unknown'}). Ends at start of caster's next turn.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[powerWordStun] Error:", e); });

        description = `${targetName} has ${targetCurrentHp !== null ? targetCurrentHp + ' HP' : 'unknown HP'} (more than 150). ${targetName}'s Speed is 0 until the start of your next turn.`;
        actionsTaken.push('speed_zero');
    }

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-power-word-stun',
        targetName,
        saveDc: dc,
        saveType: 'CON',
        success: false,
        description: description,
    }).catch((e) => { console.error("[powerWordStun] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: description,
        },
    };
}
