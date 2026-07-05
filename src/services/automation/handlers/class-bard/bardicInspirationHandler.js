import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { postLogEntry } from '../../../shared/logPoster.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    const usesMax = auto.uses_expression
        ? evaluateAutoExpression(auto.uses_expression, playerStats)
        : 0;

    if (usesMax > 0) {
        const currentUses = Number(getRuntimeValue(playerStats.name, 'bardicInspirationUses', campaignName) ?? usesMax);
        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} has no uses remaining. Recharges on a Long Rest.`,
                    automation: auto,
                },
            };
        }
    }

    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const dieSize = classLevel?.bardic_die || classLevel?.class_specific?.bardic_inspiration_die || 6;

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary || !combatSummary.creatures || combatSummary.creatures.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} requires a target. Select a creature in combat and try again.`,
                automation: auto,
            },
        };
    }

    const creatureTargets = combatSummary.creatures
        .filter(c => c.name !== playerStats.name)
        .map(c => ({
            name: c.name,
            currentHp: c.currentHp,
            maxHp: c.maxHp,
            size: c.size,
            type: c.type,
        }));

    if (creatureTargets.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No valid targets available. There must be another creature in combat.',
                automation: auto,
            },
        };
    }

    const hasCombatOptions = (playerStats.automation?.passives || []).some(
        p => p.effect === 'bardic_inspiration_combat_options'
    );

    return {
        type: 'modal',
        modalName: 'bardicInspirationTarget',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            dieSize,
            hasCombatOptions,
        },
    };
}

export async function applyBardicInspiration(action, playerStats, campaignName, targetName, dieSize, hasCombatOptions) {
    const auto = action.automation;
    const usesMax = auto.uses_expression
        ? evaluateAutoExpression(auto.uses_expression, playerStats)
        : 0;

    if (usesMax > 0) {
        const currentUses = Number(getRuntimeValue(playerStats.name, 'bardicInspirationUses', campaignName) ?? usesMax);
        await setRuntimeValue(playerStats.name, 'bardicInspirationUses', currentUses - 1, campaignName);
    }

    await setRuntimeValue(targetName, 'bardicInspirationDie', String(dieSize), campaignName);
    await setRuntimeValue(targetName, 'bardicInspirationGrantedBy', playerStats.name, campaignName);

    if (hasCombatOptions) {
        const options = auto.options || ['defense_add_to_ac', 'offense_add_to_damage'];
        await setRuntimeValue(targetName, 'bardicInspirationCombatOptions', JSON.stringify(options), campaignName);
    }

    addExpiration(playerStats.name, targetName, [
        { type: 'remove_bardic_inspiration' }
    ], campaignName, 100);

    postLogEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} granted Bardic Inspiration (d${dieSize}) to ${targetName}.`,
    }).catch((e) => { console.error("[bardicInspirationHandler] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${action.name} (d${dieSize}) granted to ${targetName}. They can roll it on one ability check.`,
            automation: auto,
        },
    };
}
