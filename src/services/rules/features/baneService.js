import { executeHandler } from '../../automation/index.js';
import { createSaveListener, buildSaveDc } from '../../automation/common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

export async function triggerBaneSpell(spell, metaCtx, playerStats, campaignName, mapName) {
    const isBane = (spell.name || '').toLowerCase() === 'bane';
    if (!isBane) return null;

    const slotLevel = metaCtx?.slotLevel || spell.level || 1;
    const auto = spell.automation || {};
    const maxTargets = auto.maxTargets || 3;

    const action = {
        name: 'Bane',
        automation: {
            type: 'bane',
            range: spell.range || '30 feet',
            maxTargets: maxTargets,
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[baneSpell] Failed to execute Bane handler:', e);
        return null;
    }
}

async function applyBanePenaltyEffect(campaignName, targetName, casterName, slotLevel) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(storedEffects) ? [...storedEffects] : [];
    const baneEffect = {
        target: targetName,
        effect: 'bane_penalty',
        source: casterName,
        slotLevel,
        duration: 'concentration',
    };
    const existingIndex = effects.findIndex(
        te => te.target === targetName && te.effect === 'bane_penalty' && te.source === casterName
    );
    if (existingIndex >= 0) {
        effects[existingIndex] = baneEffect;
    } else {
        effects.push(baneEffect);
    }
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName, true);

    addEntry(campaignName, {
        type: 'automation',
        characterName: casterName,
        abilityName: 'Bane',
        description: `${targetName} fails CHA save against Bane. Attack rolls and saving throws suffer -1d4 penalty.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[baneSpell] Error logging effect:', e); });
}
export async function applyBaneEffect(spell, playerStats, campaignName, mapName, targetNames) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const slotLevel = spell.level || 1;
    const castingTime = spell.casting_time || '1 action';
    const saveDc = buildSaveDc(spell.automation || {}, playerStats) || playerStats.computedStats?.saveBonuses?.CHA + 8;
    const casterName = playerStats.name;

    const logTargets = [];

    for (const targetName of targetNames) {
        const { promise, promptId } = createSaveListener(campaignName, {
            targetName,
            saveType: 'CHA',
            saveDc,
            dcSuccess: 'none',
            advantage: false,
            disadvantage: false,
        });

        addEntry(campaignName, {
            type: 'spell',
            characterName: casterName,
            targetName,
            spellName: 'Bane',
            spellLevel: slotLevel,
            castingTime: castingTime,
            description: `${casterName} casts Bane on ${targetName} (DC ${saveDc} CHA save).`,
            promptId,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[baneSpell] Error logging cast:', e); });

        const saveResult = await promise;

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-bane',
            targetName,
            saveDc,
            saveType: 'CHA',
            success: saveResult.success,
            roll: saveResult.roll,
            total: saveResult.total,
            description: `${targetName} ${saveResult.success ? 'succeeded' : 'failed'} on CHA save against Bane (DC ${saveDc}).`,
        }).catch((e) => { console.error('[baneSpell] Error logging save:', e); });

        if (!saveResult.success) {
            await applyBanePenaltyEffect(campaignName, targetName, casterName, slotLevel);
            logTargets.push({ name: targetName, saved: false });
        } else {
            logTargets.push({ name: targetName, saved: true });
        }
    }

    const failedTargets = logTargets.filter(t => !t.saved).map(t => t.name);
    const succeededTargets = logTargets.filter(t => t.saved).map(t => t.name);

    addEntry(campaignName, {
        type: 'spell',
        characterName: casterName,
        targetName: targetNames[0],
        targets: targetNames,
        spellName: 'Bane',
        spellLevel: slotLevel,
        castingTime: spell.casting_time || '1 action',
        description: `Bane cast: ${failedTargets.length} target(s) affected, ${succeededTargets.length} succeeded. Targets: ${targetNames.join(', ')}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[baneSpell] Error logging summary:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Bane',
            description: `${failedTargets.length} of ${targetNames.length} target(s) affected by Bane.`,
        },
    };
}
