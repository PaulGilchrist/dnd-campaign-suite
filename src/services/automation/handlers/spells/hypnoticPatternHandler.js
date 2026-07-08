import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';

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
                description: 'No creatures in combat. Hypnotic Pattern has no effect.',
            },
        };
    }

    const casterName = playerStats.name;
    const targets = cs.creatures.filter(c => c.name !== casterName);

    let affectedCount = 0;
    let savedCount = 0;
    const results = [];

    for (const target of targets) {
        const targetName = target.name;

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
            description: `${casterName} casts Hypnotic Pattern! ${targetName} must make a WIS save (DC ${dc}) or become Charmed, Incapacitated, and have Speed 0.`,
            promptId,
        }).catch((e) => { console.error("[hypnoticPattern] Error:", e); });

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
            addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-hypnotic-pattern',
                targetName,
                saveDc: dc,
                saveType: 'WIS',
                success: true,
                description: `${targetName} succeeded on WIS save against Hypnotic Pattern.`,
            }).catch((e) => { console.error("[hypnoticPattern] Error:", e); });
        } else {
            affectedCount++;

            const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            const conditions = Array.isArray(storedConditions) ? storedConditions : [];
            const filtered = conditions.filter(c =>
                String(c).toLowerCase() !== 'charmed' &&
                String(c).toLowerCase() !== 'incapacitated' &&
                String(c).toLowerCase() !== 'speed_zero'
            );
            setRuntimeValue(targetName, 'activeConditions', [...filtered, 'charmed', 'incapacitated', 'speed_zero'], campaignName);

            addEntry(campaignName, {
                type: 'condition',
                action: 'applied',
                characterName: targetName,
                condition: 'Charmed, Incapacitated, Speed 0',
                reason: 'Hypnotic Pattern spell',
                note: `${targetName} is Charmed, Incapacitated, and has Speed 0. The spell ends if the creature takes damage or someone uses an action to shake it free.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[hypnoticPattern] Error:", e); });

            addExpiration(casterName, targetName, [
                { type: 'charmed', condition: 'charmed' },
                { type: 'incapacitated', condition: 'incapacitated' },
                { type: 'speed_zero', condition: 'speed_zero' },
            ], campaignName, 10);

            results.push(`${targetName} is Charmed, Incapacitated, and has Speed 0.`);
        }
    }

    const summary = affectedCount > 0
        ? `Hypnotic Pattern affects ${affectedCount} creature(s). ${results.join(' ')} ${savedCount} creature(s) saved. Affected creatures are Charmed, Incapacitated, and have Speed 0. The spell ends for an affected creature if it takes damage or someone uses an action to shake it free.`
        : `No creatures affected by Hypnotic Pattern. ${savedCount} creature(s) saved.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}
