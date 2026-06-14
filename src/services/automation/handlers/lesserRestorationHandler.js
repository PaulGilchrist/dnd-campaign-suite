import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';

const ALLOWED_CONDITIONS = ['blinded', 'deafened', 'paralyzed', 'poisoned'];

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
        .map(c => {
            const conditions = getRuntimeValue(c.name, 'activeConditions') || [];
            const applicableConditions = conditions.filter(cond =>
                ALLOWED_CONDITIONS.includes(typeof cond === 'string' ? cond.toLowerCase() : '')
            );
            return {
                name: c.name,
                hasApplicableConditions: applicableConditions.length > 0,
                conditions: applicableConditions,
            };
        });

    const selfConditions = getRuntimeValue(playerStats.name, 'activeConditions') || [];
    const selfApplicableConditions = selfConditions.filter(cond =>
        ALLOWED_CONDITIONS.includes(typeof cond === 'string' ? cond.toLowerCase() : '')
    );

    const allTargets = [
        { name: playerStats.name, hasApplicableConditions: selfApplicableConditions.length > 0, conditions: selfApplicableConditions, isSelf: true },
        ...creatureTargets,
    ];

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `Select a target and condition to remove.`,
            automation: auto,
            targets: allTargets,
            range: auto.range || 'Touch',
        },
    };
}

export async function applyLesserRestoration(action, playerStats, campaignName, mapName, result) {
    if (!result || !result.targetName) {
        return null;
    }

    const targetName = result.targetName;
    const conditionToRemove = result.condition;

    if (!conditionToRemove) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName}: No condition selected.`,
            },
        };
    }

    const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
    const filtered = conditions.filter(c => !conditionMatches(String(c), conditionToRemove));

    if (filtered.length === conditions.length) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName}: No applicable condition found to remove.`,
            },
        };
    }

    setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);

    const combatSummary = await getCombatContext(campaignName);
    if (combatSummary) {
        const creature = combatSummary.creatures?.find(c => c.name === targetName);
        if (creature && Array.isArray(creature.conditions)) {
            creature.conditions = creature.conditions.filter(c => !conditionMatches(String(c.key), conditionToRemove));
        }
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} cast ${action.name} on ${targetName}: Removed ${conditionToRemove} condition.`,
        targetName,
        timestamp: Date.now(),
    });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetName}: Removed ${conditionToRemove} condition.`,
        },
    };
}
