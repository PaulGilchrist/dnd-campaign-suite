import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { addEntry } from '../../../ui/logService.js';

function conditionMatches(c, targetCondition) {
    return (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No combat context found. Cannot apply ${action.name}.`,
            },
        };
    }

    const creatureTargets = combatSummary.creatures
        .filter(c => c.name !== playerStats.name)
        .map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'greater_restoration_selection',
            name: action.name,
            creatureTargets,
            range: auto.range || 'Touch',
            automation: auto,
        },
    };
}

export async function applyGreaterRestoration(action, playerStats, campaignName, mapName, result) {
    if (!result || !result.targetName) {
        return null;
    }

    const targetName = result.targetName;
    const selections = result.selections || [];
    const removedItems = [];

    for (const selection of selections) {
        if (selection.type === 'exhaustion') {
            const currentLevel = getRuntimeValue(targetName, 'exhaustionLevel') || 0;
            if (currentLevel > 0) {
                const newLevel = Math.max(0, currentLevel - 1);
                setRuntimeValue(targetName, 'exhaustionLevel', newLevel, campaignName);
                removedItems.push(`1 Exhaustion level (was ${currentLevel}, now ${newLevel})`);
            }
        }

        if (selection.type === 'condition') {
            const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
            const filtered = conditions.filter(c => !conditionMatches(String(c), selection.condition));
            if (filtered.length !== conditions.length) {
                setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
                removedItems.push(`${selection.condition} condition`);

                const combatSummary = await getCombatContext(campaignName);
                if (combatSummary) {
                    const creature = combatSummary.creatures?.find(c => c.name === targetName);
                    if (creature && Array.isArray(creature.conditions)) {
                        creature.conditions = creature.conditions.filter(c => !conditionMatches(String(c.key), selection.condition));
                    }
                }
            }
        }

        if (selection.type === 'curse') {
            const activeBuffs = getRuntimeValue(targetName, 'activeBuffs') || [];
            const cursedBuffs = activeBuffs.filter(b => b.type === 'cursed' || b.cursed);
            if (cursedBuffs.length > 0) {
                const newBuffs = activeBuffs.filter(b => b.type !== 'cursed' && !b.cursed);
                setRuntimeValue(targetName, 'activeBuffs', newBuffs, campaignName);
                removedItems.push(`Curse (removed ${cursedBuffs.length} cursed effect(s))`);

                for (const cursedBuff of cursedBuffs) {
                    postLogEntry(campaignName, {
                        type: 'buff',
                        action: 'removed',
                        characterName: targetName,
                        buffName: cursedBuff.name || 'Curse',
                        reason: 'Greater Restoration',
                        timestamp: Date.now(),
                    });
                }
            }
        }

        if (selection.type === 'ability_reduction') {
            const abilityReductions = getRuntimeValue(targetName, 'abilityReductions') || {};
            const reducedAbilities = Object.keys(abilityReductions);
            if (reducedAbilities.length > 0) {
                const newReductions = {};
                for (const ability of reducedAbilities) {
                    const removedReduction = abilityReductions[ability];
                    setRuntimeValue(targetName, `${ability}_original`, removedReduction.original, campaignName);
                    const currentVal = getRuntimeValue(targetName, ability);
                    if (currentVal !== removedReduction.original) {
                        setRuntimeValue(targetName, ability, removedReduction.original, campaignName);
                    }
                }
                setRuntimeValue(targetName, 'abilityReductions', newReductions, campaignName);
                removedItems.push(`Ability score reduction(s) on ${reducedAbilities.join(', ')}`);
            }
        }

        if (selection.type === 'hp_max_reduction') {
            const hpMaxReduction = getRuntimeValue(targetName, 'hpMaxReduction') || 0;
            if (hpMaxReduction > 0) {
                const baseHp = getRuntimeValue(targetName, 'hitPoints') || 0;
                const currentHp = getRuntimeValue(targetName, 'currentHitPoints') || baseHp;
                const newBaseHp = baseHp + hpMaxReduction;
                setRuntimeValue(targetName, 'hitPoints', newBaseHp, campaignName);
                const newCurrentHp = Math.min(newBaseHp, currentHp + hpMaxReduction);
                setRuntimeValue(targetName, 'currentHitPoints', newCurrentHp, campaignName);
                setRuntimeValue(targetName, 'hpMaxReduction', 0, campaignName);
                removedItems.push(`Hit Point maximum reduction (-${hpMaxReduction} HP max restored)`);
            }
        }
    }

    if (removedItems.length > 0) {
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${playerStats.name} cast ${action.name} on ${targetName}: ${removedItems.join('; ')}.`,
            targetName,
            timestamp: Date.now(),
        });

        postLogEntry(campaignName, {
            type: 'spell_effect',
            characterName: playerStats.name,
            spellName: action.name,
            targetName,
            effects: removedItems,
            timestamp: Date.now(),
        });
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: removedItems.length > 0
                ? `${targetName}: ${removedItems.join('; ')}`
                : `${targetName}: No removable effects found.`,
        },
    };
}
