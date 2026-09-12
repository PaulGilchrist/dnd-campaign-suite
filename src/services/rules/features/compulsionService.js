import { executeHandler } from '../../automation/index.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addEntry } from '../../ui/logService.js';
import { addExpiration } from '../effects/expirations.js';
import { addCondition } from '../../combat/conditions/conditionSaveService.js';

async function resolveCompulsionTarget(metaCtx, campaignName) {
    if (metaCtx?.targetName) return metaCtx.targetName;
    const cs = await getCombatContext(campaignName);
    if (cs?.creatures && cs.creatures.length > 0) {
        return cs.creatures[0].name;
    }
    return null;
}

export async function triggerCompulsion(spell, metaCtx, playerStats, campaignName, mapName) {
    const isCompulsion = (spell.name || '').toLowerCase() === 'compulsion';
    if (!isCompulsion) return null;

    const targetName = await resolveCompulsionTarget(metaCtx, campaignName);
    if (!targetName) {
        return { type: 'popup', payload: { type: 'automation_info', name: 'Compulsion', description: 'No target selected for Compulsion.' } };
    }

    // Check if caster/target are in combat to determine if target gets advantage on save
    const cs = await getCombatContext(campaignName);
    const targetInCombat = cs?.creatures?.some(c => c.name === targetName && c.name !== playerStats.name) ?? false;

    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 4;

    const action = {
        name: 'Compulsion',
        automation: {
            type: 'compulsion',
            saveDc: spellSaveDc,
            targetName: targetName,
            advantage: targetInCombat,
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[compulsionService] Failed to execute Compulsion handler:', e);
        return { type: 'popup', payload: { type: 'automation_info', name: 'Compulsion', description: `Failed to execute Compulsion.` } };
    }
}

export async function applyCompulsionEffect(spell, playerStats, campaignName, mapName, targetNames) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const spellSaveDc = playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const casterName = playerStats.name;

    const logTargets = [];

    for (const targetName of targetNames) {
        const { promise, promptId } = createSaveListener(campaignName, {
            targetName,
            saveType: 'WIS',
            saveDc: spellSaveDc,
            dcSuccess: 'none',
            advantage: false,
            disadvantage: false,
            condition: 'charmed',
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: 'Compulsion',
            description: `${casterName} casts Compulsion on ${targetName}! ${targetName} must make a WIS save (DC ${spellSaveDc}) or become Charmed.`,
            promptId,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[compulsionService] Error logging cast:', e); });

        const saveResult = await promise;

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-compulsion',
            targetName,
            saveDc: spellSaveDc,
            saveType: 'WIS',
            success: saveResult.success,
            description: `${targetName} ${saveResult.success ? 'succeeded' : 'failed'} on WIS save against Compulsion (DC ${spellSaveDc}).`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[compulsionService] Error logging save:', e); });

        if (!saveResult.success) {
            const cs = await getCombatContext(campaignName);
            const conditionDef = { key: 'charmed', label: 'Charmed' };
            addCondition({ combatSummary: cs, creatureName: targetName, conditionDef, dc: spellSaveDc, ability: 'WIS', getRuntimeValue, setRuntimeValue, campaignName, playerStats });

            addExpiration(casterName, targetName, [
                { type: 'charmed', condition: 'charmed' },
            ], campaignName);

            logTargets.push({ name: targetName, saved: false });

            addEntry(campaignName, {
                type: 'condition',
                action: 'applied',
                characterName: targetName,
                condition: 'Charmed',
                reason: 'Compulsion spell',
                note: `${targetName} is Charmed by ${casterName}. As a bonus action on each of its turns, ${targetName} must use its movement to travel to the nearest space that is furthest away from ${casterName}.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[compulsionService] Error logging condition:', e); });
        } else {
            logTargets.push({ name: targetName, saved: true });
        }
    }

    const failedTargets = logTargets.filter(t => !t.saved).map(t => t.name);
    const succeededTargets = logTargets.filter(t => t.saved).map(t => t.name);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Compulsion',
        description: `Compulsion cast: ${failedTargets.length} of ${targetNames.length} target(s) affected. Targets: ${targetNames.join(', ')}. ${succeededTargets.length} succeeded on WIS save.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[compulsionService] Error logging summary:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Compulsion',
            description: `${failedTargets.length} of ${targetNames.length} target(s) affected by Compulsion and became Charmed.`,
        },
    };
}
