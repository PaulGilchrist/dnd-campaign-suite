import { buildSaveDc, createSaveListener } from '../common/savePrompt.js';
import { getCombatContext } from '../../rules/damageUtils.js';
import { addEntry } from '../../ui/logService.js';
import { postLogEntry } from '../../shared/logPoster.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addExpiration } from '../../rules/expirations.js';

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
                description: 'No creatures in combat. Mass Suggestion has no effect.',
            },
        };
    }

    const casterName = playerStats.name;
    const targets = cs.creatures.filter(c => c.name !== casterName);

    // Limit to maxTargets (default 12)
    const maxTargets = auto.maxTargets || 12;
    const limitedTargets = targets.slice(0, maxTargets);

    let affectedCount = 0;
    let savedCount = 0;
    const results = [];

    for (const target of limitedTargets) {
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
            description: `${casterName} casts Mass Suggestion! ${targetName} must make a WIS save (DC ${dc}) or become Charmed.`,
            promptId,
        }).catch(() => {});

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
            addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-mass-suggestion',
                targetName,
                saveDc: dc,
                saveType: 'WIS',
                success: true,
                description: `${targetName} succeeded on WIS save against Mass Suggestion.`,
            }).catch(() => {});
        } else {
            affectedCount++;

            const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            const conditions = Array.isArray(storedConditions) ? storedConditions : [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== 'charmed');
            setRuntimeValue(targetName, 'activeConditions', [...filtered, 'charmed'], campaignName);

            postLogEntry(campaignName, {
                type: 'condition',
                action: 'applied',
                characterName: targetName,
                condition: 'Charmed',
                reason: 'Mass Suggestion spell',
                note: `${targetName} is Charmed by Mass Suggestion and pursues the suggested course of activity. The spell ends if ${casterName} or allies deal damage to the target.`,
                timestamp: Date.now(),
            });

            addExpiration(casterName, targetName, [
                { type: 'charmed', condition: 'charmed' },
            ], campaignName, 24);

            results.push(`${targetName} is Charmed by Mass Suggestion.`);
        }
    }

    const summary = affectedCount > 0
        ? `Mass Suggestion affects ${affectedCount} creature(s). ${results.join(' ')} ${savedCount} creature(s) saved. Affected creatures are Charmed and pursue the suggested activity. The spell ends for a target if ${casterName} or allies deal damage to it.`
        : `No creatures affected by Mass Suggestion. ${savedCount} creature(s) saved.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}
