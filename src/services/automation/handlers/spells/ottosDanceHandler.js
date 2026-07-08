import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';


/**
 * Process a repeated WIS save for a creature charmed by Otto's Irresistible Dance.
 * Called when the affected creature takes an action to collect itself.
 */
export async function processOttoDanceRepeatSave(casterName, targetName, saveDc, spellName, campaignName) {
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
        description: `${targetName} makes a WIS save (DC ${saveDc}) to collect itself (${spellName}).`,
        promptId,
    }).catch((e) => { console.error("[ottosDance] Error:", e); });

    const saveResult = await promise;

    if (saveResult.success) {
        // Spell ends — remove Charmed, speed_zero, clear tracking
        const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conds = Array.isArray(storedConds) ? storedConds : [];
        setRuntimeValue(targetName, 'activeConditions', conds.filter(c =>
            String(c).toLowerCase() !== 'charmed' &&
            String(c).toLowerCase() !== 'speed_zero'
        ), campaignName);
        setRuntimeValue(casterName, trackingKey, null, campaignName);

        cleanupTargetEffect(casterName, targetName, campaignName);

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-ottos-dance',
            targetName,
            saveDc,
            saveType: 'WIS',
            success: true,
            description: `${targetName} succeeded on WIS save. ${spellName} ends!`,
        }).catch((e) => { console.error("[ottosDance] Error:", e); });

        addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Charmed, Speed 0',
            reason: `${spellName} (successful save)`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[ottosDance] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: spellName,
                description: `${targetName} succeeded on WIS save. ${spellName} ends!`,
            },
        };
    }

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-ottos-dance',
        targetName,
        saveDc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save. ${spellName} continues.`,
    }).catch((e) => { console.error("[ottosDance] Error:", e); });

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
    return `_ottosDance_${targetName.replace(/\s+/g, '_')}`;
}

function cleanupTargetEffect(casterName, targetName, campaignName) {
    const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
    const effects = Array.isArray(targetEffects) ? targetEffects : [];
    const cleaned = effects.filter(
        te => !(te.target === targetName && te.effect === 'ottos_dance_repeat_save' && te.source === casterName)
    );
    setRuntimeValue(campaignName, 'targetEffects', cleaned, campaignName);
}

/**
 * Process the initial save success: target dances until end of next turn, speed_zero.
 */
export async function processOttoDanceSuccessSave(casterName, targetName, spellName, campaignName) {
    const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conds = Array.isArray(storedConds) ? storedConds : [];
    const filtered = conds.filter(c =>
        String(c).toLowerCase() !== 'speed_zero'
    );
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'speed_zero'], campaignName);

    addExpiration(casterName, targetName, [
        { type: 'speed_zero', condition: 'speed_zero' },
    ], campaignName, undefined, casterName);

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Speed 0',
        reason: `${spellName} (successful save)`,
        note: `${targetName} dances comically until the end of its next turn, spending all movement in place.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[ottosDance] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: spellName,
            description: `${targetName} succeeded on WIS save and dances comically until the end of its next turn, spending all movement in place.`,
        },
    };
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
                description: 'No creatures in combat. Otto\'s Irresistible Dance has no effect.',
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
                description: 'No target selected. Otto\'s Irresistible Dance has no effect.',
            },
        };
    }

    // Check if this target already has an active Otto's Dance effect (repeat save)
    const trackingKey = getTrackingKey(targetName);
    const existingTracking = getRuntimeValue(casterName, trackingKey, campaignName);
    if (existingTracking) {
        return await processOttoDanceRepeatSave(casterName, targetName, dc, action.name, campaignName);
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
        description: `${casterName} casts Otto's Irresistible Dance on ${targetName}! ${targetName} must make a WIS save (DC ${dc}) or become Charmed.`,
        promptId,
    }).catch((e) => { console.error("[ottosDance] Error:", e); });

    const saveResult = await promise;

    if (saveResult.success) {
        // Successful save: dances comically until end of next turn, speed_zero
        return await processOttoDanceSuccessSave(casterName, targetName, action.name, campaignName);
    }

    // Failed save: apply Charmed + speed_zero conditions
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c =>
        String(c).toLowerCase() !== 'charmed' &&
        String(c).toLowerCase() !== 'speed_zero'
    );
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'charmed', 'speed_zero'], campaignName);

    // Set tracking for repeat saves
    setRuntimeValue(casterName, trackingKey, true, campaignName);

    addExpiration(casterName, targetName, [
        { type: 'charmed', condition: 'charmed' },
        { type: 'speed_zero', condition: 'speed_zero' },
    ], campaignName);

    // Store target effect for repeat saves
    const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
    const effects = Array.isArray(targetEffects) ? targetEffects : [];
    const existingIdx = effects.findIndex(
        te => te.target === targetName && te.effect === 'ottos_dance_repeat_save'
    );
    const danceEffect = {
        target: targetName,
        effect: 'ottos_dance_repeat_save',
        source: casterName,
        condition: 'charmed',
        dc: dc,
        saveType: 'WIS',
        duration: 'concentration',
    };
    if (existingIdx >= 0) {
        effects[existingIdx] = danceEffect;
    } else {
        effects.push(danceEffect);
    }
    setRuntimeValue(campaignName, 'targetEffects', effects, campaignName);

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-ottos-dance',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against Otto's Irresistible Dance and is Charmed with Speed 0. On each of its turns, it can take an action to collect itself and repeat the save.`,
    }).catch((e) => { console.error("[ottosDance] Error:", e); });

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Charmed, Speed 0',
        reason: action.name,
        note: `${targetName} is Charmed by ${action.name}. While Charmed, the target dances comically, must use all movement to dance in place, has Disadvantage on Dexterity saving throws and attack rolls, and other creatures have Advantage on attack rolls against it.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[ottosDance] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetName} failed WIS save and is Charmed with Speed 0. While Charmed, the target has Disadvantage on Dexterity saving throws and attack rolls, and other creatures have Advantage on attack rolls against it. On each of its turns, the target can take an action to collect itself and repeat the save.`,
        },
    };
}
