import { buildSaveDc, createSaveListener } from '../common/savePrompt.js';
import { resolveTarget } from '../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { addExpiration } from '../../rules/expirations.js';
import { getCombatContext } from '../../rules/damageUtils.js';
import { postLogEntry } from '../../shared/logPoster.js';

/**
 * Process a repeated WIS save for a creature already Paralyzed by Hold Person/Monster.
 * Called at end of the affected creature's turn.
 * Returns { type, payload } for the popup, or null if no effect.
 */
export async function processHoldMonsterRepeatSave(casterName, targetName, saveDc, spellName, campaignName) {
    const trackingKey = getTrackingKey(targetName);
    const tracking = getRuntimeValue(casterName, trackingKey, campaignName);
    if (!tracking) {
        return null;
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc,
        dcSuccess: 'none',
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: spellName,
        description: `${targetName} makes a WIS save (DC ${saveDc}) at end of turn (${spellName}).`,
        promptId,
    }).catch(() => {});

    const saveResult = await promise;

    if (saveResult.success) {
        // Spell ends — remove Paralyzed, clear tracking
        const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conds = Array.isArray(storedConds) ? storedConds : [];
        setRuntimeValue(targetName, 'activeConditions', conds.filter(c => String(c).toLowerCase() !== 'paralyzed'), campaignName);
        setRuntimeValue(casterName, trackingKey, null, campaignName);

        // Clean up target effect
        cleanupTargetEffect(casterName, targetName, campaignName);

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-hold-monster',
            targetName,
            saveDc,
            saveType: 'WIS',
            success: true,
            description: `${targetName} succeeded on WIS save. ${spellName} ends!`,
        }).catch(() => {});

        postLogEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Paralyzed',
            reason: `${spellName} (successful save)`,
            timestamp: Date.now(),
        });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: spellName,
                description: `${targetName} succeeded on WIS save. ${spellName} ends!`,
            },
        };
    }

    // Failed save — spell continues
    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-hold-monster',
        targetName,
        saveDc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save. ${spellName} continues.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: spellName,
            description: `${targetName} failed WIS save. ${spellName} continues.`,
        },
    };
}

function getTrackingKey(targetName) {
    return `_holdMonster_${targetName.replace(/\s+/g, '_')}`;
}

function cleanupTargetEffect(casterName, targetName, campaignName) {
    const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
    const effects = Array.isArray(targetEffects) ? targetEffects : [];
    const cleaned = effects.filter(
        te => !(te.target === targetName && te.effect === 'hold_monster_repeat_save' && te.source === casterName)
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

    // Check if this target already has an active Hold Person/Monster effect (repeat save)
    const trackingKey = getTrackingKey(targetName);
    const existingTracking = getRuntimeValue(casterName, trackingKey, campaignName);
    if (existingTracking) {
        // This is a repeated end-of-turn save
        return await processHoldMonsterRepeatSave(casterName, targetName, dc, action.name, campaignName);
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc: dc,
        dcSuccess: 'none',
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${casterName} casts ${action.name} on ${targetName}! ${targetName} must make a WIS save (DC ${dc}) or become Paralyzed.`,
        promptId,
    }).catch(() => {});

    const saveResult = await promise;

    if (saveResult.success) {
        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-hold-monster',
            targetName,
            saveDc: dc,
            saveType: 'WIS',
            success: true,
            description: `${targetName} succeeded on WIS save against ${action.name}.`,
        }).catch(() => {});

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} succeeded on WIS save against ${action.name}.`,
            },
        };
    }

    // Failed save: apply Paralyzed condition
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'paralyzed');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'paralyzed'], campaignName);

    // Set tracking for end-of-turn repeat saves
    setRuntimeValue(casterName, trackingKey, true, campaignName);

    addExpiration(casterName, targetName, [
        { type: 'condition', condition: 'paralyzed' },
    ], campaignName, 10);

    // Store target effect for end-of-turn repeated saves
    const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
    const effects = Array.isArray(targetEffects) ? targetEffects : [];
    const existingIdx = effects.findIndex(
        te => te.target === targetName && te.effect === 'hold_monster_repeat_save'
    );
    const holdEffect = {
        target: targetName,
        effect: 'hold_monster_repeat_save',
        source: casterName,
        condition: 'paralyzed',
        dc: dc,
        saveType: 'WIS',
        duration: 'concentration',
    };
    if (existingIdx >= 0) {
        effects[existingIdx] = holdEffect;
    } else {
        effects.push(holdEffect);
    }
    setRuntimeValue(campaignName, 'targetEffects', effects, campaignName);

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-hold-monster',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against ${action.name} and is Paralyzed. At the end of each of its turns, it repeats the save.`,
    }).catch(() => {});

    postLogEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Paralyzed',
        reason: action.name,
        note: `${targetName} is Paralyzed by ${action.name}. Must make WIS save at end of each turn. Success ends the spell.`,
        timestamp: Date.now(),
    });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetName} failed WIS save and is Paralyzed. At the end of each of its turns, it repeats the save, ending the spell on itself on a success.`,
        },
    };
}
