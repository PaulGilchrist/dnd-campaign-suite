import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';


export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);
    const targetName = auto.targetName || 'Unknown';

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'CON',
        saveDc: dc,
        dcSuccess: 'none',
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Ray of Enfeeblement',
        description: `${playerStats.name} casts Ray of Enfeeblement on ${targetName}. ${targetName} must make a CON save (DC ${dc}).`,
        promptId,
    }).catch((e) => { console.error("[rayOfEnfeeblement] Error:", e); });

    const saveResult = await promise;

    if (saveResult.success) {
        addEntry(campaignName, {
            type: 'save_result',
            characterName: playerStats.name,
            rollType: 'save-ray-of-enfeeblement',
            targetName,
            saveDc: dc,
            saveType: 'CON',
            success: true,
            description: `${targetName} succeeded on CON save against Ray of Enfeeblement.`,
        }).catch((e) => { console.error("[rayOfEnfeeblement] Error:", e); });

        // Successful save: target has Disadvantage on next attack roll until start of caster's next turn
        const allTargetEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
        const existingIndex = allTargetEffects.findIndex(
            te => te.target === targetName && te.effect === 'disadvantage_next_attack' && te.source === playerStats.name
        );

        const nextAttackEffect = {
            target: targetName,
            source: playerStats.name,
            effect: 'disadvantage_next_attack',
        };

        if (existingIndex >= 0) {
            allTargetEffects[existingIndex] = nextAttackEffect;
        } else {
            allTargetEffects.push(nextAttackEffect);
        }

        setRuntimeValue(campaignName, 'targetEffects', allTargetEffects, campaignName);

        addExpiration(playerStats.name, targetName, [
            { type: 'remove_target_effect', effectKey: 'disadvantage_next_attack', source: playerStats.name },
        ], campaignName, 1);

        addEntry(campaignName, {
            type: 'automation_info',
            action: 'applied',
            characterName: targetName,
            effect: 'Disadvantage on next attack roll',
            reason: 'Ray of Enfeeblement (successful save)',
            note: `${targetName} has Disadvantage on the next attack roll until the start of ${playerStats.name}'s next turn.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[rayOfEnfeeblement] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Ray of Enfeeblement',
                description: `${targetName} succeeded on the CON save. ${targetName} has Disadvantage on the next attack roll until the start of ${playerStats.name}'s next turn.`,
            },
        };
    }

    // ── Failed save: apply debuffs via targetEffects ──

    const allTargetEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const existingIndex = allTargetEffects.findIndex(
        te => te.target === targetName && te.effect === 'ray_of_enfeeble_debuff' && te.source === playerStats.name
    );

    const rayEffect = {
        target: targetName,
        effect: 'ray_of_enfeeble_debuff',
        source: playerStats.name,
        strCheckDisadvantage: true,
        rayOfEnfeebleDamageReduction: true,
    };

    if (existingIndex >= 0) {
        allTargetEffects[existingIndex] = rayEffect;
    } else {
        allTargetEffects.push(rayEffect);
    }

    setRuntimeValue(campaignName, 'targetEffects', allTargetEffects, campaignName);

    // Apply expiration (concentration handles duration; 1 minute = 10 rounds default)
    addExpiration(playerStats.name, targetName, [
        { type: 'remove_target_effect', effectKey: 'ray_of_enfeeble_debuff', source: playerStats.name },
    ], campaignName, 10);

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Ray of Enfeeblement debuff',
        reason: 'Ray of Enfeeblement (failed save)',
        note: `${targetName} has Disadvantage on Strength-based d20 tests and subtracts 1d8 from all damage rolls (Concentration, up to 1 minute). Target repeats CON save at end of each turn.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[rayOfEnfeeblement] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Ray of Enfeeblement',
            targetName,
            description: `${targetName} failed the CON save. ${targetName} has Disadvantage on Strength-based d20 tests and subtracts 1d8 from all damage rolls (Concentration, up to 1 minute). ${targetName} repeats the save at the end of each turn.`,
            automation: auto,
        },
    };
}

export function isRayOfEnfeeblementActive(targetName, casterName, campaignName) {
    const allTargetEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    return allTargetEffects.some(
        te => te.target === targetName && te.effect === 'ray_of_enfeeble_debuff' && te.source === casterName
    );
}
