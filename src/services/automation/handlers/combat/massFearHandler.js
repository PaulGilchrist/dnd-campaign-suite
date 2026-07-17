import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

export async function handle(action, playerStats, campaignName, mapName, _characters) {
    const auto = action.automation || action;
    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
    const targetName = target?.name || null;
    return resolveMassFear(campaignName, playerStats.name, targetName, auto, playerStats, mapName);
}

export async function resolveMassFear(campaignName, casterName, primaryTargetName, option, playerStats, _mapName) {
    const auto = { ...option, saveDc: option.saveDc || 'ability', saveAbility: option.saveAbility || 'WIS' };
    const saveType = option.saveType || 'WIS';
    const dc = buildSaveDc(auto, playerStats);
    const range = parseInt((option.range || '10_ft').replace(/_ft$/, ''), 10);
    const condition = option.condition || 'frightened';
    const conditionLabel = condition.charAt(0).toUpperCase() + condition.slice(1);
    const abilityName = option.name || 'Mass Fear';

    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures || cs.creatures.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: abilityName,
                description: 'No creatures in combat.',
            },
        };
    }

    const primaryTarget = cs.creatures.find(c => c.name === primaryTargetName);

    const targets = [];
    for (const c of cs.creatures) {
        if (c.name === casterName) continue;
        if (c.name === primaryTargetName) { targets.push(c); continue; }
        if (!primaryTarget) { targets.push(c); continue; }
        const inRange = await isWithinRange(primaryTargetName, c.name, range);
        if (inRange) targets.push(c);
    }

    if (targets.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: abilityName,
                description: 'No targets in range.',
            },
        };
    }

    let affected = 0;
    let saved = 0;
    const affectedNames = [];

    for (const target of targets) {
        const targetName = target.name;

        const { promptId, promise } = createSaveListener(campaignName, {
            targetName,
            saveType,
            saveDc: dc,
            dcSuccess: 'none',
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName,
            description: `${casterName} uses Mass Fear! ${targetName} must make a ${saveType} save (DC ${dc}) or become ${conditionLabel}.`,
            promptId,
        }).catch((e) => { console.error('[massFear] Error:', e); });

        const saveResult = await promise;

        if (saveResult.success) {
            saved++;
        } else {
            affected++;
            affectedNames.push(targetName);

            const stored = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            const conditions = Array.isArray(stored) ? stored : [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== condition.toLowerCase());
            setRuntimeValue(targetName, 'activeConditions', [...filtered, condition], campaignName);

            addExpiration(casterName, targetName, [
                { type: 'condition', condition },
            ], campaignName);
        }
    }

    const summary = affected > 0
        ? `${abilityName}: ${affected} creature(s) affected — ${affectedNames.join(', ')}. ${saved} creature(s) saved.`
        : `${abilityName}: No creatures affected. ${saved} creature(s) saved.`;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName,
        description: summary,
    }).catch((e) => { console.error('[massFear] Error:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: abilityName,
            description: summary,
        },
    };
}
