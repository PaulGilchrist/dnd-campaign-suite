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
                description: 'No creatures in combat. Fear has no effect.',
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
            description: `${casterName} casts Fear! ${targetName} must make a WIS save (DC ${dc}) or drop what it's holding and become Frightened.`,
            promptId,
        }).catch(() => {});

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
            addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-fear',
                targetName,
                saveDc: dc,
                saveType: 'WIS',
                success: true,
                description: `${targetName} succeeded on WIS save against Fear.`,
            }).catch(() => {});
        } else {
            affectedCount++;

            const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            const conditions = Array.isArray(storedConditions) ? storedConditions : [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== 'frightened');
            setRuntimeValue(targetName, 'activeConditions', [...filtered, 'frightened'], campaignName);

            postLogEntry(campaignName, {
                type: 'condition',
                action: 'applied',
                characterName: targetName,
                condition: 'Frightened',
                reason: 'Fear spell',
                note: `${targetName} drops what it was holding, becomes Frightened, and must take the Dash action to move away from ${casterName} on each of its turns.`,
                timestamp: Date.now(),
            });

            addExpiration(casterName, targetName, [
                { type: 'condition', condition: 'frightened' },
            ], campaignName, 10);

            // Track Fear-specific effect: affected creature can re-save if it ends its turn
            // without line of sight to the caster
            const targetEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            const effects = Array.isArray(targetEffects) ? targetEffects : [];
            const existingIdx = effects.findIndex(
                te => te.target === targetName && te.effect === 'fear_end_on_los'
            );
            const fearEffect = {
                target: targetName,
                effect: 'fear_end_on_los',
                source: casterName,
                condition: 'frightened',
                dc: dc,
                duration: 'concentration',
            };
            if (existingIdx >= 0) {
                effects[existingIdx] = fearEffect;
            } else {
                effects.push(fearEffect);
            }
            setRuntimeValue(campaignName, 'targetEffects', effects, campaignName);

            results.push(`${targetName} drops what it's holding and is Frightened.`);
        }
    }

    const summary = affectedCount > 0
        ? `Fear affects ${affectedCount} creature(s). ${results.join(' ')} ${savedCount} creature(s) saved. Affected creatures drop what they're holding, are Frightened, and must use the Dash action to move away on each of their turns. An affected creature can repeat the save if it ends its turn without line of sight to you.`
        : `No creatures affected by Fear. ${savedCount} creature(s) saved.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}
