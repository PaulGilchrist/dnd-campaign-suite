import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';


const MAX_FAILS = 3;
const MAX_SUCCESSES = 3;

function getTrackingKey(targetName) {
    return `_fleshToStone_${targetName.replace(/\s+/g, '_')}`;
}

/**
 * Process a repeated CON save for a creature already Restrained by Flesh to Stone.
 * Called at end of the affected creature's turn.
 * Returns { type, payload } for the popup, or null if no effect.
 */
export async function processFleshToStoneRepeatSave(casterName, targetName, saveDc, campaignName) {
    const trackingKey = getTrackingKey(targetName);
    const tracking = getRuntimeValue(casterName, trackingKey, campaignName);
    if (!tracking || !Array.isArray(tracking) || tracking.length < 2) {
        return null; // No active Flesh to Stone effect on this target
    }

    const [currentSuccesses, currentFails] = tracking;

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'CON',
        saveDc,
        dcSuccess: 'none',
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Flesh to Stone',
        description: `${targetName} makes a CON save (DC ${saveDc}) at end of turn (Flesh to Stone: ${currentSuccesses}/${MAX_SUCCESSES} successes, ${currentFails}/${MAX_FAILS} failures).`,
        promptId,
    }).catch((e) => { console.error("[fleshToStone] Error:", e); });

    const saveResult = await promise;

    if (saveResult.success) {
        const newSuccesses = currentSuccesses + 1;
        if (newSuccesses >= MAX_SUCCESSES) {
            // Spell ends — remove Restrained, clear tracking
            const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            const conds = Array.isArray(storedConds) ? storedConds : [];
            setRuntimeValue(targetName, 'activeConditions', conds.filter(c => String(c).toLowerCase() !== 'restrained'), campaignName);
            setRuntimeValue(casterName, trackingKey, null, campaignName);

            // Clean up target effect
            cleanupTargetEffect(casterName, targetName, campaignName);

            addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-flesh-to-stone',
                targetName,
                saveDc,
                saveType: 'CON',
                success: true,
                description: `${targetName} succeeded on CON save (${newSuccesses}/${MAX_SUCCESSES}). Flesh to Stone ends!`,
            }).catch((e) => { console.error("[fleshToStone] Error:", e); });

            addEntry(campaignName, {
                type: 'condition',
                action: 'removed',
                characterName: targetName,
                condition: 'Restrained',
                reason: 'Flesh to Stone ended (3 successful saves)',
                timestamp: Date.now(),
            }).catch((e) => { console.error("[fleshToStone] Error:", e); });

            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Flesh to Stone',
                    description: `${targetName} succeeded on CON save (${newSuccesses}/${MAX_SUCCESSES}). Flesh to Stone ends!`,
                },
            };
        }

        // Still need more successes
        setRuntimeValue(casterName, trackingKey, [newSuccesses, currentFails], campaignName);

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-flesh-to-stone',
            targetName,
            saveDc,
            saveType: 'CON',
            success: true,
            description: `${targetName} succeeded on CON save (${newSuccesses}/${MAX_SUCCESSES} successes, ${currentFails}/${MAX_FAILS} failures). Spell continues.`,
        }).catch((e) => { console.error("[fleshToStone] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Flesh to Stone',
                description: `${targetName} succeeded on CON save (${newSuccesses}/${MAX_SUCCESSES} successes). ${MAX_SUCCESSES - newSuccesses} more needed to end spell.`,
            },
        };
    }

    // Failed save
    const newFails = currentFails + 1;
    if (newFails >= MAX_FAILS) {
        // Petrified! Upgrade Restrained → Petrified
        const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conds = Array.isArray(storedConds) ? storedConds : [];
        const withoutRestrained = conds.filter(c => String(c).toLowerCase() !== 'restrained');
        const withoutPetrified = withoutRestrained.filter(c => String(c).toLowerCase() !== 'petrified');
        setRuntimeValue(targetName, 'activeConditions', [...withoutPetrified, 'petrified'], campaignName);

        setRuntimeValue(casterName, trackingKey, null, campaignName);
        cleanupTargetEffect(casterName, targetName, campaignName);

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-flesh-to-stone',
            targetName,
            saveDc,
            saveType: 'CON',
            success: false,
            description: `${targetName} failed CON save (${newFails}/${MAX_FAILS})! Turned to stone — Petrified!`,
        }).catch((e) => { console.error("[fleshToStone] Error:", e); });

        addEntry(campaignName, {
            type: 'condition',
            action: 'applied',
            characterName: targetName,
            condition: 'Petrified',
            reason: 'Flesh to Stone (3 failed saves)',
            note: `${targetName} turned to stone by Flesh to Stone.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[fleshToStone] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Flesh to Stone',
                description: `${targetName} failed CON save (${newFails}/${MAX_FAILS}) and is Petrified!`,
            },
        };
    }

    // Still petrifying
    setRuntimeValue(casterName, trackingKey, [currentSuccesses, newFails], campaignName);

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-flesh-to-stone',
        targetName,
        saveDc,
        saveType: 'CON',
        success: false,
        description: `${targetName} failed CON save (${currentSuccesses}/${MAX_SUCCESSES} successes, ${newFails}/${MAX_FAILS} failures). Flesh hardens...`,
    }).catch((e) => { console.error("[fleshToStone] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Flesh to Stone',
            description: `${targetName} failed CON save (${newFails}/${MAX_FAILS} failures). ${MAX_FAILS - newFails} more failures → Petrified.`,
        },
    };
}

function cleanupTargetEffect(casterName, targetName, campaignName) {
    const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
    const effects = Array.isArray(targetEffects) ? targetEffects : [];
    const cleaned = effects.filter(
        te => !(te.target === targetName && te.effect === 'flesh_to_stone_repeat_save' && te.source === casterName)
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
                description: 'No creatures in combat. Flesh to Stone has no effect.',
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
                description: 'No target selected. Flesh to Stone has no effect.',
            },
        };
    }

    const targetCreature = cs.creatures.find(c => c.name === targetName);

    // Check if this target already has an active Flesh to Stone effect (repeat save)
    const trackingKey = getTrackingKey(targetName);
    const existingTracking = getRuntimeValue(casterName, trackingKey, campaignName);
    if (existingTracking && Array.isArray(existingTracking) && existingTracking.length >= 2) {
        // This is a repeated end-of-turn save
        return await processFleshToStoneRepeatSave(casterName, targetName, dc, campaignName);
    }

    // Constructs automatically succeed on the save
    const creatureType = targetCreature?.type || '';
    const isConstruct = creatureType.toLowerCase() === 'construct';
    if (isConstruct) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${targetName} is a Construct and automatically succeeds on the save against Flesh to Stone.`,
        }).catch((e) => { console.error("[fleshToStone] Error:", e); });

        // Constructs still get Speed 0 until start of your next turn
        const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'speed_zero');
        setRuntimeValue(targetName, 'activeConditions', [...filtered, 'speed_zero'], campaignName);

        addExpiration(casterName, targetName, [
            { type: 'speed_zero' },
        ], campaignName, undefined, casterName);

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} is a Construct and automatically succeeds on the save. Speed is 0 until the start of your next turn.`,
            },
        };
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'CON',
        saveDc: dc,
        dcSuccess: 'none',
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${casterName} casts Flesh to Stone on ${targetName}! ${targetName} must make a CON save (DC ${dc}) or become Restrained.`,
        promptId,
    }).catch((e) => { console.error("[fleshToStone] Error:", e); });

    const saveResult = await promise;

    if (saveResult.success) {
        // On successful save: Speed 0 until the start of your next turn
        const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'speed_zero');
        setRuntimeValue(targetName, 'activeConditions', [...filtered, 'speed_zero'], campaignName);

        addExpiration(casterName, targetName, [
            { type: 'speed_zero' },
        ], campaignName, undefined, casterName);

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-flesh-to-stone',
            targetName,
            saveDc: dc,
            saveType: 'CON',
            success: true,
            description: `${targetName} succeeded on CON save against Flesh to Stone. Speed is 0 until the start of ${casterName}'s next turn.`,
        }).catch((e) => { console.error("[fleshToStone] Error:", e); });

        addEntry(campaignName, {
            type: 'condition',
            action: 'applied',
            characterName: targetName,
            condition: 'Speed 0',
            reason: 'Flesh to Stone (successful save)',
            note: `${targetName} succeeded on CON save; Speed is 0 until the start of ${casterName}'s next turn.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[fleshToStone] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} succeeded on CON save. Speed is 0 until the start of your next turn.`,
            },
        };
    }

    // Failed save: apply Restrained condition
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'restrained');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'restrained'], campaignName);

    // Initialize save tracking: [successCount, failureCount]
    setRuntimeValue(casterName, trackingKey, [0, 1], campaignName);

    addExpiration(casterName, targetName, [
        { type: 'condition', condition: 'restrained' },
    ], campaignName);

    // Store target effect for end-of-turn repeated saves
    const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
    const effects = Array.isArray(targetEffects) ? targetEffects : [];
    const existingIdx = effects.findIndex(
        te => te.target === targetName && te.effect === 'flesh_to_stone_repeat_save'
    );
    const fleshEffect = {
        target: targetName,
        effect: 'flesh_to_stone_repeat_save',
        source: casterName,
        condition: 'restrained',
        dc: dc,
        saveType: 'CON',
        duration: 'concentration',
    };
    if (existingIdx >= 0) {
        effects[existingIdx] = fleshEffect;
    } else {
        effects.push(fleshEffect);
    }
    setRuntimeValue(campaignName, 'targetEffects', effects, campaignName);

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-flesh-to-stone',
        targetName,
        saveDc: dc,
        saveType: 'CON',
        success: false,
        description: `${targetName} failed CON save against Flesh to Stone and is Restrained (1/3 failed saves). After 3 failed saves, ${targetName} becomes Petrified.`,
    }).catch((e) => { console.error("[fleshToStone] Error:", e); });

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Restrained',
        reason: 'Flesh to Stone',
        note: `${targetName} is Restrained by Flesh to Stone. Must make CON save at end of each turn. 3 failures → Petrified`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[fleshToStone] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetName} failed CON save and is Restrained (1/3 failures). At the end of each of its turns, it must make another CON save. 3 failures → Petrified. 3 successes → spell ends.`,
        },
    };
}
