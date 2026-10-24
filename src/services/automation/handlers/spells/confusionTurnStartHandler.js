import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../services/ui/logService.js';

/**
 * Confusion turn-start effect handler.
 * At the start of a confused creature's turn, roll 1d10 to determine behavior:
 *   1 = move randomly (1=N, 2=E, 3=S, 4=W)
 *   2-6 = do nothing (no movement, no actions)
 *   7-8 = Attack action vs random creature within reach
 *   9-10 = Target chooses behavior
 * At end of turn, creature repeats WIS save to end effect.
 */

export async function handleConfusionTurnStart(targetName, campaignName) {
    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const confusionEffect = targetEffects.find(
        te => te.target === targetName && te.effect === 'confusion'
    );

    if (!confusionEffect) {
        return null;
    }

    const dc = confusionEffect.dc;

    // Roll 1d10 for confused behavior
    const d10Roll = Math.floor(Math.random() * 10) + 1;

    let behaviorText = '';
    let actionTaken = null;

    if (d10Roll === 1) {
        // Move randomly: roll 1d4 for direction
        const direction = Math.floor(Math.random() * 4) + 1;
        const directionNames = { 1: 'north', 2: 'east', 3: 'south', 4: 'west' };
        behaviorText = `Rolled 1: ${targetName} moves randomly to the ${directionNames[direction]}. No action taken.`;
        actionTaken = 'move_random';
    } else if (d10Roll >= 2 && d10Roll <= 6) {
        behaviorText = `Rolled ${d10Roll}: ${targetName} does nothing (no movement or actions).`;
        actionTaken = 'do_nothing';
    } else if (d10Roll >= 7 && d10Roll <= 8) {
        behaviorText = `Rolled ${d10Roll}: ${targetName} takes the Attack action against a random creature within reach.`;
        actionTaken = 'attack_random';
    } else {
        // 9-10: Target chooses behavior
        behaviorText = `Rolled ${d10Roll}: ${targetName} chooses its own behavior.`;
        actionTaken = 'choose';
    }

    // Log the behavior
    try {
        await addEntry(campaignName, {
            type: 'condition',
            action: 'turn_start_behavior',
            characterName: targetName,
            condition: 'Confused',
            reason: 'Confusion spell turn-start effect',
            note: behaviorText,
            timestamp: Date.now(),
        });
    } catch (e) {
        console.error('[confusionTurnStart] Error logging behavior:', e);
    }

    // At end of turn, the creature should repeat the WIS save
    // This is handled by the savePromptService - we set up a pending save
    // The actual save prompt is triggered by the turn-end logic

    return {
        behavior: actionTaken,
        d10Roll,
        dc,
        behaviorText,
    };
}

export function applyEndOfTurnConfusionSave(targetName, campaignName, saveDc, saveType) {
    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const confusionEffect = targetEffects.find(
        te => te.target === targetName && te.effect === 'confusion'
    );

    if (!confusionEffect) {
        return null;
    }

    // Create a save prompt for the end-of-turn save
    const promptId = `confusion-end-turn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Store the save context so the save result handler can process it
    const existingPrompts = Array.from(getRuntimeValue('campaign', 'pendingSaveListenerPrompts', campaignName) || []); // fix#339 (#1520-family): read/write symmetric channel vocabulary per fix#153/#198 — reader is arity-2 (useRuntimeState.js:63), scope = SSE-mirrored active-campaign store until #1520
    existingPrompts.push(promptId);
    setRuntimeValue('campaign', 'pendingSaveListenerPrompts', existingPrompts, campaignName);

    return {
        promptId,
        dc: confusionEffect.dc || saveDc,
        saveType: saveType || 'WIS',
        targetName,
    };
}

export function removeConfusionEffect(targetName, campaignName) {
    // Remove charmed and speed_zero conditions
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c =>
        String(c).toLowerCase() !== 'charmed' &&
        String(c).toLowerCase() !== 'speed_zero'
    );
    setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);

    // Remove confusion targetEffect
    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(targetEffects) ? targetEffects.filter(
        te => !(te.target === targetName && te.effect === 'confusion')
    ) : [];
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName);

    try {
        addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Confused',
            reason: 'Successful WIS save at end of turn',
            timestamp: Date.now(),
        });
    } catch (e) {
        console.error('[confusionTurnStart] Error logging removal:', e);
    }
}
