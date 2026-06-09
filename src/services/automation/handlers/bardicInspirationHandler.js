import { resolveTarget } from '../common/targetResolver.js';
import { resolveMapPositions } from '../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addExpiration } from '../../rules/expirations.js';
import { evaluateAutoExpression } from '../../combat/automationService.js';
import { getDistanceFeet, rangeToFeet } from '../../rules/rangeValidation.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;

    const usesMax = auto.uses_expression
        ? evaluateAutoExpression(auto.uses_expression, playerStats)
        : 0;

    if (usesMax > 0) {
        const usesUsed = Number(getRuntimeValue(playerStats.name, 'bardicInspirationUses', campaignName) ?? 0);
        if (usesUsed >= usesMax) {
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
        await setRuntimeValue(playerStats.name, 'bardicInspirationUses', usesUsed + 1, campaignName);
    }

    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const dieSize = classLevel?.bardic_die || 6;

    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    if (!targetInfo?.target) {
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

    const targetName = targetInfo.target.name;
    const rangeFt = rangeToFeet(auto.range || '60_ft');

    if (mapName && rangeFt != null) {
        const positions = await resolveMapPositions(campaignName, mapName, playerStats.name);
        if (positions?.attackerPos && positions?.targetPos) {
            const dist = getDistanceFeet(positions.attackerPos, positions.targetPos);
            if (dist != null && dist > rangeFt) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        description: `${targetName} is out of range (${Math.round(dist)} ft > ${rangeFt} ft).`,
                        automation: auto,
                    },
                };
            }
        }
    }

    await setRuntimeValue(targetName, 'bardicInspirationDie', String(dieSize), campaignName);
    await setRuntimeValue(targetName, 'bardicInspirationGrantedBy', playerStats.name, campaignName);

    const hasCombatOptions = (playerStats.automation?.passives || []).some(
        p => p.effect === 'bardic_inspiration_combat_options'
    );
    if (hasCombatOptions) {
        const options = auto.options || ['defense_add_to_ac', 'offense_add_to_damage'];
        await setRuntimeValue(targetName, 'bardicInspirationCombatOptions', JSON.stringify(options), campaignName);
    }

    addExpiration(playerStats.name, targetName, [
        { type: 'remove_bardic_inspiration' }
    ], campaignName, 100);

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
